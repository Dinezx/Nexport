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
import { Loader2, MapPin, ArrowRight, MessageSquare, Truck } from "lucide-react";
import { Link } from "react-router-dom";

/* ---------------- Types ---------------- */

type ProviderBooking = {
  id: string;
  origin: string;
  destination: string;
  transport_mode: string;
  container_type: string;
  container_size: string;
  booking_mode: string;
  space_cbm: number | null;
  price: number | null;
  status: string;
  created_at: string;
};

/* ---------------- Component ---------------- */

export default function ProviderBookings() {
  const [bookings, setBookings] = useState<ProviderBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ---------------- Fetch Bookings for Provider's Containers ---------------- */

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

        // Get all containers owned by this provider
        const { data: containers, error: contErr } = await supabase
          .from("containers")
          .select("id")
          .eq("provider_id", user.id);

        if (contErr) throw contErr;

        if (!containers || containers.length === 0) {
          setBookings([]);
          setLoading(false);
          return;
        }

        const containerIds = containers.map((c) => c.id);

        // Get all bookings for these containers
        const { data, error } = await supabase
          .from("bookings")
          .select("*")
          .in("container_id", containerIds)
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

  /* ---------------- UI ---------------- */

  const statusColor = (status: string) => {
    switch (status) {
      case "paid":
      case "confirmed":
        return "default";
      case "in_transit":
        return "outline";
      case "delivered":
        return "secondary";
      case "cancelled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  return (
    <DashboardLayout userType="provider">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Bookings on My Containers</h1>
            <p className="text-muted-foreground text-sm mt-1">
              View and update tracking for all bookings made on your containers.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/provider-containers">
              Manage Containers
            </Link>
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
            No bookings found on your containers yet.
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
                  <Badge variant={statusColor(b.status) as any} className="capitalize">
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
                      : "—"}
                  </div>

                  <div className="flex gap-2">
                    {b.status === "paid" || b.status === "confirmed" || b.status === "in_transit" || b.status === "at_customs" ? (
                      <Button size="sm" asChild>
                        <Link to={`/provider/tracking/${b.id}`}>
                          <Truck className="mr-2 h-4 w-4" />
                          Update Tracking
                        </Link>
                      </Button>
                    ) : null}

                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/chat?booking=${b.id}`}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Chat
                      </Link>
                    </Button>

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
