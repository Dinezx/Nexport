import { calculateFreightPrice } from "@/services/pricingEngine";
import { getOptimalRoute } from "@/services/routeOptimizer";
import type { ContainerType, TransportMode } from "@/services/bookingService";

export type RecommendationInput = {
    origin: string;
    destination: string;
    cbm: number;
    weightKg?: number;
    containerType?: ContainerType;
    transportMode?: TransportMode;
};

export type Recommendation = {
    mode: "LCL" | "FCL";
    suggestedContainer: {
        type: ContainerType;
        size: "20ft" | "40ft";
    } | null;
    cheapestRoute: {
        ports: string[];
        estimatedDays: number;
        congestionRisk: string;
    } | null;
    estimatedPrice: number | null;
    notes: string[];
};

function pickContainerSize(cbm: number): "20ft" | "40ft" {
    if (cbm > 33) return "40ft";
    return "20ft";
}

export async function recommendBookingOption(input: RecommendationInput): Promise<Recommendation> {
    const cbm = Math.max(0, input.cbm);
    const transportMode: TransportMode = input.transportMode || "sea";
    const containerType: ContainerType = input.containerType || "dry";

    const mode: Recommendation["mode"] = cbm >= 18 ? "FCL" : "LCL";
    const suggestedContainer = mode === "FCL"
        ? { type: containerType, size: pickContainerSize(cbm) }
        : null;

    let cheapestRoute: Recommendation["cheapestRoute"] = null;
    try {
        const route = await getOptimalRoute(input.origin, input.destination, transportMode);
        cheapestRoute = {
            ports: route.suggestedPorts,
            estimatedDays: route.estimatedDays,
            congestionRisk: route.congestionRisk,
        };
    } catch {
        cheapestRoute = null;
    }

    let estimatedPrice: number | null = null;
    const notes: string[] = [];
    try {
        const price = calculateFreightPrice(
            { origin: input.origin, destination: input.destination },
            cbm,
            containerType,
            transportMode,
        );
        estimatedPrice = price.total;
        notes.push(...price.notes);
    } catch {
        notes.push("Price estimation unavailable; using heuristic suggestion only.");
    }

    if (mode === "LCL") {
        notes.push("Recommended LCL for efficiency under 18 CBM.");
    } else {
        notes.push("FCL recommended for cost efficiency at higher volume.");
    }

    return {
        mode,
        suggestedContainer,
        cheapestRoute,
        estimatedPrice,
        notes,
    };
}
