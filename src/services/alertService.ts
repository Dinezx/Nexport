import { supabase } from "@/lib/supabase";

export type AlertType =
    | "container_near_full"
    | "shipment_delay_risk"
    | "route_congestion"
    | "payment_issue"
    | "system";

export type AlertPayload = {
    user_id: string;
    type: AlertType;
    title: string;
    message: string;
    booking_id?: string | null;
    container_id?: string | null;
    route?: string | null;
    severity?: "low" | "medium" | "high";
};

export type AlertRecord = AlertPayload & {
    id: string;
    created_at: string;
    read: boolean;
};

export async function createAlert(payload: AlertPayload): Promise<AlertRecord | null> {
    const body = {
        ...payload,
        created_at: new Date().toISOString(),
        read: false,
    };

    const { data, error } = await supabase
        .from("alerts")
        .insert(body)
        .select()
        .single();

    if (error) throw error;
    return data as AlertRecord;
}

export async function fetchAlerts(userId: string, opts?: { unreadOnly?: boolean }) {
    if (!userId) return [] as AlertRecord[];

    let query = supabase
        .from("alerts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

    if (opts?.unreadOnly) {
        query = query.eq("read", false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as AlertRecord[];
}

export async function markAlertRead(alertId: string) {
    const { error } = await supabase
        .from("alerts")
        .update({ read: true })
        .eq("id", alertId);

    if (error) throw error;
}

export async function markAllAlertsRead(userId: string) {
    const { error } = await supabase
        .from("alerts")
        .update({ read: true })
        .eq("user_id", userId);

    if (error) throw error;
}
