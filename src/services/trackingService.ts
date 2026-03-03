import { supabase } from "@/lib/supabase";
import { getOfflineBookings } from "@/services/bookingService";
import { isSupabaseReachable } from "@/lib/offlineAuth";

export type TrackingEvent = {
  id: string;
  title: string;
  description: string;
  status: string;
  location: string;
  created_at?: string;
};

/* ---------- Offline tracking helpers ---------- */

function buildOfflineTrackingEvents(bookingId: string, origin: string, isPaid: boolean): TrackingEvent[] {
  const events: TrackingEvent[] = [
    {
      id: `${bookingId}-evt-1`,
      title: "Booking Confirmed",
      description: "Payment received and booking confirmed.",
      status: isPaid ? "completed" : "pending",
      location: "System",
    },
    {
      id: `${bookingId}-evt-2`,
      title: "Container Assigned",
      description: "Container has been assigned to this booking.",
      status: isPaid ? "completed" : "pending",
      location: "System",
    },
    {
      id: `${bookingId}-evt-3`,
      title: "Awaiting Pickup",
      description: "Waiting for cargo pickup at origin.",
      status: "pending",
      location: origin,
    },
  ];
  return events;
}

function fetchOfflineTrackingCore(bookingId: string) {
  const allBookings = getOfflineBookings();
  const booking = allBookings.find((b) => b.id === bookingId);
  if (!booking) return null;

  const isPaid = booking.status === "paid";
  const events = buildOfflineTrackingEvents(bookingId, booking.origin, isPaid);

  return {
    booking: {
      id: booking.id,
      origin: booking.origin,
      destination: booking.destination,
      transport_mode: booking.transport_mode,
      status: booking.status,
      eta_days: null,
      eta_confidence: null,
    },
    events,
  };
}

/* ---------- Main fetch ---------- */

export async function fetchTrackingCore(bookingId: string) {
  // Offline booking — always use localStorage
  if (bookingId.startsWith("offline-")) {
    const result = fetchOfflineTrackingCore(bookingId);
    if (!result) throw new Error("Offline booking not found");
    return result;
  }

  // Check if Supabase is reachable
  const online = await isSupabaseReachable(3000);
  if (!online) {
    // Try offline storage as fallback
    const result = fetchOfflineTrackingCore(bookingId);
    if (result) return result;
    throw new Error("Supabase is unreachable and no offline data found");
  }

  const { data: bookingData, error: bookingErr } = await supabase
    .from("bookings")
    .select("id, origin, destination, transport_mode, status, eta_days, eta_confidence")
    .eq("id", bookingId)
    .single();

  if (bookingErr) throw bookingErr;

  const { data: timeline, error: timelineErr } = await supabase
    .from("tracking_events")
    .select("id, title, description, status, location")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  if (timelineErr) throw timelineErr;

  return { booking: bookingData, events: (timeline || []) as TrackingEvent[] };
}

export function subscribeTrackingEvents(bookingId: string, onInsert: (event: TrackingEvent) => void) {
  // Skip realtime subscription for offline bookings
  if (bookingId.startsWith("offline-")) return null;

  const channel = supabase
    .channel(`tracking-events-${bookingId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "tracking_events",
        filter: `booking_id=eq.${bookingId}`,
      },
      (payload: { new: TrackingEvent }) => onInsert(payload.new),
    )
    .subscribe();

  return channel;
}

export async function fetchLiveLocation(bookingId: string) {
  // No live location for offline bookings
  if (bookingId.startsWith("offline-")) return null;

  try {
    const { data, error } = await supabase
      .from("live_locations")
      .select("lat, lng")
      .eq("booking_id", bookingId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  } catch {
    return null;
  }
}

export async function upsertLiveLocation(params: {
  booking_id: string;
  lat: number;
  lng: number;
}) {
  const { booking_id, lat, lng } = params;
  const { error } = await supabase.from("live_locations").upsert({
    booking_id,
    lat,
    lng,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}

export async function insertTrackingEvent(params: {
  booking_id: string;
  title: string;
  description: string;
  status: string;
  location: string;
}) {
  const { error } = await supabase.from("tracking_events").insert({
    booking_id: params.booking_id,
    title: params.title,
    description: params.description,
    status: params.status,
    location: params.location,
  });

  if (error) throw error;
}
