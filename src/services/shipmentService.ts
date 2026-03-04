import { supabase } from "@/lib/supabase";
import { addTrackingEvent } from "@/services/trackingService";
import { createNotification } from "@/services/notificationService";
import { releaseProviderPayout } from "@/services/payoutService";

export type ShipmentStatus =
    | "booked"
    | "payment_completed"
    | "container_allocated"
    | "cargo_received"
    | "loaded_on_vessel"
    | "in_transit"
    | "arrived_destination"
    | "delivered";

export type ShipmentStatusMeta = {
    location?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    note?: string | null;
    exporterId?: string | null;
    providerId?: string | null;
};

function statusMessage(status: ShipmentStatus, note?: string | null) {
    if (note) return note;
    const text = status.replace(/_/g, " ");
    return text.charAt(0).toUpperCase() + text.slice(1);
}

export async function updateShipmentStatus(
    bookingId: string,
    status: ShipmentStatus,
    meta?: ShipmentStatusMeta,
) {
    const { error } = await supabase
        .from("bookings")
        .update({ status })
        .eq("id", bookingId);

    if (error) throw error;

    try {
        await addTrackingEvent({
            booking_id: bookingId,
            status,
            location: meta?.location ?? "System",
            latitude: typeof meta?.latitude === "number" ? meta?.latitude : null,
            longitude: typeof meta?.longitude === "number" ? meta?.longitude : null,
            title: statusMessage(status, meta?.note),
            description: statusMessage(status, meta?.note),
        });
    } catch (err) {
        console.error("Failed to append tracking event", err);
    }

    const message = `Shipment ${statusMessage(status, meta?.note)}`;
    try {
        if (meta?.exporterId) {
            await createNotification({
                user_id: meta.exporterId,
                message,
                type: "shipment_status",
            });
        }
        if (meta?.providerId) {
            await createNotification({
                user_id: meta.providerId,
                message,
                type: "shipment_status",
            });
        }
    } catch (err) {
        console.error("Notification creation failed", err);
    }

    if (status === "delivered") {
        try {
            await releaseProviderPayout(bookingId);
        } catch (err) {
            console.error("Payout release failed", err);
        }
    }

    return { status };
}
