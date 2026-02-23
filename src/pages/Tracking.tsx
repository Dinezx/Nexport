import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "@/lib/leafletFix";
import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, MapPin, CheckCircle, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  fetchTrackingCore,
  subscribeTrackingEvents,
  fetchLiveLocation,
} from "@/services/trackingService";
import { buildRoutePoints } from "@/lib/routeSimulation";
import { lookupKnownLocation } from "@/lib/routeSimulation";

/* ---------------- TYPES ---------------- */

type Booking = {
  id: string;
  origin: string;
  destination: string;
  transport_mode: string;
  status: string;
  eta_days?: number | null;
  eta_confidence?: string | null;
};

type TrackingEvent = {
  id: string;
  title: string;
  description: string;
  status: string;
  location: string;
};

type GPS = {
  lat: number;
  lng: number;
};

type RoutePoint = GPS & { label: string; address?: string };

/* ---------------- COMPONENT ---------------- */

export default function Tracking() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { toast } = useToast();
  const debugMap = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debugMap") === "1";

  const [booking, setBooking] = useState<Booking | null>(null);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [gps, setGps] = useState<GPS | null>(null);
  const [routeCoords, setRouteCoords] = useState<RoutePoint[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const timelineOrder = [
    "Booking Confirmed",
    "Container Assigned",
    "Awaiting Pickup",
    "Cargo Picked Up",
    "In Transit",
  ];

  const orderedEvents = events
    .filter((e, i, arr) => arr.findIndex((x) => x.title === e.title) === i)
    .map((e, idx) => ({ e, idx }))
    .sort((a, b) => {
      const aDone = a.e.status === "completed";
      const bDone = b.e.status === "completed";
      if (aDone !== bDone) return aDone ? -1 : 1;

      const aOrder = timelineOrder.findIndex(
        (t) => t.toLowerCase() === a.e.title.toLowerCase()
      );
      const bOrder = timelineOrder.findIndex(
        (t) => t.toLowerCase() === b.e.title.toLowerCase()
      );
      const aRank = aOrder === -1 ? Number.MAX_SAFE_INTEGER : aOrder;
      const bRank = bOrder === -1 ? Number.MAX_SAFE_INTEGER : bOrder;
      if (aRank !== bRank) return aRank - bRank;

      return a.idx - b.idx;
    })
    .map((x) => x.e);

  // 🚫 stop polling if forbidden
  const gpsBlocked = useRef(false);

  /* ---------- LOAD BOOKING + TIMELINE ---------- */

  useEffect(() => {
    if (!bookingId) return;

    const loadCore = async () => {
      try {
        setLoading(true);

        const { booking: bookingData, events: timelineEvents } = await fetchTrackingCore(bookingId);
        
        if (bookingData) {
          setBooking(bookingData);
        }
        
        if (timelineEvents) {
          setEvents(timelineEvents);
        }
      } catch (e) {
        console.error(e);
        toast({ title: "Failed to load tracking data", variant: "destructive" });
        setError("Failed to load tracking data");
      } finally {
        setLoading(false);
      }
    };

    loadCore();
  }, [bookingId, toast]);

  /* ---------- REALTIME TRACKING EVENTS ---------- */

  useEffect(() => {
    if (!bookingId) return;

    const channel = subscribeTrackingEvents(
      bookingId,
      (newEvent: TrackingEvent) => {
        setEvents((prev) => [...prev, newEvent]);
      }
    );

    return () => {
      channel?.unsubscribe();
    };
  }, [bookingId]);

  /* ---------- GEOCODE ORIGIN/DEST (fallback map) ---------- */

  useEffect(() => {
    if (!booking || gps) return;

    const geocode = async (q: string): Promise<GPS | null> => {
      // Try progressively simpler queries with Nominatim
      const queries = [
        q,
        q.replace(/\s*ICD\b/i, ""),  // Remove "ICD" which Nominatim may not understand
        q.replace(/,\s*[^,]+$/, "").replace(/\s*ICD\b/i, ""), // City only, no country/ICD
      ].filter((v, i, a) => a.indexOf(v) === i); // deduplicate

      for (const query of queries) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`,
            { headers: { "User-Agent": "NEXPORT/1.0 (nexport-tracking@app.com)" } }
          );
          const json = await res.json();
          if (json && json.length > 0) {
            return { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) };
          }
          // Brief delay between retries to respect rate limit
          await new Promise((r) => setTimeout(r, 1100));
        } catch (e) {
          console.error("Geocoding failed for query:", query, e);
        }
      }

      // Fallback: known location database
      const known = lookupKnownLocation(q);
      if (known) {
        console.info(`Using known location for "${q}":`, known);
        return known;
      }

      return null;
    };

    (async () => {
      const o = booking.origin;
      const d = booking.destination;
      // Sequential requests to respect Nominatim 1 req/s rate limit
      const oc = await geocode(o);
      await new Promise((r) => setTimeout(r, 1100));
      const dc = await geocode(d);
      const coords: RoutePoint[] = [];
      if (oc) coords.push({ ...oc, label: "Origin", address: o });
      if (dc) coords.push({ ...dc, label: "Destination", address: d });

      // If geocoding failed, fall back to simulated route points
      if (coords.length === 0) {
        console.warn("Nominatim geocoding failed, using simulated route");
        const simPoints = buildRoutePoints(o, d, 1);
        if (simPoints.length >= 2) {
          coords.push({ ...simPoints[0], label: "Origin", address: o });
          coords.push({ ...simPoints[simPoints.length - 1], label: "Destination", address: d });
        }
      }

      console.debug("Geocoded route coords:", coords);
      setRouteCoords(coords);
    })();
  }, [booking, gps]);

  /* ---------- LOAD GPS (SAFE MODE) ---------- */

  useEffect(() => {
    if (!bookingId) return;

    const loadGps = async () => {
      if (gpsBlocked.current) return;

      try {
        const data = await fetchLiveLocation(bookingId);
        if (data) {
          setGps({ lat: data.lat, lng: data.lng });
          console.debug("Live GPS:", { lat: data.lat, lng: data.lng });
        }
      } catch (err: any) {
        // ❗ STOP future polling only if explicitly forbidden by RLS
        if (err?.code === "42501") {
          gpsBlocked.current = true;
        }
        return;
      }
    };

    loadGps();
    const interval = setInterval(loadGps, 5000);
    return () => clearInterval(interval);
  }, [bookingId]);

  /* ---------------- UI ---------------- */

  return (
    <DashboardLayout userType="exporter">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Shipment Tracking</h1>

        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {error && <p className="text-destructive">{error}</p>}

        {/* ROUTE */}
        {booking && (
          <Card>
            <CardHeader>
              <CardTitle>Route</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {booking.origin} → {booking.destination}
              </div>
              <p>Transport: {booking.transport_mode.toUpperCase()}</p>
              <p>Status: <b>{booking.status}</b></p>
              {booking.eta_days && (
                <p>
                  <b>AI ETA:</b> {booking.eta_days} days
                  <span className="ml-1 text-xs">
                    ({booking.eta_confidence})
                  </span>
                </p>
              )}
              <div className="pt-2">
                <Link
                  to={`/chat?booking=${booking.id}`}
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <MessageSquare className="h-4 w-4" />
                  Chat with Provider
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* GPS MAP (ONLY IF ALLOWED) */}
        {gps && (
          <Card>
            <CardHeader>
              <CardTitle>Live GPS Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] rounded-lg overflow-hidden">
                <MapContainer
                  center={[gps.lat, gps.lng]}
                  zoom={6}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[gps.lat, gps.lng]}>
                    <Popup>
                      Container Location<br />
                      {gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* DEBUG MAP (use ?debugMap=1) - helps verify Leaflet + tiles + CSS */}
        {debugMap && (
          <Card>
            <CardHeader>
              <CardTitle>Debug Map</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] rounded-lg overflow-hidden">
                <MapContainer center={[20, 0]} zoom={2} style={{ height: "100%", width: "100%" }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                </MapContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* FALLBACK MAP: show origin/destination route if live GPS missing */}
        {!gps && routeCoords.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Route Map</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] rounded-lg overflow-hidden">
                {routeCoords.length === 1 ? (
                  <MapContainer
                    center={[routeCoords[0].lat, routeCoords[0].lng]}
                    zoom={8}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {routeCoords.map((c, i) => (
                      <Marker key={i} position={[c.lat, c.lng]}>
                        <Popup>
                          <b>{c.label}</b>
                          <br />
                          {c.address || (i === 0 ? booking?.origin : booking?.destination)}
                          <br />
                          <small className="text-xs text-muted-foreground">{c.lat.toFixed(6)}, {c.lng.toFixed(6)}</small>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                ) : (
                  <MapContainer
                    bounds={routeCoords.map((c) => [c.lat, c.lng] as [number, number])}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {routeCoords.map((c, i) => (
                      <Marker key={i} position={[c.lat, c.lng]}>
                        <Popup>
                          <b>{c.label}</b>
                          <br />
                          {c.address || (i === 0 ? booking?.origin : booking?.destination)}
                          <br />
                          <small className="text-xs text-muted-foreground">{c.lat.toFixed(6)}, {c.lng.toFixed(6)}</small>
                        </Popup>
                      </Marker>
                    ))}
                    {routeCoords.length > 1 && (
                      <Polyline
                        positions={routeCoords.map((c) => [c.lat, c.lng] as [number, number])}
                        pathOptions={{ color: "#2563eb" }}
                      />
                    )}
                  </MapContainer>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* TIMELINE (ALWAYS VISIBLE) */}
        <Card>
          <CardHeader>
            <CardTitle>Tracking Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {events.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No tracking updates yet
              </p>
            )}

            {orderedEvents.map((e) => (
              <div key={e.id} className="flex gap-3 border-l-2 pl-4">
                <CheckCircle
                  className={
                    e.status === "completed"
                      ? "text-green-500"
                      : "text-muted-foreground"
                  }
                />
                <div>
                  <p className="font-medium">{e.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {e.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {e.location}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
