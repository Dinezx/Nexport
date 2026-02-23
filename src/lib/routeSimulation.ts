type GPS = { lat: number; lng: number };

type RoutePoint = GPS & { label: string };

type TrackingEvent = {
  title: string;
  description: string;
  status: string;
  location: string;
};

/**
 * Known location database for common shipping/logistics locations.
 * Used as a reliable fallback when geocoding services are unavailable.
 */
const KNOWN_LOCATIONS: Record<string, GPS> = {
  // India - ICDs and major cities
  "bangalore": { lat: 12.9716, lng: 77.5946 },
  "bengaluru": { lat: 12.9716, lng: 77.5946 },
  "bangalore icd": { lat: 12.9784, lng: 77.5710 },
  "bangalore icd, india": { lat: 12.9784, lng: 77.5710 },
  "mumbai": { lat: 19.0760, lng: 72.8777 },
  "nhava sheva": { lat: 18.9500, lng: 72.9500 },
  "jnpt": { lat: 18.9500, lng: 72.9500 },
  "chennai": { lat: 13.0827, lng: 80.2707 },
  "chennai port": { lat: 13.0878, lng: 80.2989 },
  "delhi": { lat: 28.6139, lng: 77.2090 },
  "new delhi": { lat: 28.6139, lng: 77.2090 },
  "tughlakabad icd": { lat: 28.5100, lng: 77.2900 },
  "kolkata": { lat: 22.5726, lng: 88.3639 },
  "kolkata port": { lat: 22.5411, lng: 88.3378 },
  "hyderabad": { lat: 17.3850, lng: 78.4867 },
  "cochin": { lat: 9.9312, lng: 76.2673 },
  "kochi": { lat: 9.9312, lng: 76.2673 },
  "vizag": { lat: 17.6868, lng: 83.2185 },
  "visakhapatnam": { lat: 17.6868, lng: 83.2185 },
  "mundra": { lat: 22.8394, lng: 69.7250 },
  "mundra port": { lat: 22.7390, lng: 69.7093 },
  "pipavav": { lat: 20.9100, lng: 71.5100 },
  "ahmedabad": { lat: 23.0225, lng: 72.5714 },
  "pune": { lat: 18.5204, lng: 73.8567 },

  // Middle East
  "riyadh": { lat: 24.7136, lng: 46.6753 },
  "riyadh icd": { lat: 24.6900, lng: 46.7200 },
  "riyadh icd, saudi arabia": { lat: 24.6900, lng: 46.7200 },
  "jeddah": { lat: 21.4858, lng: 39.1925 },
  "jeddah islamic port": { lat: 21.4700, lng: 39.1700 },
  "dammam": { lat: 26.3927, lng: 49.9777 },
  "king abdulaziz port": { lat: 26.4700, lng: 50.1000 },
  "dubai": { lat: 25.2048, lng: 55.2708 },
  "jebel ali": { lat: 25.0077, lng: 55.0810 },
  "abu dhabi": { lat: 24.4539, lng: 54.3773 },
  "muscat": { lat: 23.5880, lng: 58.3829 },
  "doha": { lat: 25.2854, lng: 51.5310 },
  "bahrain": { lat: 26.0667, lng: 50.5577 },
  "kuwait": { lat: 29.3759, lng: 47.9774 },

  // East Asia
  "shanghai": { lat: 31.2304, lng: 121.4737 },
  "shanghai port": { lat: 30.6300, lng: 122.0800 },
  "shenzhen": { lat: 22.5431, lng: 114.0579 },
  "guangzhou": { lat: 23.1291, lng: 113.2644 },
  "hong kong": { lat: 22.3193, lng: 114.1694 },
  "singapore": { lat: 1.3521, lng: 103.8198 },
  "busan": { lat: 35.1796, lng: 129.0756 },
  "tokyo": { lat: 35.6762, lng: 139.6503 },
  "yokohama": { lat: 35.4437, lng: 139.6380 },

  // Europe
  "rotterdam": { lat: 51.9225, lng: 4.4792 },
  "hamburg": { lat: 53.5511, lng: 9.9937 },
  "antwerp": { lat: 51.2194, lng: 4.4025 },
  "felixstowe": { lat: 51.9615, lng: 1.3509 },
  "london": { lat: 51.5074, lng: -0.1278 },

  // Africa
  "mombasa": { lat: -4.0435, lng: 39.6682 },
  "dar es salaam": { lat: -6.7924, lng: 39.2083 },
  "durban": { lat: -29.8587, lng: 31.0218 },
  "cape town": { lat: -33.9249, lng: 18.4241 },
  "lagos": { lat: 6.5244, lng: 3.3792 },

  // Americas
  "new york": { lat: 40.7128, lng: -74.0060 },
  "los angeles": { lat: 33.9425, lng: -118.4081 },
  "long beach": { lat: 33.7701, lng: -118.1937 },
  "houston": { lat: 29.7604, lng: -95.3698 },
  "santos": { lat: -23.9608, lng: -46.3336 },

  // Australia
  "sydney": { lat: -33.8688, lng: 151.2093 },
  "melbourne": { lat: -37.8136, lng: 144.9631 },
};

