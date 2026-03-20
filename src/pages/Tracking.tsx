import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from "react-leaflet";
import "@/lib/leafletFix";
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { useParams, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MapPin, CheckCircle, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchTrackingCore, subscribeTrackingEvents, fetchLiveLocation } from "@/services/trackingService";
import { buildModeRoutePoints, lookupKnownLocation } from "@/lib/routeSimulation";
import { supabase } from "@/lib/supabase";
import { uploadDocument, getBookingDocuments, type DocumentType } from "@/services/documentService";
import { submitProviderReview } from "@/services/providerReviewService";

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
  const [gps, setGps] = useState<(GPS & { timestamp?: string }) | null>(null);
  const [displayGps, setDisplayGps] = useState<(GPS & { timestamp?: string }) | null>(null);
  const [livePath, setLivePath] = useState<GPS[]>([]);
  const [routeCoords, setRouteCoords] = useState<RoutePoint[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [routeSource, setRouteSource] = useState<"ors" | "mode" | "simulated" | "none">("none");
  const orsKey = import.meta.env.VITE_ORS_API_KEY as string | undefined;
  const aviationKey = import.meta.env.VITE_AVIATIONSTACK_API_KEY as string | undefined;

  const airMarkerIcon = useMemo(() => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="18" fill="#0ea5e9" stroke="#0284c7" stroke-width="2" />
        <path d="M8 22l24-6-24-6 6 6-6 6z" fill="#ffffff" />
      </svg>
    `;
    const iconUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    return L.icon({
      iconUrl,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -18],
    });
  }, []);

  const mapMarkerIcon = useMemo(() => {
    const mode = (booking?.transport_mode || "").toLowerCase();
    if (mode.includes("air")) return airMarkerIcon;
    return undefined;
  }, [airMarkerIcon, booking?.transport_mode]);

  type DocType = DocumentType;
  const docTypes: { key: DocType; label: string }[] = [
    { key: "invoice", label: "Invoice" },
    { key: "packing_list", label: "Packing List" },
    { key: "bill_of_lading", label: "Bill Of Lading" },
    { key: "customs", label: "Customs" },
  ];

  const routeStyle = (mode?: string) => {
    const m = (mode || "").toLowerCase();
    if (m === "air") return { color: "#f97316", weight: 3, dashArray: "6 6" }; // dashed orange
    if (m === "sea" || m === "ocean" || m === "ship") return { color: "#0ea5e9", weight: 4 }; // solid blue
    if (m === "rail" || m === "railway" || m === "train") return { color: "#6366f1", weight: 3, dashArray: "2 8" }; // dotted purple
    if (m === "road" || m === "truck") return { color: "#16a34a", weight: 4, dashArray: "10 6" }; // dashed green
    return { color: "#2563eb", weight: 3 }; // default blue
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const timelineOrder = [
    "Payment completed",
    "Booking Confirmed",
    "Container Assigned",
    "Awaiting Pickup",
    "Cargo Picked Up",
    "In Transit",
    "Delivered",
  ];

  const normalizedEvents = events.map((e) => {
    const title = (e.title || "").trim().toLowerCase();
    // Force payment event completed when booking is paid
    if (title === "payment completed") {
      // Mark payment step completed once it exists, regardless of event status value
      if (booking?.status === "paid" || booking?.status === "payment_completed") {
        return { ...e, status: "completed" };
      }
      return { ...e, status: "completed" };
    }
    if (title === "delivered") {
      return { ...e, status: "completed" };
    }
    // If the event already has status completed, keep it; otherwise fall back to original
    return e;
  });

  // Inject a payment completed event if booking is paid but the event is missing
  const hasPaymentEvent = normalizedEvents.some(
    (e) => (e.title || "").trim().toLowerCase() === "payment completed"
  );
  const hasDeliveredEvent = normalizedEvents.some(
    (e) => (e.title || "").trim().toLowerCase() === "delivered",
  );

  const eventsWithPayment =
    (booking?.status === "paid" || booking?.status === "payment_completed") && !hasPaymentEvent
      ? [
          ...normalizedEvents,
          {
            id: `${bookingId}-payment`,
            title: "Payment completed",
            description: "Payment completed",
            status: "completed",
            location: "System",
          },
        ]
      : normalizedEvents;

  const eventsWithDelivery =
    booking?.status === "delivered" && !hasDeliveredEvent
      ? [
          ...eventsWithPayment,
          {
            id: `${bookingId}-delivered`,
            title: "Delivered",
            description: "Shipment delivered",
            status: "completed",
            location: booking?.destination ?? "System",
          },
        ]
      : eventsWithPayment;

  // Deduplicate by title, prefer completed and latest created_at
  const dedupedEvents = (() => {
    const seen = new Map<string, any>();
    for (const e of eventsWithDelivery) {
      const key = (e.title || "").trim().toLowerCase();
      const existing = seen.get(key);
      const isCompleted = e.status === "completed";
      const existingCompleted = existing?.status === "completed";
      const createdNew = (e as any).created_at ? new Date((e as any).created_at).getTime() : 0;
      const createdExisting = existing?.created_at ? new Date(existing.created_at).getTime() : 0;

      const shouldReplace =
        !existing ||
        (isCompleted && !existingCompleted) ||
        createdNew > createdExisting;

      if (shouldReplace) {
        seen.set(key, e);
      }
    }
    return Array.from(seen.values());
  })();

  const orderedEvents = dedupedEvents
    .filter((e, i, arr) => {
      const norm = (v: string) => v.trim().toLowerCase();
      return arr.findIndex((x) => norm(x.title) === norm(e.title)) === i;
    })
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
  const animRef = useRef<number | null>(null);
  const simTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [simActive, setSimActive] = useState(false);

  /* ---------- LOAD BOOKING + TIMELINE ---------- */

  useEffect(() => {
    if (!bookingId) return;

    const loadCore = async () => {
      try {
        setLoading(true);

        const { booking: bookingData, events: timelineEvents } = await fetchTrackingCore(bookingId);
        
        if (bookingData) {
          setBooking(bookingData);
          try {
            const { data: container } = await supabase
              .from("bookings")
              .select("container_id")
              .eq("id", bookingData.id)
              .maybeSingle();
            if (container?.container_id) {
              const { data: providerRow } = await supabase
                .from("containers")
                .select("provider_id")
                .eq("id", container.container_id)
                .maybeSingle();
              if (providerRow?.provider_id) setProviderId(providerRow.provider_id);
            }
          } catch (err) {
            console.error("Provider lookup failed", err);
          }
          try {
            const docs = await getBookingDocuments(bookingData.id);
            setDocuments(docs);
          } catch (err) {
            console.error("Document fetch failed", err);
          }
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

  /* ---------- DOCUMENT UPLOAD ---------- */

  const handleUploadDocument = async (fileList: FileList | null, type: "invoice" | "packing_list" | "bill_of_lading" | "customs") => {
    if (!bookingId || !fileList || fileList.length === 0) return;
    const file = fileList[0];
    setUploadingDoc(true);
    try {
      await uploadDocument({ bookingId, file, type });
      const docs = await getBookingDocuments(bookingId);
      setDocuments(docs);
      toast({ title: "Document uploaded" });
    } catch (err) {
      console.error("Upload failed", err);
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploadingDoc(false);
    }
  };

  /* ---------- PROVIDER REVIEW ---------- */

  const handleSubmitReview = async () => {
    if (!bookingId || !providerId || reviewRating <= 0) return;
    setSubmittingReview(true);
    try {
      await submitProviderReview({
        booking_id: bookingId,
        provider_id: providerId,
        rating: reviewRating,
        review: reviewText,
      });
      toast({ title: "Review submitted" });
      setReviewRating(0);
      setReviewText("");
    } catch (err) {
      console.error("Review failed", err);
      toast({ title: "Could not submit review", variant: "destructive" });
    } finally {
      setSubmittingReview(false);
    }
  };

  const docsByType = documents.reduce<Partial<Record<DocType, any>>>((acc, doc) => {
    const pathParts = (doc.path || "").split("/");
    const nameParts = (doc.name || "").split("/");
    const key = (pathParts[1] || nameParts[0]) as DocType;
    if (docTypes.some((d) => d.key === key)) {
      const displayName = pathParts.slice(2).join("/") || nameParts.slice(1).join("/") || doc.name;
      acc[key] = { ...doc, displayName };
    }
    return acc;
  }, {});

  /* ---------- GEOCODE ORIGIN/DEST (fallback map) ---------- */

  useEffect(() => {
    if (!booking || gps) return;

    // cspell:ignore Nominatim
    const geocode = async (q: string): Promise<GPS | null> => {
      const withTimeout = async (url: string, ms = 4000) => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), ms);
        try {
          return await fetch(url, { referrerPolicy: "no-referrer", signal: ctrl.signal });
        } finally {
          clearTimeout(t);
        }
      };

      // Try progressively simpler queries with Nominatim
      const queries = [
        q,
        q.replace(/\s*ICD\b/i, ""),  // Remove "ICD" which Nominatim may not understand
        q.replace(/,\s*[^,]+$/, "").replace(/\s*ICD\b/i, ""), // City only, no country/ICD
      ].filter((v, i, a) => a.indexOf(v) === i); // deduplicate

      for (const query of queries) {
        try {
          const res = await withTimeout(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          if (json && json.length > 0) {
            return { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) };
          }
          // Brief delay between retries to respect rate limit
          await new Promise((r) => setTimeout(r, 1100));
        } catch (e: any) {
          // Switch to fallback (known locations or simulated) quietly when blocked/offline
          console.info("Geocoding skipped, using fallback for", query);
          break;
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
      const transport = (booking?.transport_mode || "").toLowerCase();

      const normalizeAirportQuery = (value: string) => {
        return value
          .replace(/international|airport|terminal/gi, "")
          .replace(/\s*ICD\b/gi, "")
          .replace(/,\s*[^,]+$/, "")
          .trim();
      };

      const fetchAirportCoords = async (query: string): Promise<GPS | null> => {
        if (!aviationKey) return null;
        const q = normalizeAirportQuery(query);
        if (!q) return null;
        try {
          const res = await fetch(
            `https://api.aviationstack.com/v1/airports?access_key=${encodeURIComponent(aviationKey)}&search=${encodeURIComponent(q)}`
          );
          if (!res.ok) return null;
          const data = await res.json();
          const hit = data?.data?.[0];
          if (hit?.latitude && hit?.longitude) {
            return { lat: Number(hit.latitude), lng: Number(hit.longitude) };
          }
        } catch {
          return null;
        }
        return null;
      };
      // Sequential requests to respect Nominatim 1 req/s rate limit
      let oc: GPS | null = null;
      let dc: GPS | null = null;

      if (transport === "air" && aviationKey) {
        oc = await fetchAirportCoords(o);
        dc = await fetchAirportCoords(d);
      }

      if (!oc) {
        oc = await geocode(o);
      }
      await new Promise((r) => setTimeout(r, 1100));
      if (!dc) {
        dc = await geocode(d);
      }
      const coords: RoutePoint[] = [];
      if (oc) coords.push({ ...oc, label: "Origin", address: o });
      if (dc) coords.push({ ...dc, label: "Destination", address: d });

      // If geocoding failed, fall back to simulated route points
      const tryOrs = async (start: RoutePoint, end: RoutePoint) => {
        if (transport !== "road" || !orsKey) return false;
        try {
          const res = await fetch(
            `https://api.openrouteservice.org/v2/directions/driving-car?start=${start.lng},${start.lat}&end=${end.lng},${end.lat}`,
            { headers: { Authorization: orsKey } }
          );
          if (res.ok) {
            const data = await res.json();
            const coordsRaw = data?.features?.[0]?.geometry?.coordinates ?? [];
            if (coordsRaw.length > 1) {
              const roadPath = coordsRaw.map((pair: number[], i: number) => ({
                lat: pair[1],
                lng: pair[0],
                label: i === 0 ? "Origin" : i === coordsRaw.length - 1 ? "Destination" : `Leg ${i}`,
                address: i === 0 ? o : i === coordsRaw.length - 1 ? d : undefined,
              }));
              setRouteCoords(roadPath);
              setRouteSource("ors");
              return true;
            }
          } else {
            const text = await res.text();
            console.warn("OpenRouteService route failed", res.status, text.slice(0, 200));
          }
        } catch (err) {
          console.warn("OpenRouteService route failed", err);
        }
        return false;
      };

      if (coords.length >= 2) {
        const usedOrs = await tryOrs(coords[0], coords[coords.length - 1]);
        if (usedOrs) return;

        const modePath = buildModeRoutePoints(o, d, booking?.transport_mode, coords[0], coords[coords.length - 1]);
        const labeled = modePath.map((p, i) => ({
          ...p,
          label: i === 0 ? "Origin" : i === modePath.length - 1 ? "Destination" : p.label,
          address: i === 0 ? o : i === modePath.length - 1 ? d : undefined,
        }));
        console.debug("Geocoded mode path:", labeled);
        setRouteCoords(labeled);
        setRouteSource("mode");
      } else {
        const fallbackStart = lookupKnownLocation(o);
        const fallbackEnd = lookupKnownLocation(d);
        if (fallbackStart && fallbackEnd) {
          const usedOrs = await tryOrs(
            { ...fallbackStart, label: "Origin", address: o },
            { ...fallbackEnd, label: "Destination", address: d }
          );
          if (usedOrs) return;
        }
        console.warn("Nominatim geocoding failed, using simulated route");
        const simPoints = buildModeRoutePoints(o, d, booking?.transport_mode);
        const labeled = simPoints.map((p, i) => ({
          ...p,
          label: i === 0 ? "Origin" : i === simPoints.length - 1 ? "Destination" : p.label,
          address: i === 0 ? o : i === simPoints.length - 1 ? d : undefined,
        }));
        setRouteCoords(labeled);
        setRouteSource("simulated");
      }
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
          const point = { lat: data.lat, lng: data.lng, timestamp: new Date().toISOString() } as any;
          setGps(point);
          setDisplayGps(point);
          setLivePath((prev) => {
            const last = prev[prev.length - 1];
            if (last && Math.abs(last.lat - point.lat) < 1e-6 && Math.abs(last.lng - point.lng) < 1e-6) {
              return prev;
            }
            return [...prev.slice(-49), { lat: point.lat, lng: point.lng }];
          });
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

  // Tween between live GPS points for smoother motion
  useEffect(() => {
    if (!gps) return;
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const start = performance.now();
    const duration = 1500; // ms
    const from = displayGps ?? { ...gps };
    const to = { ...gps };

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const lat = from.lat + (to.lat - from.lat) * t;
      const lng = from.lng + (to.lng - from.lng) * t;
      setDisplayGps({ lat, lng, timestamp: to.timestamp });
      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      }
    };

    animRef.current = requestAnimationFrame(step);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [gps]);

  // No simulation fallback: if no live GPS, map stays static/fallback map shows planned route
  useEffect(() => {
    if (gps || routeCoords.length < 2) {
      if (simTimer.current) {
        clearInterval(simTimer.current);
        simTimer.current = null;
      }
      setSimActive(false);
      return;
    }

    if (simTimer.current) return; // already running

    setSimActive(true);
    let progress = 0;
    const stepCount = 200; // points along the route
    const totalSegments = Math.max(1, routeCoords.length - 1);

    simTimer.current = setInterval(() => {
      if (gps) {
        if (simTimer.current) {
          clearInterval(simTimer.current);
          simTimer.current = null;
        }
        setSimActive(false);
        return;
      }

      const t = (progress % stepCount) / (stepCount - 1);
      const segFloat = t * totalSegments;
      const segIdx = Math.min(totalSegments - 1, Math.floor(segFloat));
      const segT = segFloat - segIdx;
      const startPt = routeCoords[segIdx];
      const endPt = routeCoords[segIdx + 1];
      const lat = startPt.lat + (endPt.lat - startPt.lat) * segT;
      const lng = startPt.lng + (endPt.lng - startPt.lng) * segT;
      const simPoint = { lat, lng, timestamp: new Date().toISOString() };
      setDisplayGps(simPoint);
      setLivePath((prev) => [...prev.slice(-99), { lat, lng }]);
      progress += 1;
    }, 800);

    return () => {
      if (simTimer.current) {
        clearInterval(simTimer.current);
        simTimer.current = null;
      }
      setSimActive(false);
    };
  }, [gps, routeCoords]);

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
              <p>
                Status: <b className={booking.status === "payment_completed" ? "text-green-600" : undefined}>
                  {booking.status === "payment_completed" ? "paid" : booking.status}
                </b>
              </p>
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
        {displayGps && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Live GPS Tracking</CardTitle>
                <div className="text-xs text-muted-foreground">
                  {displayGps?.timestamp
                    ? `${simActive ? "Simulated" : "Updated"} ${new Date(displayGps.timestamp).toLocaleTimeString()}`
                    : "Awaiting first fix"}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] rounded-lg overflow-hidden">
                <MapContainer
                  center={[displayGps.lat, displayGps.lng]}
                  zoom={6}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {livePath.length > 1 && (
                    <Polyline
                      positions={livePath.map((p) => [p.lat, p.lng] as [number, number])}
                      pathOptions={{ ...routeStyle(booking?.transport_mode), opacity: 0.7 }}
                    />
                  )}
                  <CircleMarker
                    center={[displayGps.lat, displayGps.lng]}
                    radius={10}
                    pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.2 }}
                  />
                  <Marker position={[displayGps.lat, displayGps.lng]} icon={mapMarkerIcon}>
                    <Popup>
                      <div className="space-y-1">
                        <div className="font-semibold">Container Location</div>
                        <div>{displayGps.lat.toFixed(4)}, {displayGps.lng.toFixed(4)}</div>
                        {displayGps?.timestamp && (
                          <div className="text-xs text-muted-foreground">
                            Updated {new Date(displayGps.timestamp).toLocaleString()}
                          </div>
                        )}
                      </div>
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
              <div className="flex items-center justify-between">
                <CardTitle>Route Map</CardTitle>
                <span className="text-xs text-muted-foreground">
                  {routeSource === "ors" ? "Road: ORS" : routeSource === "mode" ? "Mode route" : "Simulated"}
                </span>
              </div>
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
                    <Marker position={[routeCoords[0].lat, routeCoords[0].lng]} icon={mapMarkerIcon}>
                      <Popup>
                        <b>{routeCoords[0].label}</b>
                        <br />
                        {routeCoords[0].address || booking?.origin || booking?.destination}
                        <br />
                        <small className="text-xs text-muted-foreground">{routeCoords[0].lat.toFixed(6)}, {routeCoords[0].lng.toFixed(6)}</small>
                      </Popup>
                    </Marker>
                  </MapContainer>
                ) : (
                  <MapContainer
                    bounds={routeCoords.map((c) => [c.lat, c.lng] as [number, number])}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {routeCoords.length > 1 && (
                      <>
                        <Marker position={[routeCoords[0].lat, routeCoords[0].lng]} icon={mapMarkerIcon}>
                          <Popup>
                            <b>Origin</b>
                            <br />
                            {routeCoords[0].address || booking?.origin}
                            <br />
                            <small className="text-xs text-muted-foreground">{routeCoords[0].lat.toFixed(6)}, {routeCoords[0].lng.toFixed(6)}</small>
                          </Popup>
                        </Marker>
                        <Marker position={[routeCoords[routeCoords.length - 1].lat, routeCoords[routeCoords.length - 1].lng]} icon={mapMarkerIcon}>
                          <Popup>
                            <b>Destination</b>
                            <br />
                            {routeCoords[routeCoords.length - 1].address || booking?.destination}
                            <br />
                            <small className="text-xs text-muted-foreground">{routeCoords[routeCoords.length - 1].lat.toFixed(6)}, {routeCoords[routeCoords.length - 1].lng.toFixed(6)}</small>
                          </Popup>
                        </Marker>
                        <Polyline
                          positions={routeCoords.map((c) => [c.lat, c.lng] as [number, number])}
                          pathOptions={routeStyle(booking?.transport_mode)}
                        />
                      </>
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

        {/* DOCUMENTS */}
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
                        {doc?.displayName || "Not uploaded"}
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
                      <label htmlFor={`upload-${key}`} className="text-xs font-semibold text-primary cursor-pointer">
                        {uploadingDoc ? "..." : "Upload"}
                      </label>
                      <input
                        id={`upload-${key}`}
                        type="file"
                        className="hidden"
                        onChange={(e) => handleUploadDocument(e.target.files, key)}
                        disabled={uploadingDoc}
                      />
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

        {/* PROVIDER REVIEW */}
        {booking?.status === "delivered" && providerId && (
          <Card>
            <CardHeader>
              <CardTitle>Rate Your Provider</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((r) => (
                  <button
                    key={r}
                    onClick={() => setReviewRating(r)}
                    className={`h-10 w-10 rounded-full border ${reviewRating >= r ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <textarea
                className="w-full rounded-md border bg-transparent p-2 text-sm"
                rows={3}
                placeholder="Share your experience"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
              />
              <button
                className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground"
                onClick={handleSubmitReview}
                disabled={submittingReview || reviewRating <= 0}
              >
                {submittingReview ? "Submitting..." : "Submit Review"}
              </button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
