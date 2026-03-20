import {
  LOCATION_COORDS,
  HISTORICAL_ROUTES,
  CUSTOMS_DAYS,
  TRANSPORT_SPEEDS,
  haversineDistanceKm,
  getSeaRouteMultiplier,
  getWeatherDelayFactor,
  getPortHandlingDays,
  type LocationCoord,
} from "./shipmentData";

type TransportMode = "sea" | "road" | "air";
type BookingMode = "full" | "partial";

// ─── Find closest known location for a given name ───────────────────────────

function findLocation(name: string, preferredType?: "port" | "airport" | "icd"): LocationCoord | null {
  if (LOCATION_COORDS[name]) return LOCATION_COORDS[name];

  const lower = name.toLowerCase();
  const candidates: { key: string; coord: LocationCoord; score: number }[] = [];

  for (const [key, coord] of Object.entries(LOCATION_COORDS)) {
    const kLower = key.toLowerCase();
    if (kLower.includes(lower) || lower.includes(kLower.split(",")[0].split(" ")[0])) {
      let score = 1;
      // Prefer matching type (airport for air, port for sea)
      if (preferredType && coord.type === preferredType) score += 10;
      // Prefer more specific name overlap
      if (kLower.includes(lower.split(",")[0].trim())) score += 5;
      candidates.push({ key, coord, score });
    }
  }

  if (candidates.length) {
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].coord;
  }

  // Try matching city name
  const city = lower.split(",")[0].trim().split(" ")[0];
  const cityMatches: { key: string; coord: LocationCoord; score: number }[] = [];
  for (const [key, coord] of Object.entries(LOCATION_COORDS)) {
    if (key.toLowerCase().includes(city)) {
      let score = 1;
      if (preferredType && coord.type === preferredType) score += 10;
      cityMatches.push({ key, coord, score });
    }
  }

  if (cityMatches.length) {
    cityMatches.sort((a, b) => b.score - a.score);
    return cityMatches[0].coord;
  }

  return null;
}

function getCountry(name: string): string {
  const loc = findLocation(name);
  return loc?.country || "India";
}

// ─── Get real distance between two locations ────────────────────────────────

function getRealDistanceKm(origin: string, destination: string, transport: TransportMode): number {
  const o = findLocation(origin);
  const d = findLocation(destination);

  if (o && d) {
    const gcDist = haversineDistanceKm(o.lat, o.lng, d.lat, d.lng);
    if (transport === "sea") return gcDist * getSeaRouteMultiplier(origin, destination);
    if (transport === "road") return gcDist * 1.3; // Road routes are ~1.3x straight-line
    return gcDist; // Air is close to great-circle
  }

  // Fallback: estimate from name hash (legacy)
  let hash = 0;
  const key = `${origin}-${destination}`;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return Math.max(300, 300 + (hash % 7000));
}

// ─── Check for historical route data ────────────────────────────────────────

function findHistoricalRoute(origin: string, destination: string, transport: TransportMode) {
  // Exact match
  const exact = HISTORICAL_ROUTES.find(
    (r) => r.origin === origin && r.destination === destination && r.transport === transport
  );
  if (exact) return exact;

  // Reverse route (typically similar transit time)
  const reverse = HISTORICAL_ROUTES.find(
    (r) => r.origin === destination && r.destination === origin && r.transport === transport
  );
  if (reverse) return reverse;

  // Fuzzy match by city names
  const oCity = origin.toLowerCase().split(",")[0].split(" ")[0];
  const dCity = destination.toLowerCase().split(",")[0].split(" ")[0];
  return HISTORICAL_ROUTES.find(
    (r) =>
      r.transport === transport &&
      r.origin.toLowerCase().includes(oCity) &&
      r.destination.toLowerCase().includes(dCity)
  ) || null;
}

// ─── Main ETA prediction with real-world data ───────────────────────────────