/**
 * Lookup a location name in the known locations database.
 * Tries exact match first, then progressively simpler substrings.
 */
export const lookupKnownLocation = (name: string): GPS | null => {
  const lower = name.toLowerCase().trim();

  // Exact match
  if (KNOWN_LOCATIONS[lower]) return KNOWN_LOCATIONS[lower];

  // Try without country suffix (e.g. "Bangalore ICD, India" -> "Bangalore ICD")
  const withoutCountry = lower.replace(/,\s*[^,]+$/, "").trim();
  if (KNOWN_LOCATIONS[withoutCountry]) return KNOWN_LOCATIONS[withoutCountry];

  // Try just the city name (first word(s) before "ICD", "port", etc.)
  const cityOnly = lower
    .replace(/\s*(icd|port|terminal|harbour|harbor)\b.*$/i, "")
    .replace(/,.*$/, "")
    .trim();
  if (KNOWN_LOCATIONS[cityOnly]) return KNOWN_LOCATIONS[cityOnly];

  // Try each word individually (for multi-word inputs)
  const words = lower.replace(/,/g, "").split(/\s+/);
  for (const word of words) {
    if (word.length > 2 && KNOWN_LOCATIONS[word]) return KNOWN_LOCATIONS[word];
  }

  return null;
};

const pseudoCoordFromName = (name: string): GPS => {
  // First try known location database
  const known = lookupKnownLocation(name);
  if (known) return known;

  // Fallback: generate a coordinate (not accurate, but at least on land areas)
  console.warn(`Unknown location "${name}", using hash-based fallback`);
  const hash = hashString(name);
  const lat = ((hash % 12000) / 100) - 10; // Roughly 50S to 70N
  const lng = (((hash >>> 8) % 36000) / 100) - 180;
  return { lat, lng };
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

export const buildRoutePoints = (
  origin: string,
  destination: string,
  steps = 10,
): RoutePoint[] => {
  const start = pseudoCoordFromName(origin);
  const end = pseudoCoordFromName(destination);
  const points: RoutePoint[] = [];

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    points.push({
      lat: start.lat + (end.lat - start.lat) * t,
      lng: start.lng + (end.lng - start.lng) * t,
      label: i === 0 ? "Origin" : i === steps ? "Destination" : `Leg ${i}`,
    });
  }

  return points;
};

export const buildTrackingEvent = (progress: number): TrackingEvent => {
  if (progress >= 100) {
    return {
      title: "Arrived",
      description: "Shipment has reached the destination hub.",
      status: "arrived",
      location: "Destination",
    };
  }
  if (progress >= 70) {
    return {
      title: "Near destination",
      description: "Shipment is approaching the destination hub.",
      status: "in_transit",
      location: "Approaching destination",
    };
  }
  if (progress >= 30) {
    return {
      title: "In transit",
      description: "Shipment is moving along the planned route.",
      status: "in_transit",
      location: "In transit",
    };
  }
  return {
    title: "Departed",
    description: "Shipment has departed the origin facility.",
    status: "in_transit",
    location: "Origin",
  };
};
