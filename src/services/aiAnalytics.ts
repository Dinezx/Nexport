import { supabase } from "@/lib/supabase";
import { predictRouteDemand } from "@/ml/demandForecast";

export type RouteStat = { route: string; count: number };
export type DemandInsight = { route: string; level: "LOW" | "MEDIUM" | "HIGH"; score: number };

export type AiAnalytics = {
    busiestRoutes: RouteStat[];
    averageContainerUtilization: number;
    demandInsights: DemandInsight[];
    revenueForecast: number;
};

function buildRouteKey(origin: string, destination: string) {
    return `${origin || "unknown"} -> ${destination || "unknown"}`;
}

export async function getBusiestRoutes(limit: number = 5): Promise<RouteStat[]> {
    const { data } = await supabase
        .from("bookings")
        .select("origin, destination")
        .order("created_at", { ascending: false })
        .limit(200);

    const counts: Record<string, number> = {};
    (data || []).forEach((row) => {
        const key = buildRouteKey(row.origin, row.destination).toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts)
        .map(([route, count]) => ({ route, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

export async function getAverageContainerUtilization(): Promise<number> {
    const { data } = await supabase
        .from("containers")
        .select("available_space_cbm, total_space_cbm")
        .limit(300);

    const containers = data || [];
    if (containers.length === 0) return 0;

    const utilizationSum = containers.reduce((acc, c) => {
        if (!c.total_space_cbm) return acc;
        const used = Math.max(0, (c.total_space_cbm || 0) - (c.available_space_cbm || 0));
        return acc + used / c.total_space_cbm;
    }, 0);

    return Math.round((utilizationSum / containers.length) * 100);
}

export async function getDemandInsights(routes: RouteStat[]): Promise<DemandInsight[]> {
    const currentMonth = new Date().getMonth();
    const topRoutes = routes.slice(0, 3);
    const results: DemandInsight[] = [];

    for (const r of topRoutes) {
        const insight = await predictRouteDemand(r.route, currentMonth + 1);
        results.push({ route: r.route, level: insight.level, score: insight.score });
    }

    return results;
}

export async function getRevenueForecast(): Promise<number> {
    const { data } = await supabase
        .from("bookings")
        .select("price")
        .order("created_at", { ascending: false })
        .limit(200);

    const total = (data || []).reduce((acc, row) => acc + (row.price || 0), 0);
    // Simple forward-looking uplift
    return Math.round(total * 1.08);
}

export async function generateAiAnalytics(): Promise<AiAnalytics> {
    const busiestRoutes = await getBusiestRoutes();
    const [averageContainerUtilization, demandInsights, revenueForecast] = await Promise.all([
        getAverageContainerUtilization(),
        getDemandInsights(busiestRoutes),
        getRevenueForecast(),
    ]);

    return { busiestRoutes, averageContainerUtilization, demandInsights, revenueForecast };
}
