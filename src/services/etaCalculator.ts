import type { TransportMode } from "@/services/bookingService";

export type EtaInput = {
    origin: string;
    destination: string;
    distanceKm: number;
    transportMode: TransportMode;
    departureDate?: string;
    historicalDelayDays?: number;
    portCongestion?: number; // 0-1 scale
    weatherRisk?: number; // 0-1 scale
};

export type EtaResult = {
    etaDate: string;
    etaDays: number;
    riskLevel: "low" | "medium" | "high";
    breakdown: {
        transitDays: number;
        congestionBuffer: number;
        weatherBuffer: number;
        historicalDelay: number;
    };
};

const speedByMode: Record<TransportMode, number> = {
    sea: 900,
    road: 650,
    air: 1500,
};

export function calculateSmartEta(input: EtaInput): EtaResult {
    const {
        origin,
        destination,
        distanceKm,
        transportMode,
        departureDate,
        historicalDelayDays = 0,
        portCongestion = 0.35,
        weatherRisk = 0.2,
    } = input;

    const baseSpeed = speedByMode[transportMode] || speedByMode.sea;
    const rawTransitDays = Math.max(1, Math.ceil(distanceKm / baseSpeed));

    const congestionBuffer = Math.round(rawTransitDays * (portCongestion * 0.6));
    const weatherBuffer = Math.round(rawTransitDays * (weatherRisk * 0.4));
    const historicalDelay = Math.round(historicalDelayDays);

    const etaDays = Math.max(1, rawTransitDays + congestionBuffer + weatherBuffer + historicalDelay);
    const riskScore = portCongestion * 0.5 + weatherRisk * 0.3 + Math.min(1, historicalDelay / 7) * 0.2;
    const riskLevel: EtaResult["riskLevel"] =
        riskScore > 0.6 ? "high" : riskScore > 0.35 ? "medium" : "low";

    const depart = departureDate ? new Date(departureDate) : new Date();
    const etaDate = new Date(depart.getTime() + etaDays * 24 * 60 * 60 * 1000);

    return {
        etaDate: etaDate.toISOString(),
        etaDays,
        riskLevel,
        breakdown: {
            transitDays: rawTransitDays,
            congestionBuffer,
            weatherBuffer,
            historicalDelay,
        },
    };
}
