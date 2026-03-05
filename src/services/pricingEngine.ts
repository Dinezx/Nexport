import { supabase } from "@/lib/supabase";
import type { ContainerType, TransportMode } from "@/services/bookingService";

export type PricingRoute = { origin: string; destination: string };

export type PricingBreakdown = {
    total: number;
    base: number;
    portHandling: number;
    seasonal: number;
    congestion: number;
    logisticsMargin: number;
    currency: "INR";
    notes: string[];
};

export type PricingRules = {
    baseRatePerCbm: Record<TransportMode, number>;
    containerTypeMultiplier: Record<ContainerType | "lcl", number>;
    portHandlingFlat: number;
    portHandlingPct: number;
    logisticsMarginPct: number;
    congestionSurchargePct: number;
    seasonalMultiplier: Record<number, number>; // month index => multiplier
};

export const defaultPricingRules: PricingRules = {
    baseRatePerCbm: {
        sea: 3100,
        road: 2200,
        air: 5200,
    },
    containerTypeMultiplier: {
        normal: 1,
        dry: 1.05,
        reefer: 1.18,
        lcl: 0.92,
    },
    portHandlingFlat: 4800,
    portHandlingPct: 0.08,
    logisticsMarginPct: 0.12,
    congestionSurchargePct: 0.06,
    seasonalMultiplier: {
        0: 0.94,
        1: 0.97,
        2: 1.0,
        3: 1.04,
        4: 1.08,
        5: 1.1,
        6: 1.06,
        7: 1.02,
        8: 0.98,
        9: 1.05,
        10: 1.12,
        11: 1.2,
    },
};

function normalizeRoute(route: PricingRoute | string): PricingRoute {
    if (typeof route === "string") {
        const parts = route.split("->");
        if (parts.length === 2) {
            return { origin: parts[0].trim(), destination: parts[1].trim() };
        }
        const dashParts = route.split("-");
        if (dashParts.length === 2) {
            return { origin: dashParts[0].trim(), destination: dashParts[1].trim() };
        }
        return { origin: route.trim(), destination: "" };
    }
    return route;
}

export async function fetchPricingRules(): Promise<PricingRules> {
    try {
        const { data, error } = await supabase
            .from("pricing_rules")
            .select("rules")
            .order("updated_at", { ascending: false })
            .maybeSingle();

        if (error || !data?.rules) return defaultPricingRules;
        const parsed = typeof data.rules === "string" ? JSON.parse(data.rules) : data.rules;
        return { ...defaultPricingRules, ...parsed } as PricingRules;
    } catch {
        return defaultPricingRules;
    }
}

export function calculateFreightPrice(
    routeInput: PricingRoute | string,
    cbm: number,
    containerType: ContainerType,
    transportMode: TransportMode,
    rules: PricingRules = defaultPricingRules
): PricingBreakdown {
    const route = normalizeRoute(routeInput);
    const safeCbm = Math.max(0, Number(cbm) || 0);
    const baseRate = rules.baseRatePerCbm[transportMode] || rules.baseRatePerCbm.sea;
    const typeMultiplier = rules.containerTypeMultiplier[containerType] ?? 1;
    const seasonalMultiplier = rules.seasonalMultiplier[new Date().getMonth()] ?? 1;

    // Simple route complexity heuristic (long-haul ocean lanes carry a small uplift)
    const longHaul = route.origin.toLowerCase().includes("india") && !route.destination.toLowerCase().includes("india");
    const distanceUplift = longHaul && transportMode === "sea" ? 1.08 : 1;

    const base = Math.round(baseRate * safeCbm * typeMultiplier * distanceUplift);
    const portHandling = Math.round(rules.portHandlingFlat + base * rules.portHandlingPct);
    const seasonal = Math.round(base * (seasonalMultiplier - 1));
    const congestion = Math.round(base * rules.congestionSurchargePct);
    const logisticsMargin = Math.round((base + portHandling + seasonal + congestion) * rules.logisticsMarginPct);

    const total = Math.max(
        0,
        base + portHandling + seasonal + congestion + logisticsMargin,
    );

    const notes: string[] = [
        `${transportMode.toUpperCase()} rate applied with ${containerType} container profile`,
        `Seasonal factor ${seasonalMultiplier.toFixed(2)} for month ${new Date().getMonth() + 1}`,
        longHaul ? "Long-haul adjustment added for cross-border routing" : "Standard lane profile used",
    ];

    return {
        total,
        base,
        portHandling,
        seasonal,
        congestion,
        logisticsMargin,
        currency: "INR",
        notes,
    };
}
