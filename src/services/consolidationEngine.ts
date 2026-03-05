import { supabase } from "@/lib/supabase";
import type { BookingMode } from "@/services/bookingService";

export type ConsolidationResult = {
    assigned: boolean;
    readyForDispatch: boolean;
    remainingCbm: number;
};

export async function consolidateBookingIntoContainer(params: {
    containerId: string;
    bookingId: string;
    bookingMode: BookingMode;
    shipmentCbm: number;
}): Promise<ConsolidationResult> {
    const { containerId, bookingId, bookingMode, shipmentCbm } = params;
    const cbm = Math.max(0, shipmentCbm);

    const { data: container, error: fetchError } = await supabase
        .from("containers")
        .select("available_space_cbm, total_space_cbm")
        .eq("id", containerId)
        .maybeSingle();

    if (fetchError || !container) throw fetchError || new Error("Container not found");

    const available = container.available_space_cbm ?? 0;
    if (bookingMode === "partial" && cbm > available) {
        return { assigned: false, readyForDispatch: false, remainingCbm: available };
    }

    const newAvailable = bookingMode === "full" ? 0 : Math.max(0, available - cbm);
    const readyForDispatch = newAvailable <= (container.total_space_cbm ?? 0) * 0.1;

    const { error: updateContainerError } = await supabase
        .from("containers")
        .update({
            available_space_cbm: newAvailable,
            status: readyForDispatch ? "full" : "allocated",
        })
        .eq("id", containerId)
        .select("id");

    if (updateContainerError) throw updateContainerError;

    const { error: updateBookingError } = await supabase
        .from("bookings")
        .update({ container_id: containerId, allocated_cbm: cbm })
        .eq("id", bookingId)
        .select("id");

    if (updateBookingError) throw updateBookingError;

    return { assigned: true, readyForDispatch, remainingCbm: newAvailable };
}

export function planConsolidation(containerCapacity: number, availableCbm: number, pendingShipments: { id: string; cbm: number; }[]) {
    const sorted = pendingShipments.slice().sort((a, b) => b.cbm - a.cbm);
    const assignments: { bookingId: string; cbm: number }[] = [];
    let remaining = availableCbm;

    for (const shipment of sorted) {
        if (shipment.cbm <= remaining) {
            assignments.push({ bookingId: shipment.id, cbm: shipment.cbm });
            remaining -= shipment.cbm;
        }
    }

    return {
        assignments,
        readyForDispatch: remaining <= containerCapacity * 0.1,
        remainingCbm: remaining,
    };
}
