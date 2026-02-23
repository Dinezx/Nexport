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
import { Loader2, MapPin, ArrowRight, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

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

  /* ---------------- DEMO PAYMENT ---------------- */

  const handleDemoPayment = async (bookingId: string, amount: number) => {
    try {
      // 1️⃣ Insert payment record
      const { error: paymentError } = await supabase
        .from("payments")
        .insert({
          booking_id: bookingId,
          amount: amount,
          currency: "INR",
          payment_status: "paid",
          provider: "demo",
        });

      if (paymentError) throw paymentError;

      // 2️⃣ Update booking status
      const { error: bookingError } = await supabase
        .from("bookings")
        .update({ status: "paid" })
        .eq("id", bookingId);

      if (bookingError) throw bookingError;

      // 3️⃣ Update container space if partial booking
      const { data: bookingData } = await supabase
        .from("bookings")
        .select("selected_container_id, space_cbm")
        .eq("id", bookingId)
        .single();

      if (bookingData?.selected_container_id && bookingData?.space_cbm) {
        // First get current container data
        const { data: containerData } = await supabase
          .from("containers")
          .select("available_space_cbm")
          .eq("id", bookingData.selected_container_id)
          .single();

        if (containerData) {
          const newAvailableSpace = Math.max(0, containerData.available_space_cbm - bookingData.space_cbm);
          const newStatus = newAvailableSpace === 0 ? "full" : "available";

          const { error: containerError } = await supabase
            .from("containers")
            .update({
              available_space_cbm: newAvailableSpace,
              status: newStatus
            })
            .eq("id", bookingData.selected_container_id);

          if (containerError) console.error("Failed to update container space", containerError);
        }
      }

      // 4️⃣ Update UI instantly
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId ? { ...b, status: "paid" } : b
        )
      );
    } catch (err) {
      console.error("Payment failed", err);
      alert("Payment failed");
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
                    {b.status !== "paid" && b.price !== null && (
                      <Button
                        size="sm"
                        onClick={() =>
                          handleDemoPayment(b.id, b.price!)
                        }
                      >
                        Pay Now
                      </Button>
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
