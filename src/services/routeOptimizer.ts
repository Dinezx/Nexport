import { supabase } from "@/lib/supabase";
import type { TransportMode } from "@/services/bookingService";

export type RouteOptimizationResult = {
    suggestedPorts: string[];
    estimatedDays: number;
    congestionRisk: "low" | "medium" | "high";
    rationale: string;
};

const portTrafficIndex: Record<string, number> = {
    "singapore": 0.8,
    "dubai": 0.72,
    "jebel ali": 0.7,
    "mumbai": 0.65,
    "chennai": 0.6,
    "cochin": 0.55,
    "rotterdam": 0.82,
    "los angeles": 0.78,
    "new york": 0.76,
};

function normalize(str: string) {
    return str.toLowerCase();
}

function estimateTransitDays(origin: string, destination: string, transportMode: TransportMode) {
    const sameCountry = normalize(origin).includes("india") && normalize(destination).includes("india");
    if (transportMode === "air") return sameCountry ? 3 : 5;
    if (transportMode === "road") return sameCountry ? 5 : 9;
    return sameCountry ? 9 : 18;
}

async function fetchLiveCongestion(port: string): Promise<number | null> {
    try {
        const { data } = await supabase
            .from("port_congestion")
            .select("congestion_score")
            .ilike("port", `%${port}%`)
            .order("reported_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!data?.congestion_score) return null;
        return Number(data.congestion_score);
    } catch {
        return null;
    }
}

export async function getOptimalRoute(
    origin: string,
    destination: string,
    transportMode: TransportMode = "sea"
): Promise<RouteOptimizationResult> {
    const normalizedOrigin = normalize(origin);
    const normalizedDestination = normalize(destination);

    const commonHubs = ["Singapore Port", "Jebel Ali Port", "Colombo Port"];
    const originHub = commonHubs.find((p) => normalizedOrigin.includes(p.split(" ")[0].toLowerCase()));
    const destinationHub = commonHubs.find((p) => normalizedDestination.includes(p.split(" ")[0].toLowerCase()));

    const hops = [origin];
    if (originHub && originHub !== origin) hops.push(originHub);
    if (destinationHub && destinationHub !== destination) hops.push(destinationHub);
    hops.push(destination);

    const baseDays = estimateTransitDays(origin, destination, transportMode);
    const originCongestion = portTrafficIndex[normalizedOrigin.split(" ")[0]] ?? 0.4;
    const destinationCongestion = portTrafficIndex[normalizedDestination.split(" ")[0]] ?? 0.4;

    const liveOrigin = await fetchLiveCongestion(origin);
    const liveDestination = await fetchLiveCongestion(destination);

    const congestionScore = Math.max(
        originCongestion,
        destinationCongestion,
        liveOrigin ?? 0,
        liveDestination ?? 0,
    );

    const congestionRisk: RouteOptimizationResult["congestionRisk"] =
        congestionScore > 0.75 ? "high" : congestionScore > 0.55 ? "medium" : "low";

    const congestionPenalty = congestionRisk === "high" ? 6 : congestionRisk === "medium" ? 3 : 0;
    const estimatedDays = baseDays + congestionPenalty;

    const rationale = [
        `Base transit estimate for ${transportMode} is ${baseDays} days`,
        congestionRisk !== "low" ? "Added buffer for congestion risk" : "Low congestion expected",
        hops.length > 2 ? "Hub-and-spoke path selected for reliability" : "Direct routing applied",
    ].join(" · ");

    return {
        suggestedPorts: hops,
        estimatedDays,
        congestionRisk,
        rationale,
    };
}
