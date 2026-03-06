import { supabase } from "@/lib/supabase";

export type ShipmentSnapshot = {
    bookingId: string;
    origin: string;
    destination: string;
    status: string;
    etaDays?: number | null;
    containerId?: string | null;
    containerNumber?: string | null;
};

export type ContainerSnapshot = {
    id: string;
    containerNumber: string | null;
    size: string;
    type: string;
    availableSpaceCbm: number | null;
    status: string;
};

export type TrackingSnapshot = {
    title: string;
    status: string;
    location?: string | null;
    created_at: string;
};

export type ShipmentContext = {
    booking?: ShipmentSnapshot | null;
    container?: ContainerSnapshot | null;
    trackingEvents: TrackingSnapshot[];
};

async function fetchBookingSnapshot(bookingId: string): Promise<ShipmentSnapshot | null> {
    const { data } = await supabase
        .from("bookings")
        .select("id, origin, destination, status, eta_days, container_id, container_number")
        .eq("id", bookingId)
        .maybeSingle();

    if (!data) return null;
    return {
        bookingId: data.id,
        origin: data.origin,
        destination: data.destination,
        status: data.status,
        etaDays: data.eta_days,
        containerId: data.container_id,
        containerNumber: data.container_number,
    };
}

async function fetchContainerSnapshot(containerId?: string | null): Promise<ContainerSnapshot | null> {
    if (!containerId) return null;

    const { data } = await supabase
        .from("containers")
        .select("id, container_number, container_size, container_type, available_space_cbm, status")
        .eq("id", containerId)
        .maybeSingle();

    if (!data) return null;
    return {
        id: data.id,
        containerNumber: data.container_number,
        size: data.container_size,
        type: data.container_type,
        availableSpaceCbm: data.available_space_cbm,
        status: data.status,
    };
}

async function fetchLatestTrackingEvents(bookingId: string, limit: number = 5): Promise<TrackingSnapshot[]> {
    const { data } = await supabase
        .from("tracking_events")
        .select("title, status, location, created_at")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false })
        .limit(limit);

    return (data || []).map((row) => ({
        title: row.title,
        status: row.status,
        location: row.location,
        created_at: row.created_at,
    }));
}

async function fetchUserBookings(userId: string) {
    const { data } = await supabase
        .from("bookings")
        .select("id, origin, destination, status, eta_days, container_id, container_number")
        .or(`exporter_id.eq.${userId},provider_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(5);

    return (data || []).map((row) => ({
        bookingId: row.id,
        origin: row.origin,
        destination: row.destination,
        status: row.status,
        etaDays: row.eta_days,
        containerId: row.container_id,
        containerNumber: row.container_number,
    } as ShipmentSnapshot));
}

export async function buildShipmentContext(params: { bookingId?: string; userId?: string }): Promise<ShipmentContext> {
    const { bookingId, userId } = params;

    if (bookingId) {
        const booking = await fetchBookingSnapshot(bookingId);
        const container = await fetchContainerSnapshot(booking?.containerId);
        const trackingEvents = booking ? await fetchLatestTrackingEvents(booking.bookingId, 6) : [];
        return { booking, container, trackingEvents };
    }

    if (userId) {
        const userBookings = await fetchUserBookings(userId);
        const first = userBookings[0];
        const container = await fetchContainerSnapshot(first?.containerId || null);
        const trackingEvents = first ? await fetchLatestTrackingEvents(first.bookingId, 3) : [];
        return { booking: first, container, trackingEvents };
    }

    return { booking: null, container: null, trackingEvents: [] };
}

export async function answerShipmentQuestion(question: string, params: { bookingId?: string; userId?: string }) {
    const context = await buildShipmentContext(params);
    const parts: string[] = [];

    if (context.booking) {
        parts.push(
            `Booking ${context.booking.bookingId}: ${context.booking.origin} -> ${context.booking.destination}. ` +
            `Status ${context.booking.status}. ETA ${context.booking.etaDays ?? "n/a"} days.`
        );
    }

    if (context.container) {
        parts.push(
            `Container ${context.container.containerNumber || context.container.id} (${context.container.size} ${context.container.type}), ` +
            `available space ${context.container.availableSpaceCbm ?? 0} CBM, status ${context.container.status}.`
        );
    }

    if (context.trackingEvents.length) {
        const latest = context.trackingEvents[0];
        parts.push(`Latest tracking: ${latest.title} (${latest.status}${latest.location ? ` at ${latest.location}` : ""}).`);
    }

    return {
        question,
        contextSummary: parts.join(" ") || "No live shipment data available for this query.",
        data: context,
    };
}
