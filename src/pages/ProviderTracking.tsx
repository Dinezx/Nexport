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
import { getBookingDocuments } from "@/services/documentService";

/* ---------------- CONSTANTS ---------------- */

const TRACKING_STAGES = [
  { value: "booked", label: "Booked", description: "Booking confirmed." },
  { value: "payment_completed", label: "Payment Completed", description: "Payment received." },
  { value: "container_allocated", label: "Container Allocated", description: "Container assigned to booking." },
  { value: "cargo_received", label: "Cargo Received", description: "Cargo accepted at origin." },
  { value: "loaded_on_vessel", label: "Loaded on Vessel", description: "Cargo loaded onto vessel." },
  { value: "in_transit", label: "In Transit", description: "Shipment is on the way." },
  { value: "arrived_destination", label: "Arrived Destination", description: "Shipment reached destination port." },
  { value: "delivered", label: "Delivered", description: "Shipment delivered." },
];

/* ---------------- TYPES ---------------- */

type Booking = {
  id: string;
  origin: string;
  destination: string;
  transport_mode: string;
  status: string;
  exporter_id?: string;
  provider_id?: string;
};

export default function ProviderTracking() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { toast } = useToast();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
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
        try {
          const docs = await getBookingDocuments(b.id);
          setDocuments(docs);
        } catch (err) {
          console.error("Document fetch failed", err);
        }
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
      await import("@/services/shipmentService").then(({ updateShipmentStatus }) =>
        updateShipmentStatus(bookingId, bookingStatusValue as any, {
          exporterId: (booking as any)?.exporter_id,
          providerId: (booking as any)?.provider_id,
        })
      );

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
  // Normalize and dedupe events for display
  const normalizedEvents = events.map((e) => {
    const title = (e.title || "").trim().toLowerCase();
    if (title === "payment completed") {
      return { ...e, status: "completed" };
    }
    return e;
  });

  const hasPaymentEvent = normalizedEvents.some(
    (e) => (e.title || "").trim().toLowerCase() === "payment completed",
  );

  const withPayment =
    (booking?.status === "paid" || booking?.status === "payment_completed") && !hasPaymentEvent
      ? [
          ...normalizedEvents,
          {
            id: `${bookingId}-payment`,
            title: "Payment completed",
            description: "Payment completed",
            status: "completed",
            location: "System",
          } as TrackingEvent,
        ]
      : normalizedEvents;

  const dedupedEvents = (() => {
    const seen = new Map<string, TrackingEvent>();
    for (const e of withPayment) {
      const key = (e.title || "").trim().toLowerCase();
      const existing = seen.get(key);
      const isCompleted = e.status === "completed";
      const existingCompleted = existing?.status === "completed";
      const createdNew = (e as any).created_at ? new Date((e as any).created_at).getTime() : 0;
      const createdExisting = (existing as any)?.created_at ? new Date((existing as any).created_at).getTime() : 0;

      const shouldReplace =
        !existing ||
        (isCompleted && !existingCompleted) ||
        createdNew > createdExisting;

      if (shouldReplace) seen.set(key, e);
    }
    return Array.from(seen.values());
  })();

  const existingTitles = new Set(dedupedEvents.map((e) => e.title));
  const availableStages = TRACKING_STAGES.filter((s) => !existingTitles.has(s.label));

  const docTypes = [
    { key: "invoice", label: "Invoice" },
    { key: "packing_list", label: "Packing List" },
    { key: "bill_of_lading", label: "Bill Of Lading" },
    { key: "customs", label: "Customs" },
  ] as const;

  const docsByType = documents.reduce<Record<string, any>>((acc, doc) => {
    const pathParts = (doc.path || "").split("/");
    const nameParts = (doc.name || "").split("/");
    const key = (pathParts[1] || nameParts[0]) as string;
    acc[key] = doc;
    return acc;
  }, {});

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
                        <SelectItem value="booked">Booked</SelectItem>
                        <SelectItem value="payment_completed">Payment Completed</SelectItem>
                        <SelectItem value="container_allocated">Container Allocated</SelectItem>
                        <SelectItem value="cargo_received">Cargo Received</SelectItem>
                        <SelectItem value="loaded_on_vessel">Loaded on Vessel</SelectItem>
                        <SelectItem value="in_transit">In Transit</SelectItem>
                        <SelectItem value="arrived_destination">Arrived Destination</SelectItem>
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
                {dedupedEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tracking events yet.</p>
                ) : (
                  <div className="space-y-4">
                    {dedupedEvents.map((ev) => (
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

            {/* Shipping Documents (view-only) */}
            <Card>
              <CardHeader>
                <CardTitle>Shipping Documents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {docTypes.map(({ key, label }) => {
                    const doc = docsByType[key];
                    return (
                      <div key={key} className="flex items-start justify-between gap-3 rounded-md border px-3 py-2">
                        <div className="flex flex-col gap-1 text-left">
                          <span className="text-sm font-medium">{label}</span>
                          <span className="text-xs text-muted-foreground">
                            {doc?.displayName || doc?.name || "Not uploaded"}
                          </span>
                          {doc?.created_at && (
                            <span className="text-[11px] text-muted-foreground">Uploaded {new Date(doc.created_at).toLocaleString()}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {doc?.url && (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs font-semibold text-primary underline"
                            >
                              View
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {documents.length > 0 ? (
                  <div className="space-y-2 text-sm">
                    {documents.map((doc) => (
                      <a
                        key={doc.path}
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between border rounded-md px-3 py-2 hover:bg-muted/50"
                      >
                        <span>{doc.name}</span>
                        <span className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleString()}</span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
