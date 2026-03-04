export type DelayRiskLevel = "low" | "medium" | "high";

export function predictDelayRisk(route: string, port: string, season: string) {
    const seed = `${route}-${port}-${season}`.length;
    const probability = Math.min(0.95, 0.25 + (seed % 50) / 100);
    const label: DelayRiskLevel = probability < 0.35 ? "low" : probability < 0.65 ? "medium" : "high";
    return { probability, label };
}
