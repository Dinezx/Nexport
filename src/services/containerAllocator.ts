import { supabase } from "@/lib/supabase";

export async function optimizeContainerFill(containerId: string) {
    const { data: container, error } = await supabase
        .from("containers")
        .select("id, total_space_cbm, available_space_cbm, status")
        .eq("id", containerId)
        .single();

    if (error || !container) throw error || new Error("Container not found");

    const total = container.total_space_cbm || 0;
    const available = container.available_space_cbm || 0;
    const used = Math.max(0, total - available);
    const fillRate = total > 0 ? used / total : 0;

    let status = container.status;
    if (fillRate >= 1) {
        status = "full";
    } else if (fillRate >= 0.9) {
        status = "ready_for_dispatch" as any;
    }

    const { error: updateError } = await supabase
        .from("containers")
        .update({ status, available_space_cbm: available })
        .eq("id", containerId);

    if (updateError) throw updateError;

    return { fillRate, status };
}

export async function evaluatePartialAllocation(containerId: string) {
    const { data, error } = await supabase
        .from("bookings")
        .select("allocated_cbm")
        .eq("container_id", containerId)
        .eq("booking_mode", "partial");

    if (error) throw error;
    const totalAllocated = (data || []).reduce((sum, row: any) => sum + (row.allocated_cbm || 0), 0);
    return totalAllocated;
}
