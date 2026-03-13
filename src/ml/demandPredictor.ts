import { supabase } from "@/lib/supabase";

export type DemandLevel = "LOW" | "MEDIUM" | "HIGH";

export type DemandPrediction = {
    route: string;
    month: number;
    level: DemandLevel;
    score: number;
    sampleSize: number;
    factors: string[];
};

export type DemandForecastPoint = {
    month: number;
    score: number;
    level: DemandLevel;
};

const seasonalBoost: Record<number, number> = {
    0: 0.94,
    1: 0.96,
    2: 1.02,
    3: 1.08,
    4: 1.12,
    5: 1.15,
    6: 1.1,
    7: 1.04,
    8: 0.98,
    9: 1.06,
    10: 1.14,
    11: 1.18,
};

const popularLanes: Record<string, number> = {
    "mumbai -> dubai": 0.85,
    "chennai -> singapore": 0.82,
    "mumbai -> new york": 0.74,
    "chennai -> colombo": 0.7,
    "dubai -> rotterdam": 0.68,
};

function normalizeRoute(route: string) {
    return route.replace(/\s+/g, " ").trim().toLowerCase();
}

function mapScoreToLevel(score: number): DemandLevel {
    if (score >= 70) return "HIGH";
    if (score >= 40) return "MEDIUM";
    return "LOW";
}

export async function predictContainerDemand(route: string, month: number): Promise<DemandPrediction> {
    const monthIndex = Math.max(0, Math.min(11, month - 1));
    const normalizedRoute = normalizeRoute(route.includes("->") ? route : route.replace(" to ", " -> "));

    let bookingSignal = 0;
    let sampleSize = 0;
    const factors: string[] = [];

    const [origin, destination] = normalizedRoute.split("->").map((s) => s?.trim() || "");

    try {
        if (origin && destination) {
            const { count } = await supabase
                .from("bookings")
                .select("id", { count: "exact", head: true })
                .eq("origin", origin)
                .eq("destination", destination);

            if (typeof count === "number") {
                sampleSize = count;
                bookingSignal = Math.min(1, count / 50);
                factors.push(`Historical bookings on this lane: ${count}`);
            }
        }
    } catch {
        // Fallback to heuristic only
    }

    const seasonal = seasonalBoost[monthIndex] ?? 1;
    const popularity = popularLanes[normalizedRoute] ?? 0.35;
    const score = Math.min(100, Math.round((popularity * 60 + seasonal * 25 + bookingSignal * 40)));

    const level = mapScoreToLevel(score);
    factors.push(`Seasonal factor ${seasonal.toFixed(2)} for month ${month}`);
    factors.push(popularity > 0.5 ? "Lane marked popular in historical data" : "Lane has moderate historical usage");

    return {
        route,
        month,
        level,
        score,
        sampleSize,
        factors,
    };
}

export async function forecastDemandSeries(route: string, periods: number = 3): Promise<DemandForecastPoint[]> {
    const now = new Date();
    const baseMonth = now.getMonth() + 1;
    const points: DemandForecastPoint[] = [];
    let carryScore = 55;

    for (let i = 0; i < periods; i++) {
        const month = ((baseMonth + i - 1) % 12) + 1;
        const seasonal = seasonalBoost[month - 1] ?? 1;
        carryScore = Math.min(100, Math.round(carryScore * 0.9 + seasonal * 25));
        points.push({ month, score: carryScore, level: mapScoreToLevel(carryScore) });
    }

    return points;
}
