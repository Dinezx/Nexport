import { supabase } from "@/lib/supabase";

export type FraudLevel = "low" | "medium" | "high";

export type BookingFraudInput = {
    id?: string;
    exporter_id: string;
    origin: string;
    destination: string;
    cbm: number;
    price?: number | null;
    payment_status?: string | null;
    created_at?: string;
};

export type FraudCheckResult = {
    score: number;
    level: FraudLevel;
    reasons: string[];
};

function mapScore(score: number): FraudLevel {
    if (score >= 75) return "high";
    if (score >= 45) return "medium";
    return "low";
}

async function alertAdmin(message: string, userId: string) {
    try {
        await supabase
            .from("alerts")
            .insert({ message, type: "fraud_risk", user_id: userId })
            .select("id")
            .single();
    } catch {
        // best-effort alerting
    }
}

export async function detectBookingFraud(booking: BookingFraudInput): Promise<FraudCheckResult> {
    const reasons: string[] = [];
    let score = 0;

    if (booking.cbm <= 0 || booking.cbm > 120) {
        score += 25;
        reasons.push("Abnormal CBM request");
    }

    if (!booking.price || booking.price < 5000) {
        score += 15;
        reasons.push("Payment amount unusually low");
    }

    if (booking.payment_status && booking.payment_status === "failed") {
        score += 20;
        reasons.push("Recent payment failure");
    }

    // Duplicate booking detection based on route and user in short window
    try {
        const { count } = await supabase
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("exporter_id", booking.exporter_id)
            .eq("origin", booking.origin)
            .eq("destination", booking.destination)
            .gte("created_at", new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString());

        if (typeof count === "number" && count > 2) {
            score += 30;
            reasons.push("Duplicate bookings detected in last 6h");
        }
    } catch {
        // ignore count errors
    }

    const level = mapScore(score);
    if (level === "high") {
        await alertAdmin(`High fraud risk for booking ${booking.id || "new"}`, booking.exporter_id);
    }

    return { score, level, reasons };
}
