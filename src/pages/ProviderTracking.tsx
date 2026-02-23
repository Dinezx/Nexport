import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { buildRoutePoints, buildTrackingEvent } from "@/lib/routeSimulation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, MapPin, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  upsertLiveLocation,
  insertTrackingEvent,
} from "@/services/trackingService";

/* ---------------- TYPES ---------------- */

type Booking = {
  id: string;
  origin: string;
  destination: string;
  transport_mode: string;
  status: string;
};

export default function ProviderTracking() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { toast } = useToast();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  /* ---------------- FETCH BOOKING ---------------- */

  useEffect(() => {
    if (!bookingId) return;

    const fetchBooking = async () => {
      try {
        const { data, error } = await supabase
          .from("bookings")
          .select("id, origin, destination, transport_mode, status")
          .eq("id", bookingId)
          .single();

        if (error) throw error;
        setBooking(data);
      } catch (err) {
        console.error("Failed to fetch booking:", err);
        toast({ title: "Failed to load booking", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [bookingId, toast]);

  /* ---------------- AUTO GPS UPDATE ------------ */

  useEffect(() => {
    if (!bookingId || !booking) return;

    const points = buildRoutePoints(booking.origin, booking.destination, 10);
    let index = 0;

    const interval = setInterval(async () => {
      try {
        const point = points[Math.min(index, points.length - 1)];
        const progress = Math.round((index / (points.length - 1)) * 100);
        const trackingEvent = buildTrackingEvent(progress);

        setGps({ lat: point.lat, lng: point.lng });
        setLastUpdated(new Date());

        // Update live GPS location using tracking service
        await upsertLiveLocation({
          booking_id: bookingId,
          lat: point.lat,
          lng: point.lng,
        });

        // Insert tracking event using service
        await insertTrackingEvent({
          booking_id: bookingId,
          title: trackingEvent.title,
          description: trackingEvent.description,
          status: trackingEvent.status,
          location: trackingEvent.location,
        });

        index += 1;
        if (index >= points.length) {
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Failed to update tracking:", err);
        clearInterval(interval);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [bookingId, booking]);

  /* ---------------- UI ---------------- */

  return (
    <DashboardLayout userType="provider">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Provider Live Tracking</h1>

        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {booking && (
          <Card>
            <CardHeader>
              <CardTitle>Shipment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {booking.origin} → {booking.destination}
              </div>
              <p className="text-muted-foreground">
                Transport: {booking.transport_mode.toUpperCase()}
              </p>
              <p>
                Status: <b>{booking.status}</b>
              </p>
              <div className="pt-2">
                <Link
                  to={`/chat?booking=${booking.id}`}
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <MessageSquare className="h-4 w-4" />
                  Chat with Exporter
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {gps && (
          <Card>
            <CardHeader>
              <CardTitle>Live GPS (Auto)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <b>Latitude:</b> {gps.lat.toFixed(5)}
              </p>
              <p>
                <b>Longitude:</b> {gps.lng.toFixed(5)}
              </p>
              {lastUpdated && (
                <p className="text-xs text-muted-foreground">
                  Updated at: {lastUpdated.toLocaleTimeString()}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
