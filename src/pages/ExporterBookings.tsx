import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, ArrowRight, MessageSquare, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  openRazorpayCheckout,
  recordPayment,
  markBookingPaid,
  createTrackingEvents,
  ensureConversation,
  releaseBookingHold,
} from "@/services/paymentService";

/* ---------------- Types ---------------- */

type Booking = {
  id: string;
  origin: string;
  destination: string;
  transport_mode: string;
  container_type: string;
  container_size: string;
  booking_mode: string;
  space_cbm: number | null;
  price: number | null; // ✅ ONLY price (NO price_inr)
  status: string;
  created_at: string;
};

/* ---------------- Component ---------------- */

export default function ExporterBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  /* ---------------- Fetch Bookings ---------------- */

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setError("User not authenticated");
          return;
        }

        setUserEmail(user.email ?? "");

        const { data, error } = await supabase
          .from("bookings")
          .select("*")
          .eq("exporter_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        setBookings(data ?? []);
      } catch (err) {
        console.error(err);
        setError("Failed to load bookings");
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  /* ---------------- RAZORPAY PAYMENT ---------------- */

  const handleRazorpayPayment = async (bookingId: string, amount: number) => {
    if (payingId) return; // prevent double-clicks
    setPayingId(bookingId);

    try {
      // 1️⃣ Open Razorpay Checkout (no async before this so popup isn't blocked)
      const rzpResponse = await openRazorpayCheckout({
        amount,
        bookingId,
        customerEmail: userEmail,
      });

      // 2️⃣ Payment successful — record in DB
      await recordPayment({
        booking_id: bookingId,
        amount,
        currency: "INR",
        payment_method: "razorpay",
        transaction_ref: rzpResponse.razorpay_payment_id,
      });

      // 3️⃣ Mark booking as paid
      await markBookingPaid(bookingId);

      // 4️⃣ Create tracking events
      await createTrackingEvents(bookingId);

      // 5️⃣ Container space was already reserved at booking creation time (pending_payment hold)
      // No need to deduct again — just ensure conversation exists

      // 6️⃣ Ensure conversation is created
      try {
        await ensureConversation(bookingId);
      } catch (convErr) {
        console.error("Failed to create conversation:", convErr);
      }

      // 7️⃣ Update UI
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId ? { ...b, status: "paid" } : b
        )
      );

      toast({ title: "Payment successful!", description: `Payment ID: ${rzpResponse.razorpay_payment_id}` });

      // 8️⃣ Navigate to tracking
      navigate(`/tracking/${bookingId}`);
    } catch (err: any) {
      if (err?.message === "Payment cancelled by user") {
        toast({ title: "Payment cancelled", variant: "destructive" });
      } else {
        console.error("Payment failed", err);
        toast({ title: "Payment failed. Please try again.", variant: "destructive" });
      }
    } finally {
      setPayingId(null);
    }
  };

  /* ---------------- CANCEL BOOKING (release hold) ---------------- */

  const handleCancelBooking = async (bookingId: string) => {
    if (cancellingId) return;
    if (!confirm("Cancel this booking? The reserved container space will be released.")) return;

    setCancellingId(bookingId);
    try {
      await releaseBookingHold(bookingId);

      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId ? { ...b, status: "cancelled" } : b
        )
      );

      toast({ title: "Booking cancelled. Container space released." });
    } catch (err: any) {
      console.error("Cancel failed", err);
      toast({ title: err?.message || "Failed to cancel booking", variant: "destructive" });
    } finally {
      setCancellingId(null);
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <DashboardLayout userType="exporter">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">My Bookings</h1>
          <Button asChild>
            <Link to="/booking">New Booking</Link>
          </Button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-destructive font-medium">{error}</p>
        )}

        {/* Empty */}
        {!loading && bookings.length === 0 && (
          <p className="text-muted-foreground">
            No bookings found. Create your first booking.
          </p>
        )}

        {/* Booking List */}
        <div className="grid gap-4">
          {bookings.map((b) => (
            <Card key={b.id}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span className="font-mono text-sm">
                    BK-{b.id.slice(0, 8).toUpperCase()}
                  </span>
                  <Badge variant="secondary" className="capitalize">
                    {b.status}
                  </Badge>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-2">
                {/* Route */}
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4" />
                  {b.origin} → {b.destination}
                </div>

                {/* Transport & Container */}
                <div className="text-sm text-muted-foreground">
                  {b.transport_mode?.toUpperCase()} ·{" "}
                  {b.container_type} · {b.container_size}
                </div>

                {/* Booking Mode */}
                <div className="text-sm">
                  Booking Mode:{" "}
                  <b className="capitalize">{b.booking_mode}</b>
                  {b.booking_mode === "partial" && b.space_cbm && (
                    <> · {b.space_cbm} CBM</>
                  )}
                </div>

                {/* Price & Actions */}
                <div className="flex justify-between items-center pt-2">
                  <div className="font-semibold text-primary">
                    {b.price !== null
                      ? `₹ ${b.price.toLocaleString("en-IN")}`
                      : "Payment pending"}
                  </div>

                  <div className="flex gap-2">
                    {b.status === "pending_payment" && b.price !== null && (
                      <>
                        <Button
                          size="sm"
                          disabled={payingId === b.id}
                          onClick={() =>
                            handleRazorpayPayment(b.id, b.price!)
                          }
                        >
                          {payingId === b.id ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Paying…</>
                          ) : (
                            "Pay Now"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={cancellingId === b.id}
                          onClick={() => handleCancelBooking(b.id)}
                        >
                          {cancellingId === b.id ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Cancelling…</>
                          ) : (
                            <><X className="h-4 w-4 mr-1" /> Cancel</>
                          )}
                        </Button>
                      </>
                    )}

                    {b.status === "paid" && (
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/chat?booking=${b.id}`}>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Chat
                        </Link>
                      </Button>
                    )}

                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/tracking/${b.id}`}>
                        Track
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
