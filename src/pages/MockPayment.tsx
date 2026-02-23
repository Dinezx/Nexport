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
import { Loader2, CreditCard, IndianRupee } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  recordPayment,
  markBookingPaid,
  createTrackingEvents,
  ensureConversation,
} from "@/services/paymentService";

export default function MockPayment() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<"upi" | "card" | "netbanking">("upi");
  const [loading, setLoading] = useState(false);

  /* ---------------- FETCH BOOKING AMOUNT ---------------- */

  useEffect(() => {
    if (!bookingId) return;

    const fetchAmount = async () => {
      try {
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

    const txnId =
      "TXN-" +
      Math.random().toString(36).substring(2, 10).toUpperCase();

    try {
      // 1️⃣ Use payment service to record payment, update booking, and create tracking events
      await recordPayment({
        booking_id: bookingId,
        amount,
        currency: "INR",
        payment_method: method,
        transaction_ref: txnId,
      });

      // 2️⃣ Mark booking as paid
      await markBookingPaid(bookingId);

      // 3️⃣ Create tracking events
      await createTrackingEvents(bookingId);

      // 4️⃣ Ensure conversation is created for exporter-provider communication
      try {
        await ensureConversation(bookingId);
      } catch (convErr) {
        console.error("Failed to create conversation:", convErr);
        // Don't fail payment flow if conversation creation fails
      }

      toast({ title: "Payment successful!", variant: "default" });

      // 5️⃣ Redirect to tracking
      navigate(`/tracking/${bookingId}`);
    } catch (err) {
      console.error("Payment error:", err);
      toast({ title: "Payment failed. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <DashboardLayout userType="exporter">
      <div className="max-w-md mx-auto mt-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5" />
              Payment Gateway (Demo)
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="text-lg font-semibold">
              Amount: ₹ {amount.toLocaleString("en-IN")}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Select Payment Method</p>

              {["upi", "card", "netbanking"].map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m as any)}
                  className={`w-full p-3 rounded-lg border text-left ${
                    method === m
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted"
                  }`}
                >
                  <CreditCard className="inline h-4 w-4 mr-2" />
                  {m.toUpperCase()}
                </button>
              ))}
            </div>

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
                "Pay Now"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
