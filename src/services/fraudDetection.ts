import { supabase } from "@/lib/supabase";

export type FraudLevel = "low" | "medium" | "high";

export type BookingFraudInput = {
    id?: string;
    exporter_id: string;
    origin: string;
    destination: string;
    cbm: number;
    price?: number | null;
    cargo_value_usd?: number | null;
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

    if (booking.cargo_value_usd && booking.cbm > 0) {
        const densityValue = booking.cargo_value_usd / booking.cbm;
        if (densityValue > 80000) {
            score += 20;
            reasons.push("High value-to-volume cargo flagged");
        }
    }

    if (booking.payment_status && booking.payment_status === "failed") {
        score += 20;
        reasons.push("Recent payment failure");
    }

    // Unusual route patterns (origin == destination or very short pseudo distance)
    if (booking.origin && booking.destination && booking.origin.toLowerCase() === booking.destination.toLowerCase()) {
        score += 15;
        reasons.push("Origin and destination identical");
    } else if ((booking.origin.length + booking.destination.length) < 10) {
        score += 10;
        reasons.push("Route data appears incomplete");
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

    // Burst booking detection across any route
    try {
        const { count: burstCount } = await supabase
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("exporter_id", booking.exporter_id)
            .gte("created_at", new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString());

        if (typeof burstCount === "number" && burstCount > 4) {
            score += 25;
            reasons.push("Abnormal booking burst in last 2h");
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
