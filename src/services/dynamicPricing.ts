export type DemandLevel = "low" | "medium" | "high";

export function calculateDynamicPrice(basePrice: number, demandLevel: DemandLevel): number {
    const safeBase = Math.max(0, basePrice);
    if (demandLevel === "high") return Math.round(safeBase * 1.18);
    if (demandLevel === "low") return Math.round(safeBase * 0.92);
    return Math.round(safeBase * 1.03);
}
