import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, IndianRupee } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  openRazorpayCheckout,
  recordPayment,
  markBookingPaid,
  createTrackingEvents,
  ensureConversation,
  sendInvoiceToExporter,
  // internal helpers
} from "@/services/paymentService";
import { updateShipmentStatus } from "@/services/shipmentService";
import { addTrackingEvent } from "@/services/trackingService";
import { createNotification } from "@/services/notificationService";
import { optimizeContainerFill } from "@/services/containerAllocator";
import { getOfflineBookings, updateOfflineBooking } from "@/services/bookingService";
import { isSupabaseReachable } from "@/lib/offlineAuth";

export default function MockPayment() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [amount, setAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [isOfflineBooking, setIsOfflineBooking] = useState(false);

  /* ---------------- FETCH BOOKING AMOUNT ---------------- */

  useEffect(() => {
    if (!bookingId) return;

    const fetchAmount = async () => {
      // Check if this is an offline booking
      if (bookingId.startsWith("offline-")) {
        setIsOfflineBooking(true);
        const offlineBookings = getOfflineBookings();
        const booking = offlineBookings.find((b) => b.id === bookingId);
        if (booking?.price) {
          setAmount(booking.price);
        }
        return;
      }

      // Online booking — try Supabase
      try {
        const online = await isSupabaseReachable(import.meta.env.VITE_SUPABASE_URL!, 3000);
        if (!online) {
          // Fallback: check offline storage even for non-offline IDs
          const offlineBookings = getOfflineBookings();
          const booking = offlineBookings.find((b) => b.id === bookingId);
          if (booking?.price) {
            setIsOfflineBooking(true);
            setAmount(booking.price);
          }
          return;
        }

        const { data, error } = await supabase
          .from("bookings")
          .select("price")
          .eq("id", bookingId)
          .single();

        if (error || !data?.price) {
          setAmount(0);
          return;
        }

        setAmount(data.price);
      } catch (err) {
        console.error("Failed to fetch booking amount:", err);
      }
    };

    fetchAmount();
  }, [bookingId]);

  /* ---------------- HANDLE PAYMENT ---------------- */

  const handlePayment = async () => {
    if (!bookingId || amount <= 0) return;

    setLoading(true);

    try {
      // Try Razorpay if SDK is available
      let paymentId = "";
      const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
      const razorpayAvailable = keyId && typeof window.Razorpay === "function";

      if (razorpayAvailable) {
        // Get current user info for prefill
        let email = "";
        try {
          const { data: { user } } = await supabase.auth.getUser();
          email = user?.email ?? "";
        } catch {
          // offline — skip prefill
        }

        // 1️⃣ Open Razorpay Checkout
        const rzpResponse = await openRazorpayCheckout({
          amount,
          bookingId,
          customerEmail: email,
        });
        paymentId = rzpResponse.razorpay_payment_id;
      } else {
        // Simulate payment when Razorpay isn't available
        paymentId = `sim_${crypto.randomUUID().slice(0, 12)}`;
      }

      // 2️⃣ Post-payment operations
      if (isOfflineBooking) {
        // Offline booking — update status in localStorage
        updateOfflineBooking(bookingId, { status: "paid" });
        toast({
          title: "Payment successful!",
          description: `Payment ID: ${paymentId}`,
        });
      } else {
        // Online booking — record in Supabase
        try {
          await recordPayment({
            booking_id: bookingId,
            amount,
            currency: "INR",
            payment_method: "razorpay",
            transaction_ref: paymentId,
          });
          await markBookingPaid(bookingId);
          await createTrackingEvents(bookingId);
          try {
            await sendInvoiceToExporter(bookingId);
          } catch (err) {
            console.warn("Invoice email skipped", err);
          }
          // Shipment + tracking lifecycle
          try {
            await updateShipmentStatus(bookingId, "payment_completed");
            await addTrackingEvent({ booking_id: bookingId, status: "payment_completed", location: "System" });
          } catch (err) {
            console.error("Shipment status add failed", err);
          }
          // Capacity + payout setup + invoice
          try {
            // reuse capacity update inside payment service (best-effort)
            const { data: booking } = await supabase
              .from("bookings")
              .select("container_id, allocated_cbm, booking_mode, exporter_id, container_number, origin, destination, price")
              .eq("id", bookingId)
              .maybeSingle();

            if (booking?.container_id) {
              const { data: container } = await supabase
                .from("containers")
                .select("id, available_space_cbm, total_space_cbm, provider_id")
                .eq("id", booking.container_id)
                .maybeSingle();

              if (container) {
                const allocated = booking.booking_mode === "partial"
                  ? Math.max(0, booking.allocated_cbm || 0)
                  : (container.total_space_cbm || 0);
                const newAvail = Math.max(0, (container.available_space_cbm ?? container.total_space_cbm ?? 0) - allocated);

                await supabase
                  .from("containers")
                  .update({ available_space_cbm: newAvail, status: newAvail <= 0 ? "full" : container.status })
                  .eq("id", container.id);

                try { await optimizeContainerFill(container.id); } catch (err) { console.warn("Optimize skipped", err); }

                // Notify provider/exporter
                try {
                  await createNotification({
                    user_id: container.provider_id,
                    message: `Container ${booking.container_number ?? ""} capacity updated`,
                    type: "container_allocated",
                  });
                } catch (err) {
                  console.error("Notification failed", err);
                }
              }
            }

          } catch (err) {
            console.error("Post-payment ops failed", err);
          }
          try {
            await ensureConversation(bookingId);
          } catch (convErr) {
            console.error("Failed to create conversation:", convErr);
          }

          // Notifications
          try {
            const { data: notifyBooking } = await supabase
              .from("bookings")
              .select("exporter_id, container_id")
              .eq("id", bookingId)
              .maybeSingle();
            let providerId: string | null = null;
            if (notifyBooking?.container_id) {
              const { data: providerRow } = await supabase
                .from("containers")
                .select("provider_id")
                .eq("id", notifyBooking.container_id)
                .maybeSingle();
              providerId = providerRow?.provider_id ?? null;
            }
            if (notifyBooking?.exporter_id) {
              await createNotification({
                user_id: notifyBooking.exporter_id,
                message: `Payment successful for booking ${bookingId}`,
                type: "payment_success",
              });
            }
            if (providerId) {
              await createNotification({
                user_id: providerId,
                message: `Payment received for booking ${bookingId}`,
                type: "payment_success",
              });
            }
          } catch (err) {
            console.error("Payment notifications failed", err);
          }
        } catch (dbErr) {
          console.error("DB operations failed, treating as offline:", dbErr);
          // Fallback: save status locally
          updateOfflineBooking(bookingId, { status: "paid" });
        }
        toast({
          title: "Payment successful!",
          description: `Payment ID: ${paymentId}`,
        });
      }

      // 3️⃣ Redirect to tracking
      navigate(`/tracking/${bookingId}`);
    } catch (err: any) {
      if (err?.message === "Payment cancelled by user") {
        toast({ title: "Payment cancelled", variant: "destructive" });
      } else {
        console.error("Payment error:", err);
        toast({ title: "Payment failed. Please try again.", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <DashboardLayout userType="exporter">
      <div className="max-w-md mx-auto mt-10 animate-scale-in-bounce">
        <Card className="gradient-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5" />
              Razorpay Payment
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="text-lg font-semibold">
              Amount: ₹ {amount.toLocaleString("en-IN")}
            </div>

            <p className="text-sm text-muted-foreground">
              Click below to pay securely via Razorpay (UPI, Card, Netbanking).
            </p>

            <Button
              className="w-full"
              onClick={handlePayment}
              disabled={loading || amount <= 0}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing…
                </>
              ) : (
                "Pay with Razorpay"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
