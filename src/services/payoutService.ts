import { supabase } from "@/lib/supabase";
import { createNotification } from "@/services/notificationService";

export async function releaseProviderPayout(bookingId: string) {
    const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select("id, container_id, exporter_id")
        .eq("id", bookingId)
        .single();

    if (bookingError || !booking) throw bookingError || new Error("Booking not found");

    let providerId: string | null = null;
    if (booking.container_id) {
        const { data: container } = await supabase
            .from("containers")
            .select("provider_id")
            .eq("id", booking.container_id)
            .maybeSingle();
        providerId = container?.provider_id ?? null;
    }

    const { error: updateError } = await supabase
        .from("bookings")
        .update({ payout_status: "released" })
        .eq("id", bookingId);

    if (updateError) throw updateError;

    try {
        await supabase
            .from("payments")
            .update({ payout_status: "released" })
            .eq("booking_id", bookingId);
    } catch (err) {
        console.warn("Payment payout update skipped", err);
    }

    if (providerId) {
        try {
            await createNotification({
                user_id: providerId,
                message: `Payout released for booking ${bookingId}`,
                type: "payout_released",
            });
        } catch (err) {
            console.error("Provider payout notification failed", err);
        }
    }

    return { payout_status: "released" };
}
