export type ShipmentBooking = {
    id: string;
    cbm: number;
    priority?: "standard" | "express";
};

export type CargoDimensions = {
    id?: string;
    length: number; // meters
    width: number; // meters
    height: number; // meters
    quantity: number;
    priority?: "standard" | "express";
};

export type ContainerSuggestion = {
    recommendation: "LCL" | "20FT" | "40FT";
    rationale: string[];
    totalCbm: number;
};

export type OptimizedContainer = {
    containerId: string;
    size: "20ft" | "40ft";
    capacity: number;
    utilizedCbm: number;
    remainingCbm: number;
    bookings: ShipmentBooking[];
};

const CONTAINER_CAPACITY: Record<"20ft" | "40ft", number> = {
    "20ft": 33,
    "40ft": 67,
};

const CBM_THRESHOLDS = {
    lcl: 15,
    twenty: 28,
    forty: 58,
};

function pickContainerSize(cbm: number): "20ft" | "40ft" {
    if (cbm > 33) return "40ft";
    return cbm > 18 ? "40ft" : "20ft";
}

function mapCbmToSuggestion(totalCbm: number): ContainerSuggestion {
    if (totalCbm < CBM_THRESHOLDS.lcl) {
        return { recommendation: "LCL", rationale: ["Volume under 15 CBM — economical as LCL"], totalCbm };
    }
    if (totalCbm < CBM_THRESHOLDS.twenty) {
        return {
            recommendation: "20FT",
            rationale: ["Fits comfortably in 20FT with room for padding"],
            totalCbm,
        };
    }
    if (totalCbm < CBM_THRESHOLDS.forty) {
        return {
            recommendation: "40FT",
            rationale: ["Volume exceeds 20FT sweet spot; 40FT prevents split loads"],
            totalCbm,
        };
    }
    return {
        recommendation: "40FT",
        rationale: ["High volume — consider multiple 40FTs or consolidation"],
        totalCbm,
    };
}

export function calculateCbm(dimensions: CargoDimensions, opts: { perUnit?: boolean } = {}): number {
    const base = Math.max(0, dimensions.length) * Math.max(0, dimensions.width) * Math.max(0, dimensions.height);
    const safeQty = Math.max(1, dimensions.quantity || 1);
    const total = opts.perUnit ? base : base * safeQty;
    // Convert cubic meters inputs directly; assume dimensions are already meters
    return Math.round((total + Number.EPSILON) * 100) / 100;
}

export function suggestContainer(dimensions: CargoDimensions | CargoDimensions[]): ContainerSuggestion {
    const list = Array.isArray(dimensions) ? dimensions : [dimensions];
    const totalCbm = list.reduce((sum, item) => sum + calculateCbm(item, { perUnit: false }), 0);
    const baseSuggestion = mapCbmToSuggestion(totalCbm);
    const rationale = [...baseSuggestion.rationale];

    if (totalCbm > CONTAINER_CAPACITY["40ft"]) {
        const count = Math.ceil(totalCbm / CONTAINER_CAPACITY["40ft"]);
        rationale.push(`Estimated ${count} x 40FT needed at current volume`);
    } else if (totalCbm > CONTAINER_CAPACITY["20ft"]) {
        rationale.push("Borderline 20FT load — check for weight and stacking clearance");
    }

    return { ...baseSuggestion, rationale };
}

export function optimizeContainerSpace(bookings: ShipmentBooking[]): OptimizedContainer[] {
    const sorted = [...bookings].sort((a, b) => b.cbm - a.cbm);
    const containers: OptimizedContainer[] = [];

    for (const booking of sorted) {
        const requiredSize = pickContainerSize(booking.cbm);
        const capacity = CONTAINER_CAPACITY[requiredSize];

        // Try to fit into an existing container with minimal leftover
        let bestContainer: OptimizedContainer | null = null;
        for (const c of containers) {
            if (c.size !== requiredSize) continue;
            if (c.remainingCbm >= booking.cbm) {
                if (!bestContainer || c.remainingCbm < bestContainer.remainingCbm) {
                    bestContainer = c;
                }
            }
        }

        if (bestContainer) {
            bestContainer.bookings.push(booking);
            bestContainer.utilizedCbm += booking.cbm;
            bestContainer.remainingCbm = Math.max(0, bestContainer.capacity - bestContainer.utilizedCbm);
        } else {
            const containerId = `AUTO-${containers.length + 1}`;
            containers.push({
                containerId,
                size: requiredSize,
                capacity,
                utilizedCbm: booking.cbm,
                remainingCbm: Math.max(0, capacity - booking.cbm),
                bookings: [booking],
            });
        }
    }

    // Re-sort containers by utilization (descending)
    return containers.sort((a, b) => (b.utilizedCbm / b.capacity) - (a.utilizedCbm / a.capacity));
}

export function planBinPacking(cargo: CargoDimensions[]) {
    const shipments: ShipmentBooking[] = cargo.flatMap((item, idx) => {
        const perUnit = calculateCbm(item, { perUnit: true });
        const qty = Math.max(1, item.quantity || 1);
        return Array.from({ length: qty }).map((_, i) => ({
            id: item.id || `${idx + 1}-${i + 1}`,
            cbm: perUnit,
            priority: item.priority || "standard",
        }));
    });

    const plan = optimizeContainerSpace(shipments);
    const totalCbm = cargo.reduce((sum, item) => sum + calculateCbm(item, { perUnit: false }), 0);
    const suggestion = mapCbmToSuggestion(totalCbm);
    const utilization = plan.length
        ? Math.round(
            (plan.reduce((acc, c) => acc + c.utilizedCbm, 0) /
                plan.reduce((acc, c) => acc + c.capacity, 0)) *
            100
        )
        : 0;

    return {
        suggestion,
        containers: plan,
        utilization,
        notes: [
            `Planned using best-fit decreasing to reduce empty space`,
            `Overall utilization ${utilization}% across ${plan.length} container(s)`,
        ],
        totalCbm,
    };
}
