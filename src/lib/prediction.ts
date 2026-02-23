type TransportMode = "sea" | "road" | "air";
type BookingMode = "full" | "partial";

const SPEED_KM_PER_DAY: Record<TransportMode, number> = {
  sea: 700,
  road: 450,
  air: 2200,
};

const CONFIDENCE_BY_MODE: Record<TransportMode, "high" | "medium"> = {
  sea: "high",
  road: "medium",
  air: "high",
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const estimateDistanceKm = (origin: string, destination: string): number => {
  const seed = hashString(`${origin}-${destination}`);
  const base = 300 + (seed % 7000);
  return Math.max(300, base);
};

export const predictEtaAndRisk = (params: {
  origin: string;
  destination: string;
  transport: TransportMode;
  bookingMode: BookingMode;
  cbm: number;
}): {
  etaDays: number;
  etaConfidence: "high" | "medium";
  delayRisk: "low" | "medium" | "high";
  delayReason: string;
} => {
  const distanceKm = estimateDistanceKm(params.origin, params.destination);
  const speed = SPEED_KM_PER_DAY[params.transport] || 600;
  const rawDays = distanceKm / speed;
  const etaDays = Math.max(1, Math.round(rawDays));

  let delayRisk: "low" | "medium" | "high" = "low";
  let delayReason = "Standard transit conditions.";

  if (params.transport === "sea" && distanceKm > 4000) {
    delayRisk = "medium";
    delayReason = "Long ocean route with transshipment risk.";
  }
  if (params.transport === "road" && distanceKm > 1500) {
    delayRisk = "medium";
    delayReason = "Long-haul road route with border/traffic exposure.";
  }
  if (params.bookingMode === "partial" && params.cbm > 15) {
    delayRisk = "medium";
    delayReason = "High utilization LCL booking can add consolidation time.";
  }
  if (params.transport === "air" && distanceKm > 8000) {
    delayRisk = "medium";
    delayReason = "Ultra-long haul air route with possible capacity constraints.";
  }
  if (params.transport === "sea" && params.bookingMode === "partial" && distanceKm > 5000) {
    delayRisk = "high";
    delayReason = "Long LCL ocean route with multi-port handling risk.";
  }

  return {
    etaDays,
    etaConfidence: CONFIDENCE_BY_MODE[params.transport] || "medium",
    delayRisk,
    delayReason,
  };
};
