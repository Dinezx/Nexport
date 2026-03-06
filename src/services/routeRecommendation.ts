import { predictEtaAndRisk } from "@/lib/prediction";

export type TransportMode = "sea" | "road" | "air";

export type RouteRecommendation = {
    suggestedRoute: string;
    estimatedTransitDays: number;
    congestionLevel: string;
    delayRisk: "low" | "medium" | "high";
    notes: string[];
};

export function recommendRoute(
    origin: string,
    destination: string,
    transport: TransportMode = "sea",
    cbm: number = 1,
    bookingMode: "full" | "partial" = "full",
): RouteRecommendation {
    const eta = predictEtaAndRisk({ origin, destination, transport, bookingMode, cbm });

    const notes = [
        `Transit distance factors included for ${transport} freight`,
        `Customs and handling considered in ETA range ${eta.etaRange.min}-${eta.etaRange.max} days`,
    ];

    if (eta.breakdown.weatherImpact > 0) {
        notes.push(`Weather impact adds ~${eta.breakdown.weatherImpact}% to schedule`);
    }
    if (eta.delayReason) notes.push(eta.delayReason);

    return {
        suggestedRoute: `${origin} -> ${destination}`,
        estimatedTransitDays: eta.etaDays,
        congestionLevel: eta.breakdown.congestionImpact,
        delayRisk: eta.delayRisk,
        notes,
    };
}