export const predictEtaAndRisk = (params: {
  origin: string;
  destination: string;
  transport: TransportMode;
  bookingMode: BookingMode;
  cbm: number;
  distanceKm?: number;
}): {
  etaDays: number;
  etaRange: { min: number; max: number };
  etaConfidence: "high" | "medium" | "low";
  delayRisk: "low" | "medium" | "high";
  delayReason: string;
  breakdown: {
    transitDays: number;
    originHandling: number;
    destHandling: number;
    customsClearance: number;
    weatherImpact: number;
    congestionImpact: string;
  };
} => {
  const currentMonth = new Date().getMonth();
  const distanceKm = params.distanceKm ?? getRealDistanceKm(params.origin, params.destination, params.transport);

  // ── Try historical data first ──
  const historical = findHistoricalRoute(params.origin, params.destination, params.transport);

  // ── Location metadata (transport-aware matching) ──
  const preferredType = params.transport === "air" ? "airport" : params.transport === "sea" ? "port" : undefined;
  const originLoc = findLocation(params.origin, preferredType);
  const destLoc = findLocation(params.destination, preferredType);
  const originCongestion = originLoc?.congestionIndex ?? 5;
  const destCongestion = destLoc?.congestionIndex ?? 5;
  const originType = originLoc?.type ?? "port";
  const destType = destLoc?.type ?? "port";
  const originCountry = originLoc?.country ?? getCountry(params.origin);
  const destCountry = destLoc?.country ?? getCountry(params.destination);
  const isDomestic = originCountry === destCountry;

  // ── Port/terminal handling (reduced for domestic) ──
  let originHandling = getPortHandlingDays(originCongestion, originType);
  let destHandling = getPortHandlingDays(destCongestion, destType);
  if (isDomestic) {
    // Domestic routes have simpler handling — no international procedures
    originHandling *= 0.4;
    destHandling *= 0.4;
  }

  // ── Customs clearance (zero for domestic routes) ──
  const totalCustoms = isDomestic
    ? 0
    : (CUSTOMS_DAYS[originCountry]?.export ?? 2.5) + (CUSTOMS_DAYS[destCountry]?.import ?? 3.5);

  // ── Weather factor ──
  const weatherFactor = getWeatherDelayFactor(currentMonth, params.transport);

  // ── Transit time calculation ──
  let transitDays: number;
  let etaDays: number;
  let confidence: "high" | "medium" | "low";

  if (historical) {
    // Use historical data with weather adjustment
    transitDays = historical.avgDays * weatherFactor;
    // Historical data already includes most delays, so add only weather delta
    etaDays = Math.round(transitDays);
    confidence = historical.sampleSize > 500 ? "high" : "medium";
  } else {
    // Calculate from physics + data
    const speed = TRANSPORT_SPEEDS[params.transport];
    const effectiveSpeed = speed.avgKmPerDay;
    transitDays = (distanceKm / effectiveSpeed) * weatherFactor;
    etaDays = Math.round(transitDays + originHandling + destHandling + totalCustoms);
    confidence = originLoc && destLoc ? "medium" : "low";
  }

  // ── LCL/partial consolidation extra ──
  if (params.bookingMode === "partial") {
    const lclExtra = params.cbm > 15 ? 2 : 1;
    etaDays += lclExtra;
  }

  etaDays = Math.max(1, etaDays);

  // ── ETA range ──
  let minDays: number, maxDays: number;
  if (historical) {
    minDays = historical.minDays;
    maxDays = Math.round(historical.maxDays * weatherFactor);
  } else {
    minDays = Math.max(1, Math.round(etaDays * 0.75));
    maxDays = Math.round(etaDays * 1.35);
  }

  // ── Delay risk assessment ──
  let delayRisk: "low" | "medium" | "high" = "low";
  let delayReason = "Standard transit conditions expected.";
  const riskFactors: string[] = [];

  // Congestion risk
  if (originCongestion >= 8 || destCongestion >= 8) {
    riskFactors.push(`High port congestion (${originCongestion >= 8 ? params.origin : params.destination}: ${Math.max(originCongestion, destCongestion)}/10)`);
  }

  // Weather risk
  if (weatherFactor > 1.15) {
    riskFactors.push(`Seasonal weather impact (+${Math.round((weatherFactor - 1) * 100)}% transit time)`);
  }

  // Long-haul risk
  if (params.transport === "sea" && distanceKm > 6000) {
    riskFactors.push("Long ocean route with potential transshipment");
  }
  if (params.transport === "road" && distanceKm > 2000) {
    riskFactors.push("Extended overland route with border crossing risk");
  }

  // Customs risk
  if (totalCustoms > 7) {
    riskFactors.push(`Extended customs clearance expected (~${Math.round(totalCustoms)} days)`);
  }

  // LCL risk
  if (params.bookingMode === "partial" && params.cbm > 15) {
    riskFactors.push("High-utilization LCL cargo may require consolidation wait");
  }

  if (riskFactors.length >= 3) {
    delayRisk = "high";
    delayReason = riskFactors.slice(0, 3).join(". ") + ".";
  } else if (riskFactors.length >= 1) {
    delayRisk = "medium";
    delayReason = riskFactors.join(". ") + ".";
  }

  const congestionLabel =
    Math.max(originCongestion, destCongestion) >= 7
      ? "High"
      : Math.max(originCongestion, destCongestion) >= 4
        ? "Moderate"
        : "Low";

  return {
    etaDays,
    etaRange: { min: minDays, max: maxDays },
    etaConfidence: confidence,
    delayRisk,
    delayReason,
    breakdown: {
      transitDays: Math.round(transitDays * 10) / 10,
      originHandling: Math.round(originHandling * 10) / 10,
      destHandling: Math.round(destHandling * 10) / 10,
      customsClearance: Math.round(totalCustoms * 10) / 10,
      weatherImpact: weatherFactor > 1 ? Math.round((weatherFactor - 1) * 100) : 0,
      congestionImpact: congestionLabel,
    },
  };
};
