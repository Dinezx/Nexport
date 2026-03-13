import { predictEtaAndRisk } from "@/lib/prediction";
import { predictFreightPrice } from "@/services/pricePrediction";

export type TransportMode = "sea" | "road" | "air";

export type RouteRecommendation = {
    suggestedRoute: string;
    estimatedTransitDays: number;
    estimatedCost?: string;
    congestionLevel: string;
    delayRisk: "low" | "medium" | "high";
    notes: string[];
    score: number;
    recommendedMode: TransportMode;
};

export function recommendRoute(
    origin: string,
    destination: string,
    transport: TransportMode = "sea",
    cbm: number = 1,
    bookingMode: "full" | "partial" = "full",
): RouteRecommendation {
    const eta = predictEtaAndRisk({ origin, destination, transport, bookingMode, cbm });
    const price = predictFreightPrice(origin, destination, cbm, `${bookingMode === "partial" ? "lcl" : "40ft"}`, new Date().getMonth(), transport);

    // Simple graph-style score combining time, risk, and cost (normalized 0-100)
    const timeScore = Math.max(0, 100 - eta.etaDays * 2);
    const riskScore = eta.delayRisk === "low" ? 100 : eta.delayRisk === "medium" ? 70 : 40;
    const costScore = Math.max(30, 100 - price.predictedPrice / 1500);
    const composite = Math.round((timeScore * 0.4 + riskScore * 0.35 + costScore * 0.25));

    const notes = [
        `Transit distance factors included for ${transport} freight`,
        `Customs and handling considered in ETA range ${eta.etaRange.min}-${eta.etaRange.max} days`,
        `Cost estimate ${price.currency} ${price.predictedPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    ];

    if (eta.breakdown.weatherImpact > 0) {
        notes.push(`Weather impact adds ~${eta.breakdown.weatherImpact}% to schedule`);
    }
    if (eta.delayReason) notes.push(eta.delayReason);

    return {
        suggestedRoute: `${origin} -> ${destination}`,
        estimatedTransitDays: eta.etaDays,
        estimatedCost: `${price.currency} ${price.predictedPrice.toLocaleString()}`,
        congestionLevel: eta.breakdown.congestionImpact,
        delayRisk: eta.delayRisk,
        notes,
        score: composite,
        recommendedMode: transport,
    };
}
