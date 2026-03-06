import { haversineDistanceKm, getSeaRouteMultiplier, getWeatherDelayFactor, LOCATION_COORDS } from "@/lib/shipmentData";

export type TransportMode = "sea" | "road" | "air";
export type PriceConfidence = "low" | "medium" | "high";

export type PricePrediction = {
    predictedPrice: number;
    currency: "INR" | "USD";
    confidence: PriceConfidence;
    factors: string[];
};

type ContainerType = "20ft" | "40ft" | "reefer" | "dry" | "lcl" | string;

function findLocation(name: string) {
    const direct = LOCATION_COORDS[name];
    if (direct) return direct;

    const lower = name.toLowerCase();
    const match = Object.entries(LOCATION_COORDS).find(([key]) =>
        key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase().split(",")[0]))
        ;
    return match ? match[1] : null;
}

function getDistanceKm(origin: string, destination: string, transport: TransportMode) {
    const originLoc = findLocation(origin);
    const destLoc = findLocation(destination);

    if (originLoc && destLoc) {
        const base = haversineDistanceKm(originLoc.lat, originLoc.lng, destLoc.lat, destLoc.lng);
        return transport === "sea" ? base * getSeaRouteMultiplier(origin, destination) : base;
    }

    // Fallback estimation based on string hash
    let hash = 0;
    const key = `${origin}-${destination}`;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return 500 + (hash % 6500);
}

function containerMultiplier(containerType: ContainerType) {
    const lower = containerType.toLowerCase();
    if (lower.includes("reefer")) return 1.35;
    if (lower.includes("40")) return 1.25;
    if (lower.includes("20")) return 1.05;
    return 1.0;
}

function transportMultiplier(transport: TransportMode) {
    if (transport === "air") return 2.8;
    if (transport === "road") return 1.4;
    return 1.0;
}

function seasonalMultiplier(month: number, transport: TransportMode) {
    const monthIndex = Math.max(0, Math.min(11, month));
    const weatherFactor = getWeatherDelayFactor(monthIndex, transport);
    const peak: Record<number, number> = { 2: 1.08, 3: 1.12, 8: 1.15, 9: 1.1, 10: 1.14, 11: 1.18 };
    return Math.max(1, (peak[monthIndex] ?? 1) * (1 + (weatherFactor - 1) * 0.6));
}

function confidenceScore(origin: string, destination: string, distanceKm: number): PriceConfidence {
    const knownOrigin = Boolean(findLocation(origin));
    const knownDest = Boolean(findLocation(destination));
    if (knownOrigin && knownDest) return distanceKm > 9000 ? "medium" : "high";
    if (knownOrigin || knownDest) return "medium";
    return "low";
}

export function predictFreightPrice(
    origin: string,
    destination: string,
    cbm: number,
    containerType: ContainerType,
    month: number,
    transport: TransportMode = "sea",
): PricePrediction {
    const safeCbm = Math.max(1, cbm || 1);
    const distanceKm = getDistanceKm(origin, destination, transport);

    // Base per-km-per-cbm rates by transport (approximate)
    const baseRate = transport === "air" ? 12.5 : transport === "road" ? 4.8 : 2.1;

    const containerFactor = containerMultiplier(containerType);
    const transportFactor = transportMultiplier(transport);
    const seasonFactor = seasonalMultiplier(month, transport);

    const predictedPrice = Math.round(distanceKm * safeCbm * baseRate * containerFactor * transportFactor * seasonFactor);
    const currency: "INR" | "USD" = destination.toLowerCase().includes("india") ? "INR" : "USD";
    const factors = [
        `Distance ${Math.round(distanceKm)} km`,
        `CBM ${safeCbm}`,
        `Container factor ${containerFactor.toFixed(2)}`,
        `Transport factor ${transportFactor.toFixed(2)}`,
        `Season factor ${seasonFactor.toFixed(2)}`,
    ];

    return {
        predictedPrice,
        currency,
        confidence: confidenceScore(origin, destination, distanceKm),
        factors,
    };
}
