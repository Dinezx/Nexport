import { supabase } from "@/lib/supabase";

export type AlertType = "container" | "delay" | "demand" | "payment" | "fraud_risk";

export type AlertRecord = {
    id: string;
    message: string;
    type: AlertType;
    user_id: string;
    created_at: string;
};

export async function createAlert(message: string, type: AlertType, userId: string): Promise<AlertRecord | null> {
    const { data } = await supabase
        .from("alerts")
        .insert({ message, type, user_id: userId })
        .select()
        .maybeSingle();

    return data as AlertRecord | null;
}

export async function createContainerFullnessAlert(params: { userId: string; containerNumber?: string; utilization: number }) {
    const { userId, containerNumber, utilization } = params;
    const msg = `Container ${containerNumber || ""} utilization at ${Math.round(utilization)}%`;
    return createAlert(msg.trim(), "container", userId);
}

export async function createDelayRiskAlert(params: { userId: string; bookingId: string; risk: "LOW" | "MEDIUM" | "HIGH" }) {
    const { userId, bookingId, risk } = params;
    const msg = `Shipment ${bookingId} delay risk flagged as ${risk}`;
    return createAlert(msg, "delay", userId);
}

export async function createDemandAlert(params: { userId: string; route: string; level: "LOW" | "MEDIUM" | "HIGH" }) {
    const { userId, route, level } = params;
    const msg = `High demand alert for route ${route}: ${level}`;
    return createAlert(msg, "demand", userId);
}

export async function createPaymentIssueAlert(params: { userId: string; bookingId: string; detail?: string }) {
    const { userId, bookingId, detail } = params;
    const msg = `Payment issue detected for booking ${bookingId}${detail ? `: ${detail}` : ""}`;
    return createAlert(msg, "payment", userId);
}
