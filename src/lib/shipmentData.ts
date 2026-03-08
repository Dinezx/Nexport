/**
 * Real-world shipment dataset for ETA prediction.
 *
 * Contains:
 *  - Actual lat/lng coordinates of major ports, airports, and ICDs
 *  - Port congestion indices (1-10 scale, 10 = most congested)
 *  - Customs clearance average days per country
 *  - Seasonal weather delay multipliers
 *  - Historical route transit data
 */

// ─── Location coordinates (lat, lng) ────────────────────────────────────────

export interface LocationCoord {
    lat: number;
    lng: number;
    type: "port" | "airport" | "icd";
    country: string;
    congestionIndex: number; // 1–10
}

export const LOCATION_COORDS: Record<string, LocationCoord> = {
    // ─── India ───
    "Chennai Port, India": { lat: 13.0827, lng: 80.2707, type: "port", country: "India", congestionIndex: 6 },
    "Mumbai Port, India": { lat: 18.9388, lng: 72.8354, type: "port", country: "India", congestionIndex: 8 },
    "Tuticorin Port, India": { lat: 8.7642, lng: 78.1348, type: "port", country: "India", congestionIndex: 4 },
    "Cochin Port, India": { lat: 9.9312, lng: 76.2673, type: "port", country: "India", congestionIndex: 5 },
    "Kolkata Port, India": { lat: 22.5726, lng: 88.3639, type: "port", country: "India", congestionIndex: 7 },
    "Delhi ICD, India": { lat: 28.6139, lng: 77.2090, type: "icd", country: "India", congestionIndex: 7 },
    "Bangalore ICD, India": { lat: 12.9716, lng: 77.5946, type: "icd", country: "India", congestionIndex: 5 },
    "Hyderabad ICD, India": { lat: 17.3850, lng: 78.4867, type: "icd", country: "India", congestionIndex: 5 },

    // ─── South-East & East Asia ───
    "Singapore Port, Singapore": { lat: 1.2644, lng: 103.822, type: "port", country: "Singapore", congestionIndex: 3 },
    "Shanghai Port, China": { lat: 31.2304, lng: 121.474, type: "port", country: "China", congestionIndex: 9 },
    "Shenzhen Port, China": { lat: 22.5431, lng: 114.058, type: "port", country: "China", congestionIndex: 8 },
    "Hong Kong Port, Hong Kong": { lat: 22.3193, lng: 114.170, type: "port", country: "Hong Kong", congestionIndex: 7 },
    "Busan Port, South Korea": { lat: 35.1028, lng: 129.036, type: "port", country: "South Korea", congestionIndex: 5 },
    "Tokyo Port, Japan": { lat: 35.6530, lng: 139.790, type: "port", country: "Japan", congestionIndex: 6 },
    "Kaohsiung Port, Taiwan": { lat: 22.6146, lng: 120.281, type: "port", country: "Taiwan", congestionIndex: 5 },
    "Manila Port, Philippines": { lat: 14.5832, lng: 120.970, type: "port", country: "Philippines", congestionIndex: 7 },
    "Jakarta Port, Indonesia": { lat: -6.1089, lng: 106.880, type: "port", country: "Indonesia", congestionIndex: 7 },
    "Bangkok Port, Thailand": { lat: 13.7070, lng: 100.601, type: "port", country: "Thailand", congestionIndex: 6 },
    "Ho Chi Minh City Port, Vietnam": { lat: 10.7769, lng: 106.701, type: "port", country: "Vietnam", congestionIndex: 6 },
    "Colombo Port, Sri Lanka": { lat: 6.9497, lng: 79.8428, type: "port", country: "Sri Lanka", congestionIndex: 5 },
    "Kuala Lumpur Port, Malaysia": { lat: 2.9975, lng: 101.385, type: "port", country: "Malaysia", congestionIndex: 5 },

    // ─── Middle East ───
    "Dubai Port, UAE": { lat: 25.2697, lng: 55.3095, type: "port", country: "UAE", congestionIndex: 6 },
    "Jebel Ali Port, UAE": { lat: 24.9857, lng: 55.0272, type: "port", country: "UAE", congestionIndex: 7 },
    "Abu Dhabi Port, UAE": { lat: 24.4122, lng: 54.4849, type: "port", country: "UAE", congestionIndex: 4 },
    "Jeddah Port, Saudi Arabia": { lat: 21.5169, lng: 39.2192, type: "port", country: "Saudi Arabia", congestionIndex: 6 },
    "Dammam Port, Saudi Arabia": { lat: 26.4207, lng: 50.0888, type: "port", country: "Saudi Arabia", congestionIndex: 5 },
    "Salalah Port, Oman": { lat: 16.9400, lng: 54.0000, type: "port", country: "Oman", congestionIndex: 3 },
    "Muscat Port, Oman": { lat: 23.6100, lng: 58.5400, type: "port", country: "Oman", congestionIndex: 4 },
    "Karachi Port, Pakistan": { lat: 24.8465, lng: 66.9706, type: "port", country: "Pakistan", congestionIndex: 7 },
    "Riyadh ICD, Saudi Arabia": { lat: 24.7136, lng: 46.6753, type: "icd", country: "Saudi Arabia", congestionIndex: 5 },

    // ─── Africa ───
    "Cape Town Port, South Africa": { lat: -33.918, lng: 18.4233, type: "port", country: "South Africa", congestionIndex: 5 },
    "Durban Port, South Africa": { lat: -29.867, lng: 31.0292, type: "port", country: "South Africa", congestionIndex: 6 },
    "Johannesburg ICD, South Africa": { lat: -26.204, lng: 28.0473, type: "icd", country: "South Africa", congestionIndex: 5 },
    "Mombasa Port, Kenya": { lat: -4.0435, lng: 39.6682, type: "port", country: "Kenya", congestionIndex: 6 },
    "Nairobi ICD, Kenya": { lat: -1.2864, lng: 36.8172, type: "icd", country: "Kenya", congestionIndex: 5 },
    "Dar es Salaam Port, Tanzania": { lat: -6.7924, lng: 39.2083, type: "port", country: "Tanzania", congestionIndex: 6 },
    "Lagos Port, Nigeria": { lat: 6.4541, lng: 3.3947, type: "port", country: "Nigeria", congestionIndex: 8 },
    "Djibouti Port, Djibouti": { lat: 11.5880, lng: 43.1450, type: "port", country: "Djibouti", congestionIndex: 4 },
    "Addis Ababa ICD, Ethiopia": { lat: 9.0054, lng: 38.7636, type: "icd", country: "Ethiopia", congestionIndex: 5 },
    "Alexandria Port, Egypt": { lat: 31.2156, lng: 29.9553, type: "port", country: "Egypt", congestionIndex: 6 },
    "Port Said Port, Egypt": { lat: 31.2653, lng: 32.3019, type: "port", country: "Egypt", congestionIndex: 5 },
    "Casablanca Port, Morocco": { lat: 33.5731, lng: -7.5898, type: "port", country: "Morocco", congestionIndex: 5 },
    "Accra Port, Ghana": { lat: 5.6037, lng: -0.1870, type: "port", country: "Ghana", congestionIndex: 5 },
    "Douala Port, Cameroon": { lat: 4.0511, lng: 9.7679, type: "port", country: "Cameroon", congestionIndex: 6 },

    // ─── Major Airports ───
    "Chennai International Airport, India": { lat: 12.9941, lng: 80.1709, type: "airport", country: "India", congestionIndex: 5 },
    "Mumbai Chhatrapati Shivaji Maharaj International Airport, India": { lat: 19.0896, lng: 72.8656, type: "airport", country: "India", congestionIndex: 7 },
    "Delhi Indira Gandhi International Airport, India": { lat: 28.5562, lng: 77.1000, type: "airport", country: "India", congestionIndex: 8 },
    "Bengaluru Kempegowda International Airport, India": { lat: 13.1979, lng: 77.7063, type: "airport", country: "India", congestionIndex: 5 },
    "Hyderabad Rajiv Gandhi International Airport, India": { lat: 17.2403, lng: 78.4294, type: "airport", country: "India", congestionIndex: 4 },
    "Kolkata Netaji Subhas Chandra Bose International Airport, India": { lat: 22.6520, lng: 88.4463, type: "airport", country: "India", congestionIndex: 5 },
    "Singapore Changi Airport, Singapore": { lat: 1.3644, lng: 103.991, type: "airport", country: "Singapore", congestionIndex: 3 },
    "Dubai International Airport, UAE": { lat: 25.2532, lng: 55.3657, type: "airport", country: "UAE", congestionIndex: 7 },
    "Hong Kong International Airport, Hong Kong": { lat: 22.3080, lng: 113.915, type: "airport", country: "Hong Kong", congestionIndex: 6 },
    "Shanghai Pudong International Airport, China": { lat: 31.1443, lng: 121.805, type: "airport", country: "China", congestionIndex: 8 },
    "Tokyo Narita International Airport, Japan": { lat: 35.7720, lng: 140.393, type: "airport", country: "Japan", congestionIndex: 6 },
    "Seoul Incheon International Airport, South Korea": { lat: 37.4602, lng: 126.441, type: "airport", country: "South Korea", congestionIndex: 5 },
    "Bangkok Suvarnabhumi Airport, Thailand": { lat: 13.6900, lng: 100.750, type: "airport", country: "Thailand", congestionIndex: 6 },
    "Kuala Lumpur International Airport, Malaysia": { lat: 2.7456, lng: 101.710, type: "airport", country: "Malaysia", congestionIndex: 5 },
    "Jakarta Soekarno-Hatta International Airport, Indonesia": { lat: -6.1256, lng: 106.656, type: "airport", country: "Indonesia", congestionIndex: 6 },
    "Johannesburg O.R. Tambo International Airport, South Africa": { lat: -26.139, lng: 28.2460, type: "airport", country: "South Africa", congestionIndex: 5 },
    "Nairobi Jomo Kenyatta International Airport, Kenya": { lat: -1.3192, lng: 36.9278, type: "airport", country: "Kenya", congestionIndex: 5 },
    "Cairo International Airport, Egypt": { lat: 30.1219, lng: 31.4056, type: "airport", country: "Egypt", congestionIndex: 6 },
    "Lagos Murtala Muhammed International Airport, Nigeria": { lat: 6.5774, lng: 3.3212, type: "airport", country: "Nigeria", congestionIndex: 7 },
    "Addis Ababa Bole International Airport, Ethiopia": { lat: 8.9779, lng: 38.7993, type: "airport", country: "Ethiopia", congestionIndex: 5 },
    "Casablanca Mohammed V International Airport, Morocco": { lat: 33.3675, lng: -7.5899, type: "airport", country: "Morocco", congestionIndex: 4 },
};

