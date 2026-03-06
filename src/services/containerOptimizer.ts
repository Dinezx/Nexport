export type ShipmentBooking = {
    id: string;
    cbm: number;
    priority?: "standard" | "express";
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

function pickContainerSize(cbm: number): "20ft" | "40ft" {
    if (cbm > 33) return "40ft";
    return cbm > 18 ? "40ft" : "20ft";
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
