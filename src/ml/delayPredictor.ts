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

export type DelayFeatureInput = {
    origin: string;
    destination: string;
    transport: "sea" | "road" | "air";
    weatherIndex: number; // 0-1 where 1 is severe weather
    portCongestionOrigin: number; // 0-10
    portCongestionDestination: number; // 0-10
    vesselScheduleReliability: number; // 0-1 (1 is very reliable)
    historicalDelayRate: number; // 0-1 representing past delay probability
    routeDistanceKm?: number;
};

export function estimateShipmentDelay(input: DelayFeatureInput) {
    const {
        origin,
        destination,
        transport,
        weatherIndex,
        portCongestionOrigin,
        portCongestionDestination,
        vesselScheduleReliability,
        historicalDelayRate,
        routeDistanceKm,
    } = input;

    const congestionAvg = (portCongestionOrigin + portCongestionDestination) / 2;
    const distance = routeDistanceKm ?? Math.max(500, (origin.length + destination.length) * 120);

    // Feature weights roughly mimicking a random forest vote (higher weight → higher delay chance)
    const weatherScore = Math.min(1, Math.max(0, weatherIndex)) * 0.28;
    const congestionScore = Math.min(1, congestionAvg / 10) * 0.22;
    const reliabilityScore = (1 - Math.min(1, Math.max(0, vesselScheduleReliability))) * 0.18;
    const historyScore = Math.min(1, Math.max(0, historicalDelayRate)) * 0.22;
    const distanceScore = Math.min(1, distance / 9000) * 0.1;

    const probability = Math.min(0.97, Math.max(0.03, weatherScore + congestionScore + reliabilityScore + historyScore + distanceScore));

    let label: DelayRiskLevel = "low";
    if (probability >= 0.65) label = "high";
    else if (probability >= 0.35) label = "medium";

    // Convert weather factor to days impact
    const baseSpeed = transport === "air" ? 1500 : transport === "road" ? 700 : 520;
    const baseEta = Math.max(2, Math.round(distance / baseSpeed));
    const weatherFactor = getWeatherDelayFactor(new Date().getMonth(), transport);
    const congestionDays = Math.round((congestionAvg / 10) * 3);
    const historicalDays = Math.round(historicalDelayRate * 5);
    const expectedEtaDays = Math.max(1, Math.round(baseEta * weatherFactor + congestionDays + historicalDays));

    const reasons: string[] = [];
    if (weatherIndex > 0.35) reasons.push(`Weather risk ${(weatherIndex * 100).toFixed(0)}%`);
    if (congestionAvg >= 6) reasons.push("Port congestion on lane");
    if (vesselScheduleReliability < 0.7) reasons.push("Low vessel schedule reliability");
    if (historicalDelayRate > 0.3) reasons.push("Historical delays observed");
    if (distance > 6000 && transport === "sea") reasons.push("Long ocean leg increases risk");

    return {
        probability,
        label,
        expectedEtaDays,
        factors: reasons,
    };
}