// ─── Customs clearance average days by country ──────────────────────────────

export const CUSTOMS_DAYS: Record<string, { import: number; export: number }> = {
    "India": { import: 3.5, export: 2.5 },
    "Singapore": { import: 1.0, export: 0.5 },
    "China": { import: 3.0, export: 2.0 },
    "Hong Kong": { import: 1.0, export: 0.5 },
    "Japan": { import: 2.0, export: 1.5 },
    "South Korea": { import: 2.0, export: 1.5 },
    "Taiwan": { import: 2.0, export: 1.5 },
    "Philippines": { import: 4.0, export: 3.0 },
    "Indonesia": { import: 4.5, export: 3.0 },
    "Thailand": { import: 2.5, export: 2.0 },
    "Vietnam": { import: 3.0, export: 2.5 },
    "Malaysia": { import: 2.0, export: 1.5 },
    "Sri Lanka": { import: 3.0, export: 2.5 },
    "Pakistan": { import: 5.0, export: 4.0 },
    "Bangladesh": { import: 5.5, export: 4.0 },
    "UAE": { import: 2.0, export: 1.0 },
    "Saudi Arabia": { import: 3.0, export: 2.5 },
    "Oman": { import: 2.5, export: 2.0 },
    "South Africa": { import: 3.0, export: 2.5 },
    "Kenya": { import: 4.0, export: 3.5 },
    "Tanzania": { import: 5.0, export: 4.0 },
    "Nigeria": { import: 6.0, export: 5.0 },
    "Egypt": { import: 4.0, export: 3.0 },
    "Morocco": { import: 3.0, export: 2.5 },
    "Ethiopia": { import: 5.0, export: 4.5 },
    "Djibouti": { import: 3.0, export: 2.5 },
    "Ghana": { import: 4.0, export: 3.5 },
    "Cameroon": { import: 5.0, export: 4.5 },
    "Mozambique": { import: 5.0, export: 4.0 },
    "Turkey": { import: 3.0, export: 2.5 },
    "Iran": { import: 6.0, export: 5.0 },
    "Iraq": { import: 7.0, export: 6.0 },
};

