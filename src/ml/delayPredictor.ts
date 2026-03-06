import { LOCATION_COORDS, getWeatherDelayFactor } from "@/lib/shipmentData";

export type DelayRiskLevel = "low" | "medium" | "high";

export function predictDelayRisk(route: string, port: string, season: string) {
    const seed = `${route}-${port}-${season}`.length;
    const probability = Math.min(0.95, 0.25 + (seed % 50) / 100);
    const label: DelayRiskLevel = probability < 0.35 ? "low" : probability < 0.65 ? "medium" : "high";
    return { probability, label };
}

export type RouteDelayRisk = "LOW" | "MEDIUM" | "HIGH";

function getCongestionScore(location: string) {
    const match = LOCATION_COORDS[location];
    if (match) return match.congestionIndex;

    const lower = location.toLowerCase();
    const fuzzy = Object.entries(LOCATION_COORDS).find(([key]) => key.toLowerCase().includes(lower));
    return fuzzy ? fuzzy[1].congestionIndex : 5;
}

export function predictRouteDelayRisk(origin: string, destination: string, transport: "sea" | "road" | "air" = "sea") {
    const factors: string[] = [];
    const month = new Date().getMonth();
    const weather = getWeatherDelayFactor(month, transport);

    const congestionOrigin = getCongestionScore(origin);
    const congestionDest = getCongestionScore(destination);
    const congestionAvg = (congestionOrigin + congestionDest) / 2;

    let score = congestionAvg * 6;
    if (weather > 1) {
        score += (weather - 1) * 40;
        factors.push(`Weather factor ${(weather * 100).toFixed(0)}%`);
    }
    if (transport === "sea") score += 10;
    if (transport === "air") score -= 8;

    if (congestionOrigin >= 8 || congestionDest >= 8) {
        factors.push("High port congestion on route");
    } else if (congestionAvg >= 6) {
        factors.push("Moderate congestion on route");
    } else {
        factors.push("Low congestion profile");
    }

    const level: RouteDelayRisk = score >= 75 ? "HIGH" : score >= 45 ? "MEDIUM" : "LOW";
    factors.push(`Composite delay score ${Math.round(score)}`);

    return { level, score: Math.round(score), factors };
}
