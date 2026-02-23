import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, MapPin, MessageSquare, CheckCircle2, Circle, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  upsertLiveLocation,
  insertTrackingEvent,
  fetchTrackingCore,
  type TrackingEvent,
} from "@/services/trackingService";

/* ---------------- CONSTANTS ---------------- */

const TRACKING_STAGES = [
  { value: "booking_confirmed", label: "Booking Confirmed", description: "Payment received and booking confirmed." },
  { value: "container_assigned", label: "Container Assigned", description: "Container has been assigned to this booking." },
  { value: "awaiting_pickup", label: "Awaiting Pickup", description: "Waiting for cargo pickup." },
  { value: "cargo_picked_up", label: "Cargo Picked Up", description: "Cargo has been picked up." },
  { value: "in_transit", label: "In Transit", description: "Shipment is on the way." },
  { value: "at_customs", label: "At Customs", description: "Shipment is being processed at customs." },
  { value: "customs_cleared", label: "Customs Cleared", description: "Shipment has cleared customs." },
  { value: "out_for_delivery", label: "Out for Delivery", description: "Shipment is out for final delivery." },
  { value: "delivered", label: "Delivered", description: "Shipment has been delivered successfully." },
];

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
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [selectedStage, setSelectedStage] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updatingBookingStatus, setUpdatingBookingStatus] = useState(false);
  const [bookingStatusValue, setBookingStatusValue] = useState("");

  /* ---------------- FETCH BOOKING + EVENTS ---------------- */

  useEffect(() => {
    if (!bookingId) return;

    const load = async () => {
      try {
        const { booking: b, events: ev } = await fetchTrackingCore(bookingId);
        setBooking(b as Booking);
        setEvents(ev);
        setBookingStatusValue(b.status);
      } catch (err) {
        console.error("Failed to fetch booking:", err);
        toast({ title: "Failed to load booking", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [bookingId, toast]);

  /* ---------------- ADD TRACKING EVENT  ---------------- */

  const handleAddEvent = async () => {
    if (!bookingId || !selectedStage) return;
    setUpdating(true);

    const stage = TRACKING_STAGES.find((s) => s.value === selectedStage);
    if (!stage) return;

    try {
      await insertTrackingEvent({
        booking_id: bookingId,
        title: stage.label,
        description: stage.description,
        status: "completed",
        location: booking?.origin ?? "System",
      });

      // Refresh events
      const { events: updatedEvents } = await fetchTrackingCore(bookingId);
      setEvents(updatedEvents);
      setSelectedStage("");

      toast({ title: `Tracking updated: ${stage.label}` });
    } catch (err) {
      console.error("Failed to add tracking event:", err);
      toast({ title: "Failed to update tracking", variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  /* ---------------- UPDATE BOOKING STATUS  ---------------- */

  const handleUpdateBookingStatus = async () => {
    if (!bookingId || !bookingStatusValue) return;
    setUpdatingBookingStatus(true);

    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: bookingStatusValue })
        .eq("id", bookingId);

      if (error) throw error;

      setBooking((prev) => prev ? { ...prev, status: bookingStatusValue } : prev);
      toast({ title: `Booking status updated to "${bookingStatusValue}"` });
    } catch (err) {
      console.error("Failed to update booking status:", err);
      toast({ title: "Failed to update booking status", variant: "destructive" });
    } finally {
      setUpdatingBookingStatus(false);
    }
  };

  /* ---------------- UPDATE GPS LOCATION  ------------ */

  const handleUpdateGPS = async () => {
    if (!bookingId) return;

    // Use browser geolocation
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported", variant: "destructive" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await upsertLiveLocation({
            booking_id: bookingId,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          toast({ title: "GPS location updated!" });
        } catch (err) {
          console.error("GPS update failed:", err);
          toast({ title: "Failed to update GPS", variant: "destructive" });
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        toast({ title: "Could not get your location. Please allow location access.", variant: "destructive" });
      }
    );
  };

  /* ---------------- EXISTING EVENT TITLES (to filter dropdown) ------ */
  const existingTitles = new Set(events.map((e) => e.title));
  const availableStages = TRACKING_STAGES.filter((s) => !existingTitles.has(s.label));

  /* ---------------- UI ---------------- */

  return (
    <DashboardLayout userType="provider">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Update Shipment Tracking</h1>

        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {booking && (
          <>
            {/* Booking Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>Shipment Details</span>
                  <Badge variant="secondary" className="capitalize">{booking.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {booking.origin} → {booking.destination}
                </div>
                <p className="text-muted-foreground">
                  Transport: {booking.transport_mode?.toUpperCase()}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  Booking ID: {booking.id.slice(0, 8).toUpperCase()}
                </p>
                <div className="pt-2 flex gap-2">
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

            {/* Update Booking Status */}
            <Card>
              <CardHeader>
                <CardTitle>Update Booking Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Select value={bookingStatusValue} onValueChange={setBookingStatusValue}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="in_transit">In Transit</SelectItem>
                        <SelectItem value="at_customs">At Customs</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleUpdateBookingStatus}
                    disabled={updatingBookingStatus || !bookingStatusValue}
                  >
                    {updatingBookingStatus ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Updating…</>
                    ) : (
                      "Update Status"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Add Tracking Event */}
            <Card>
              <CardHeader>
                <CardTitle>Add Tracking Update</CardTitle>
              </CardHeader>
              <CardContent>
                {availableStages.length > 0 ? (
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <Select value={selectedStage} onValueChange={setSelectedStage}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select tracking stage" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableStages.map((stage) => (
                            <SelectItem key={stage.value} value={stage.value}>
                              {stage.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleAddEvent}
                      disabled={updating || !selectedStage}
                    >
                      {updating ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Adding…</>
                      ) : (
                        "Add Update"
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">All tracking stages have been added.</p>
                )}
              </CardContent>
            </Card>

            {/* Update GPS */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Live GPS Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Share your current location so the exporter can track the shipment in real time.
                </p>
                <Button onClick={handleUpdateGPS} variant="outline">
                  <MapPin className="h-4 w-4 mr-2" />
                  Update My GPS Location
                </Button>
              </CardContent>
            </Card>

            {/* Current Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Current Tracking Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tracking events yet.</p>
                ) : (
                  <div className="space-y-4">
                    {events.map((ev, i) => (
                      <div key={ev.id} className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {ev.status === "completed" ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{ev.title}</p>
                          <p className="text-xs text-muted-foreground">{ev.description}</p>
                          {ev.location && ev.location !== "System" && (
                            <p className="text-xs text-muted-foreground">{ev.location}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