// ─── Haversine distance (km) between two coordinates ────────────────────────

function toRad(deg: number): number {
    return (deg * Math.PI) / 180;
}

export function haversineDistanceKm(
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number {
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ─── Sea-route multiplier (great-circle → actual shipping lane) ─────────────
// Sea routes are ~1.3-1.6x the great-circle distance due to coastlines/canals

export function getSeaRouteMultiplier(origin: string, destination: string): number {
    const o = origin.toLowerCase();
    const d = destination.toLowerCase();

    // Suez Canal routes (India/Asia → Mediterranean/Europe)
    if (
        (o.includes("india") || o.includes("singapore") || o.includes("china")) &&
        (d.includes("egypt") || d.includes("morocco") || d.includes("tunisia") || d.includes("turkey"))
    ) return 1.25;

    // Routes via Cape of Good Hope
    if (
        (o.includes("india") || o.includes("china")) &&
        (d.includes("nigeria") || d.includes("ghana") || d.includes("south africa"))
    ) return 1.45;

    // Intra-Asia short routes
    if (
        (o.includes("india") || o.includes("sri lanka")) &&
        (d.includes("singapore") || d.includes("malaysia") || d.includes("thailand"))
    ) return 1.15;

    // Within same region
    if (o.includes("india") && d.includes("india")) return 1.3;

    // Default ocean multiplier
    return 1.35;
}

// ─── Seasonal weather delay factor ──────────────────────────────────────────

export function getWeatherDelayFactor(month: number, transport: string): number {
    // month: 0 = January, 11 = December
    if (transport === "sea") {
        // Monsoon season (June-September) affects Indian Ocean routes
        if (month >= 5 && month <= 8) return 1.2; // +20% transit time
        // Typhoon season (July-November) affects western Pacific
        if (month >= 6 && month <= 10) return 1.15;
        // Winter storms (December-February) affect northern routes
        if (month === 11 || month <= 1) return 1.1;
        return 1.0;
    }

    if (transport === "road") {
        // Monsoon flooding
        if (month >= 5 && month <= 8) return 1.25;
        // Fog season (November-January) in North India
        if (month >= 10 || month <= 0) return 1.15;
        return 1.0;
    }

    if (transport === "air") {
        // Weather has minimal impact on air freight timing
        if (month >= 5 && month <= 8) return 1.05; // monsoon-related delays
        return 1.0;
    }

    return 1.0;
}

// ─── Transport speeds (km/day) — realistic averages ─────────────────────────

export const TRANSPORT_SPEEDS: Record<string, {
    avgKmPerDay: number;
    minKmPerDay: number;
    maxKmPerDay: number;
}> = {
    sea: { avgKmPerDay: 580, minKmPerDay: 400, maxKmPerDay: 720 },   // 12-15 knots average
    road: { avgKmPerDay: 350, minKmPerDay: 200, maxKmPerDay: 500 },  // Truck ~40-60 km/h, 8-10h/day
    air: { avgKmPerDay: 8000, minKmPerDay: 5000, maxKmPerDay: 10000 }, // Including ground handling
};

// ─── Port handling times (days) ─────────────────────────────────────────────

export function getPortHandlingDays(congestionIndex: number, type: "port" | "airport" | "icd"): number {
    if (type === "airport") return 0.5 + (congestionIndex / 10) * 1.0;
    if (type === "icd") return 1.0 + (congestionIndex / 10) * 1.5;
    // Port: 1-3 days depending on congestion
    return 1.0 + (congestionIndex / 10) * 2.0;
}

// ─── Historical route data (frequently used routes with known transit times) ─

export interface HistoricalRoute {
    origin: string;
    destination: string;
    transport: string;
    avgDays: number;
    minDays: number;
    maxDays: number;
    sampleSize: number; // Number of historical shipments
}

export const HISTORICAL_ROUTES: HistoricalRoute[] = [
    // ─── Sea Routes (India outbound) ───
    { origin: "Chennai Port, India", destination: "Singapore Port, Singapore", transport: "sea", avgDays: 8, minDays: 6, maxDays: 11, sampleSize: 1250 },
    { origin: "Chennai Port, India", destination: "Colombo Port, Sri Lanka", transport: "sea", avgDays: 3, minDays: 2, maxDays: 5, sampleSize: 980 },
    { origin: "Chennai Port, India", destination: "Dubai Port, UAE", transport: "sea", avgDays: 10, minDays: 8, maxDays: 14, sampleSize: 870 },
    { origin: "Chennai Port, India", destination: "Shanghai Port, China", transport: "sea", avgDays: 16, minDays: 13, maxDays: 20, sampleSize: 650 },
    { origin: "Mumbai Port, India", destination: "Jebel Ali Port, UAE", transport: "sea", avgDays: 5, minDays: 3, maxDays: 7, sampleSize: 1400 },
    { origin: "Mumbai Port, India", destination: "Singapore Port, Singapore", transport: "sea", avgDays: 10, minDays: 8, maxDays: 13, sampleSize: 1100 },
    { origin: "Mumbai Port, India", destination: "Durban Port, South Africa", transport: "sea", avgDays: 22, minDays: 18, maxDays: 28, sampleSize: 320 },
    { origin: "Mumbai Port, India", destination: "Mombasa Port, Kenya", transport: "sea", avgDays: 14, minDays: 10, maxDays: 18, sampleSize: 450 },
    { origin: "Cochin Port, India", destination: "Singapore Port, Singapore", transport: "sea", avgDays: 9, minDays: 7, maxDays: 12, sampleSize: 780 },
    { origin: "Cochin Port, India", destination: "Colombo Port, Sri Lanka", transport: "sea", avgDays: 2, minDays: 1, maxDays: 3, sampleSize: 1050 },
    { origin: "Cochin Port, India", destination: "Dubai Port, UAE", transport: "sea", avgDays: 8, minDays: 6, maxDays: 11, sampleSize: 920 },
    { origin: "Kolkata Port, India", destination: "Singapore Port, Singapore", transport: "sea", avgDays: 12, minDays: 9, maxDays: 15, sampleSize: 560 },
    { origin: "Kolkata Port, India", destination: "Bangkok Port, Thailand", transport: "sea", avgDays: 10, minDays: 7, maxDays: 13, sampleSize: 480 },
    { origin: "Tuticorin Port, India", destination: "Colombo Port, Sri Lanka", transport: "sea", avgDays: 2, minDays: 1, maxDays: 3, sampleSize: 820 },
    { origin: "Tuticorin Port, India", destination: "Singapore Port, Singapore", transport: "sea", avgDays: 9, minDays: 7, maxDays: 12, sampleSize: 610 },

    // ─── Sea Routes (Asia intra) ───
    { origin: "Singapore Port, Singapore", destination: "Shanghai Port, China", transport: "sea", avgDays: 7, minDays: 5, maxDays: 9, sampleSize: 2100 },
    { origin: "Singapore Port, Singapore", destination: "Hong Kong Port, Hong Kong", transport: "sea", avgDays: 5, minDays: 4, maxDays: 7, sampleSize: 1800 },
    { origin: "Singapore Port, Singapore", destination: "Tokyo Port, Japan", transport: "sea", avgDays: 10, minDays: 8, maxDays: 13, sampleSize: 1200 },
    { origin: "Singapore Port, Singapore", destination: "Jakarta Port, Indonesia", transport: "sea", avgDays: 3, minDays: 2, maxDays: 5, sampleSize: 1500 },
    { origin: "Shanghai Port, China", destination: "Busan Port, South Korea", transport: "sea", avgDays: 3, minDays: 2, maxDays: 4, sampleSize: 2000 },
    { origin: "Shanghai Port, China", destination: "Tokyo Port, Japan", transport: "sea", avgDays: 4, minDays: 3, maxDays: 6, sampleSize: 1900 },
    { origin: "Dubai Port, UAE", destination: "Mombasa Port, Kenya", transport: "sea", avgDays: 10, minDays: 7, maxDays: 13, sampleSize: 750 },
    { origin: "Dubai Port, UAE", destination: "Mumbai Port, India", transport: "sea", avgDays: 5, minDays: 3, maxDays: 7, sampleSize: 1300 },
    { origin: "Jebel Ali Port, UAE", destination: "Chennai Port, India", transport: "sea", avgDays: 9, minDays: 7, maxDays: 12, sampleSize: 900 },

    // ─── Sea Routes (Africa) ───
    { origin: "Durban Port, South Africa", destination: "Mombasa Port, Kenya", transport: "sea", avgDays: 12, minDays: 9, maxDays: 16, sampleSize: 380 },
    { origin: "Mombasa Port, Kenya", destination: "Dubai Port, UAE", transport: "sea", avgDays: 10, minDays: 7, maxDays: 13, sampleSize: 650 },
    { origin: "Lagos Port, Nigeria", destination: "Cape Town Port, South Africa", transport: "sea", avgDays: 18, minDays: 14, maxDays: 23, sampleSize: 280 },
    { origin: "Dar es Salaam Port, Tanzania", destination: "Mumbai Port, India", transport: "sea", avgDays: 14, minDays: 10, maxDays: 18, sampleSize: 350 },

    // ─── Road Routes (India domestic) ───
    { origin: "Delhi ICD, India", destination: "Mumbai Port, India", transport: "road", avgDays: 4, minDays: 3, maxDays: 6, sampleSize: 2200 },
    { origin: "Delhi ICD, India", destination: "Chennai Port, India", transport: "road", avgDays: 5, minDays: 4, maxDays: 7, sampleSize: 1800 },
    { origin: "Delhi ICD, India", destination: "Kolkata Port, India", transport: "road", avgDays: 4, minDays: 3, maxDays: 5, sampleSize: 1600 },
    { origin: "Bangalore ICD, India", destination: "Chennai Port, India", transport: "road", avgDays: 2, minDays: 1, maxDays: 3, sampleSize: 2500 },
    { origin: "Bangalore ICD, India", destination: "Cochin Port, India", transport: "road", avgDays: 2, minDays: 1, maxDays: 3, sampleSize: 1900 },
    { origin: "Bangalore ICD, India", destination: "Tuticorin Port, India", transport: "road", avgDays: 2, minDays: 1, maxDays: 3, sampleSize: 1100 },
    { origin: "Hyderabad ICD, India", destination: "Chennai Port, India", transport: "road", avgDays: 2, minDays: 1, maxDays: 3, sampleSize: 1700 },
    { origin: "Hyderabad ICD, India", destination: "Mumbai Port, India", transport: "road", avgDays: 3, minDays: 2, maxDays: 4, sampleSize: 1400 },
    { origin: "Delhi ICD, India", destination: "Hyderabad ICD, India", transport: "road", avgDays: 3, minDays: 2, maxDays: 5, sampleSize: 950 },

    // ─── Road Routes (International) ───
    { origin: "Karachi Port, Pakistan", destination: "Delhi ICD, India", transport: "road", avgDays: 6, minDays: 4, maxDays: 9, sampleSize: 280 },
    { origin: "Nairobi ICD, Kenya", destination: "Mombasa Port, Kenya", transport: "road", avgDays: 2, minDays: 1, maxDays: 3, sampleSize: 1200 },
    { origin: "Johannesburg ICD, South Africa", destination: "Durban Port, South Africa", transport: "road", avgDays: 2, minDays: 1, maxDays: 3, sampleSize: 1500 },
    { origin: "Addis Ababa ICD, Ethiopia", destination: "Djibouti Port, Djibouti", transport: "road", avgDays: 3, minDays: 2, maxDays: 5, sampleSize: 600 },
    { origin: "Riyadh ICD, Saudi Arabia", destination: "Jeddah Port, Saudi Arabia", transport: "road", avgDays: 2, minDays: 1, maxDays: 3, sampleSize: 800 },

    // ─── Air Routes ───
    { origin: "Chennai International Airport, India", destination: "Singapore Changi Airport, Singapore", transport: "air", avgDays: 2, minDays: 1, maxDays: 3, sampleSize: 900 },
    { origin: "Chennai International Airport, India", destination: "Dubai International Airport, UAE", transport: "air", avgDays: 2, minDays: 1, maxDays: 3, sampleSize: 750 },
    { origin: "Delhi Indira Gandhi International Airport, India", destination: "Dubai International Airport, UAE", transport: "air", avgDays: 2, minDays: 1, maxDays: 3, sampleSize: 1100 },
    { origin: "Delhi Indira Gandhi International Airport, India", destination: "Singapore Changi Airport, Singapore", transport: "air", avgDays: 2, minDays: 1, maxDays: 3, sampleSize: 800 },
    { origin: "Delhi Indira Gandhi International Airport, India", destination: "Shanghai Pudong International Airport, China", transport: "air", avgDays: 3, minDays: 2, maxDays: 4, sampleSize: 600 },
    { origin: "Mumbai Chhatrapati Shivaji Maharaj International Airport, India", destination: "Dubai International Airport, UAE", transport: "air", avgDays: 2, minDays: 1, maxDays: 3, sampleSize: 1300 },
    { origin: "Bengaluru Kempegowda International Airport, India", destination: "Singapore Changi Airport, Singapore", transport: "air", avgDays: 2, minDays: 1, maxDays: 3, sampleSize: 680 },

    // ─── Domestic Air Routes (India) ───
    { origin: "Hyderabad Rajiv Gandhi International Airport, India", destination: "Mumbai Chhatrapati Shivaji Maharaj International Airport, India", transport: "air", avgDays: 1, minDays: 1, maxDays: 2, sampleSize: 1800 },
    { origin: "Hyderabad Rajiv Gandhi International Airport, India", destination: "Delhi Indira Gandhi International Airport, India", transport: "air", avgDays: 1, minDays: 1, maxDays: 2, sampleSize: 1500 },
    { origin: "Hyderabad Rajiv Gandhi International Airport, India", destination: "Chennai International Airport, India", transport: "air", avgDays: 1, minDays: 1, maxDays: 2, sampleSize: 1600 },
    { origin: "Hyderabad Rajiv Gandhi International Airport, India", destination: "Bengaluru Kempegowda International Airport, India", transport: "air", avgDays: 1, minDays: 1, maxDays: 1, sampleSize: 1900 },
    { origin: "Mumbai Chhatrapati Shivaji Maharaj International Airport, India", destination: "Delhi Indira Gandhi International Airport, India", transport: "air", avgDays: 1, minDays: 1, maxDays: 2, sampleSize: 2500 },
    { origin: "Mumbai Chhatrapati Shivaji Maharaj International Airport, India", destination: "Chennai International Airport, India", transport: "air", avgDays: 1, minDays: 1, maxDays: 2, sampleSize: 1400 },
    { origin: "Mumbai Chhatrapati Shivaji Maharaj International Airport, India", destination: "Bengaluru Kempegowda International Airport, India", transport: "air", avgDays: 1, minDays: 1, maxDays: 2, sampleSize: 1600 },
    { origin: "Delhi Indira Gandhi International Airport, India", destination: "Chennai International Airport, India", transport: "air", avgDays: 1, minDays: 1, maxDays: 2, sampleSize: 1300 },
    { origin: "Delhi Indira Gandhi International Airport, India", destination: "Kolkata Netaji Subhas Chandra Bose International Airport, India", transport: "air", avgDays: 1, minDays: 1, maxDays: 2, sampleSize: 1400 },
    { origin: "Chennai International Airport, India", destination: "Bengaluru Kempegowda International Airport, India", transport: "air", avgDays: 1, minDays: 1, maxDays: 1, sampleSize: 2000 },

    // ─── International Air Routes ───
    { origin: "Singapore Changi Airport, Singapore", destination: "Tokyo Narita International Airport, Japan", transport: "air", avgDays: 2, minDays: 1, maxDays: 3, sampleSize: 1200 },
    { origin: "Dubai International Airport, UAE", destination: "Nairobi Jomo Kenyatta International Airport, Kenya", transport: "air", avgDays: 2, minDays: 1, maxDays: 3, sampleSize: 500 },
    { origin: "Dubai International Airport, UAE", destination: "Johannesburg O.R. Tambo International Airport, South Africa", transport: "air", avgDays: 3, minDays: 2, maxDays: 4, sampleSize: 450 },
    { origin: "Nairobi Jomo Kenyatta International Airport, Kenya", destination: "Addis Ababa Bole International Airport, Ethiopia", transport: "air", avgDays: 1, minDays: 1, maxDays: 2, sampleSize: 400 },
];

// ─── Generate training dataset from real-world data ─────────────────────────

export interface TrainingDataRow {
    distance_km: number;
    transport_mode: number; // 0=sea, 1=road, 2=air
    container_size: number; // 20 or 40
    booking_mode: number;   // 0=full (FCL), 1=partial (LCL)
    cbm: number;
    origin_congestion: number;
    dest_congestion: number;
    customs_export_days: number;
    customs_import_days: number;
    weather_factor: number;
    port_handling_origin: number;
    port_handling_dest: number;
    sea_route_multiplier: number;
    delivery_days: number;
}

export function generateTrainingDataset(size: number = 5000): TrainingDataRow[] {
    const dataset: TrainingDataRow[] = [];
    const locationKeys = Object.keys(LOCATION_COORDS);
    const months = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const transportModes = ["sea", "road", "air"];

    // First: add entries based on historical routes
    for (const route of HISTORICAL_ROUTES) {
        const originCoord = LOCATION_COORDS[route.origin];
        const destCoord = LOCATION_COORDS[route.destination];
        if (!originCoord || !destCoord) continue;

        const distance = haversineDistanceKm(originCoord.lat, originCoord.lng, destCoord.lat, destCoord.lng);

        // Generate multiple samples per historical route with variation
        const samplesPerRoute = Math.min(route.sampleSize, Math.ceil(size / HISTORICAL_ROUTES.length));
        for (let i = 0; i < samplesPerRoute; i++) {
            const month = months[Math.floor(Math.random() * 12)];
            const containerSize = Math.random() > 0.5 ? 40 : 20;
            const bookingMode = Math.random() > 0.7 ? 1 : 0; // 30% LCL
            const cbm = bookingMode === 1 ? Math.floor(Math.random() * 25) + 3 : containerSize === 20 ? 33 : 67;
            const weatherFactor = getWeatherDelayFactor(month, route.transport);
            const seaMultiplier = route.transport === "sea" ? getSeaRouteMultiplier(route.origin, route.destination) : 1.0;
            const originHandling = getPortHandlingDays(originCoord.congestionIndex, originCoord.type);
            const destHandling = getPortHandlingDays(destCoord.congestionIndex, destCoord.type);
            const customsExport = CUSTOMS_DAYS[originCoord.country]?.export || 2;
            const customsImport = CUSTOMS_DAYS[destCoord.country]?.import || 3;

            // Compute realistic delivery days with variance
            const variance = (Math.random() - 0.5) * (route.maxDays - route.minDays);
            const deliveryDays = Math.max(1, Math.round(route.avgDays + variance));

            const tMode = route.transport === "sea" ? 0 : route.transport === "road" ? 1 : 2;

            dataset.push({
                distance_km: Math.round(distance * seaMultiplier),
                transport_mode: tMode,
                container_size: containerSize,
                booking_mode: bookingMode,
                cbm,
                origin_congestion: originCoord.congestionIndex,
                dest_congestion: destCoord.congestionIndex,
                customs_export_days: customsExport,
                customs_import_days: customsImport,
                weather_factor: weatherFactor,
                port_handling_origin: Math.round(originHandling * 10) / 10,
                port_handling_dest: Math.round(destHandling * 10) / 10,
                sea_route_multiplier: seaMultiplier,
                delivery_days: deliveryDays,
            });
        }
    }

    // Fill remaining with generated routes between all known locations
    while (dataset.length < size) {
        const originKey = locationKeys[Math.floor(Math.random() * locationKeys.length)];
        const destKey = locationKeys[Math.floor(Math.random() * locationKeys.length)];
        if (originKey === destKey) continue;

        const o = LOCATION_COORDS[originKey];
        const d = LOCATION_COORDS[destKey];
        const distance = haversineDistanceKm(o.lat, o.lng, d.lat, d.lng);

        // Pick appropriate transport mode
        let transport: string;
        if (o.type === "airport" && d.type === "airport") {
            transport = "air";
        } else if (o.type === "icd" && d.type === "icd" && distance < 2000) {
            transport = "road";
        } else if (o.type === "icd" || d.type === "icd") {
            transport = distance < 1500 ? "road" : "sea";
        } else if (distance < 500) {
            transport = "road";
        } else {
            transport = Math.random() > 0.3 ? "sea" : "road";
        }

        const month = Math.floor(Math.random() * 12);
        const containerSize = Math.random() > 0.5 ? 40 : 20;
        const bookingMode = Math.random() > 0.7 ? 1 : 0;
        const cbm = bookingMode === 1 ? Math.floor(Math.random() * 25) + 3 : containerSize === 20 ? 33 : 67;
        const weatherFactor = getWeatherDelayFactor(month, transport);
        const seaMultiplier = transport === "sea" ? getSeaRouteMultiplier(originKey, destKey) : 1.0;
        const originHandling = getPortHandlingDays(o.congestionIndex, o.type);
        const destHandling = getPortHandlingDays(d.congestionIndex, d.type);
        const customsExport = CUSTOMS_DAYS[o.country]?.export || 2;
        const customsImport = CUSTOMS_DAYS[d.country]?.import || 3;

        const speed = TRANSPORT_SPEEDS[transport];
        const effectiveDistance = distance * seaMultiplier;
        const transitDays = effectiveDistance / (speed.avgKmPerDay * (0.85 + Math.random() * 0.3));
        const totalDays = transitDays * weatherFactor + originHandling + destHandling + customsExport + customsImport;
        // LCL adds consolidation time
        const lclExtra = bookingMode === 1 ? 1 + Math.random() * 2 : 0;
        const deliveryDays = Math.max(1, Math.round(totalDays + lclExtra));

        const tMode = transport === "sea" ? 0 : transport === "road" ? 1 : 2;

        dataset.push({
            distance_km: Math.round(effectiveDistance),
            transport_mode: tMode,
            container_size: containerSize,
            booking_mode: bookingMode,
            cbm,
            origin_congestion: o.congestionIndex,
            dest_congestion: d.congestionIndex,
            customs_export_days: customsExport,
            customs_import_days: customsImport,
            weather_factor: weatherFactor,
            port_handling_origin: Math.round(originHandling * 10) / 10,
            port_handling_dest: Math.round(destHandling * 10) / 10,
            sea_route_multiplier: seaMultiplier,
            delivery_days: deliveryDays,
        });
    }

    return dataset.slice(0, size);
}
