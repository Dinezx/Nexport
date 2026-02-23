import { supabase } from "@/lib/supabase";

export type TrackingEvent = {
  id: string;
  title: string;
  description: string;
  status: string;
  location: string;
  created_at?: string;
};

export async function fetchTrackingCore(bookingId: string) {
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
  const { data, error } = await supabase
    .from("live_locations")
    .select("lat, lng")
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
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
