import { supabase } from "@/lib/supabase";

export type BookingContext = {
    bookingId: string;
    origin: string;
    destination: string;
    transportMode: string;
    bookingMode: string;
    status: string;
    etaDays?: number | null;
    containerNumber?: string | null;
    latestTracking?: string;
};

export type AiContextPayload = {
    summary: string;
    bookings: BookingContext[];
};

async function fetchLatestTrackingTitle(bookingId: string) {
    const { data } = await supabase
        .from("tracking_events")
        .select("title, status, location")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!data) return null;
    const location = data.location ? ` at ${data.location}` : "";
    return `${data.title} (${data.status}${location})`;
}

export async function getBookingContext(bookingId: string): Promise<BookingContext | null> {
    try {
        const { data, error } = await supabase
            .from("bookings")
            .select("id, origin, destination, transport_mode, booking_mode, status, eta_days, container_number")
            .eq("id", bookingId)
            .maybeSingle();

        if (error || !data) return null;

        const latestTracking = await fetchLatestTrackingTitle(bookingId);

        return {
            bookingId,
            origin: data.origin,
            destination: data.destination,
            transportMode: data.transport_mode,
            bookingMode: data.booking_mode,
            status: data.status,
            etaDays: data.eta_days,
            containerNumber: data.container_number,
            latestTracking,
        };
    } catch {
        return null;
    }
}

export async function getUserShipmentContext(userId: string): Promise<AiContextPayload> {
    const bookings: BookingContext[] = [];

    try {
        const { data } = await supabase
            .from("bookings")
            .select("id, origin, destination, transport_mode, booking_mode, status, eta_days, container_number")
            .or(`exporter_id.eq.${userId},provider_id.eq.${userId}`)
            .order("created_at", { ascending: false })
            .limit(8);

        if (data) {
            for (const b of data) {
                const latestTracking = await fetchLatestTrackingTitle(b.id);
                bookings.push({
                    bookingId: b.id,
                    origin: b.origin,
                    destination: b.destination,
                    transportMode: b.transport_mode,
                    bookingMode: b.booking_mode,
                    status: b.status,
                    etaDays: b.eta_days,
                    containerNumber: b.container_number,
                    latestTracking,
                });
            }
        }
    } catch {
        // Ignore and fall back to empty context
    }

    const summary = bookings.length
        ? `Live bookings: ${bookings.map((b) => `BK-${b.bookingId.slice(0, 6)} ${b.origin}→${b.destination} (${b.status})`).join("; ")}`
        : "No live bookings found for this user.";

    return { summary, bookings };
}

export async function buildAiContext(params: { userId?: string; bookingId?: string }) {
    const { userId, bookingId } = params;

    const contextParts: string[] = [];
    if (bookingId) {
        const bookingContext = await getBookingContext(bookingId);
        if (bookingContext) {
            const latest = bookingContext.latestTracking
                ? `Latest tracking: ${bookingContext.latestTracking}`
                : "No tracking events yet.";
            contextParts.push(
                `Booking ${bookingContext.bookingId}: ${bookingContext.origin} -> ${bookingContext.destination}, ${bookingContext.transportMode} (${bookingContext.bookingMode}). Status: ${bookingContext.status}. ${latest}`
            );
        }
    }

    if (userId) {
        const { summary } = await getUserShipmentContext(userId);
        contextParts.push(summary);
    }

    return contextParts.join("\n");
}
