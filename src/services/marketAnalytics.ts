import { supabase } from "@/lib/supabase";

export type MarketAnalytics = {
    busiestRoutes: { route: string; bookings: number; revenue: number }[];
    demandTrends: { month: string; bookings: number }[];
    providerPerformance: { providerId: string; bookings: number; onTimeRate: number }[];
    revenueGrowth: { month: string; revenue: number }[];
    activeShipments: number;
    activeContainers: number;
};

function formatMonth(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function aggregate(bookings: any[]) {
    const routeMap: Record<string, { bookings: number; revenue: number }> = {};
    const trendMap: Record<string, number> = {};
    const revenueMap: Record<string, number> = {};

    for (const b of bookings) {
        const route = `${b.origin} → ${b.destination}`;
        if (!routeMap[route]) routeMap[route] = { bookings: 0, revenue: 0 };
        routeMap[route].bookings += 1;
        routeMap[route].revenue += b.price ?? 0;

        const month = formatMonth(b.created_at || new Date().toISOString());
        trendMap[month] = (trendMap[month] || 0) + 1;
        revenueMap[month] = (revenueMap[month] || 0) + (b.price ?? 0);
    }

    return {
        routeMap,
        trendMap,
        revenueMap,
    };
}

export function buildMarketAnalyticsFromData(bookings: any[], containers: any[]): MarketAnalytics {
    const { routeMap, trendMap, revenueMap } = aggregate(bookings || []);

    const busiestRoutes = Object.entries(routeMap)
        .map(([route, stats]) => ({ route, ...stats }))
        .sort((a, b) => b.bookings - a.bookings)
        .slice(0, 5);

    const demandTrends = Object.entries(trendMap)
        .map(([month, bookingsCount]) => ({ month, bookings: bookingsCount }))
        .sort((a, b) => a.month.localeCompare(b.month));

    const revenueGrowth = Object.entries(revenueMap)
        .map(([month, revenue]) => ({ month, revenue }))
        .sort((a, b) => a.month.localeCompare(b.month));

    const providerPerformance = Object.values(
        bookings.reduce((acc: Record<string, { providerId: string; bookings: number; onTime: number }>, b: any) => {
            const providerId = (b as any).provider_id || (b as any).user_id || "unknown";
            if (!acc[providerId]) acc[providerId] = { providerId, bookings: 0, onTime: 0 };
            acc[providerId].bookings += 1;
            if (["completed", "delivered"].includes(b.status)) acc[providerId].onTime += 1;
            return acc;
        }, {})
    ).map((p) => ({
        providerId: p.providerId,
        bookings: p.bookings,
        onTimeRate: p.bookings > 0 ? Math.round((p.onTime / p.bookings) * 100) : 0,
    }));

    const activeShipments = bookings.filter(
        (b) => !["completed", "delivered", "cancelled"].includes(b.status)
    ).length;

    const activeContainers = containers.filter((c) => c.status !== "full").length;

    return {
        busiestRoutes,
        demandTrends,
        providerPerformance,
        revenueGrowth,
        activeShipments,
        activeContainers,
    };
}

export async function fetchMarketAnalytics(): Promise<MarketAnalytics> {
    const [bkRes, ctrRes] = await Promise.all([
        supabase.from("bookings").select("id, origin, destination, status, price, created_at, provider_id, user_id"),
        supabase.from("containers").select("id, status"),
    ]);

    if (bkRes.error) throw bkRes.error;
    if (ctrRes.error) throw ctrRes.error;

    return buildMarketAnalyticsFromData(bkRes.data || [], ctrRes.data || []);
}
