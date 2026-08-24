import { evaluateOpeningHours, sortByOpenStatus, type OpenStatus } from "./opening-hours";

type Coordinates = { lat: number; lon: number };

export type NearbyPlace = {
  name: string;
  lat: number;
  lon: number;
  distanceMeters: number;
  detail?: string;
  address?: string;
  source: "osm" | "geoapify" | "foursquare";
  openingHours?: string;
  openStatus?: OpenStatus;
  openLabel?: string;
  closesInMinutes?: number;
};

export type NearbyPlaceGroups = {
  pharmacies: NearbyPlace[];
  restaurants: NearbyPlace[];
  cafes: NearbyPlace[];
  providersUsed: string[];
  cacheHit: boolean;
};

type CacheEntry = { expiresAt: number; value: NearbyPlaceGroups };
const memoryCache = new Map<string, CacheEntry>();
const TTL_MS = 30 * 60 * 1000;

function haversineMeters(a: Coordinates, b: Coordinates) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function cacheKey(centre: Coordinates, radiusMeters: number) {
  return `${centre.lat.toFixed(3)}:${centre.lon.toFixed(3)}:${Math.round(radiusMeters / 100) * 100}`;
}

function normalizedName(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function mergePlaces(groups: NearbyPlaceGroups, key: "pharmacies" | "restaurants" | "cafes", incoming: NearbyPlace[]) {
  const existing = groups[key];
  for (const item of incoming) {
    const duplicate = existing.some((candidate) => {
      const sameName = normalizedName(candidate.name) === normalizedName(item.name);
      const close = haversineMeters(candidate, item) <= 70;
      return sameName || close;
    });
    if (!duplicate) existing.push(item);
  }
  groups[key] = sortByOpenStatus(existing).slice(0, 10);
}

async function fromOsm(centre: Coordinates, radiusMeters: number) {
  const query = `[out:json][timeout:8];(node[amenity=pharmacy](around:${radiusMeters},${centre.lat},${centre.lon});node[amenity=restaurant](around:${radiusMeters},${centre.lat},${centre.lon});node[amenity=cafe](around:${radiusMeters},${centre.lat},${centre.lon}););out tags;`;
  const endpoints = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "VelvetPassportNOW/1.0" },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) continue;
      const payload = await response.json() as { elements?: Array<{ lat?: number; lon?: number; tags?: Record<string, string> }> };
      const result = { pharmacies: [] as NearbyPlace[], restaurants: [] as NearbyPlace[], cafes: [] as NearbyPlace[] };
      for (const element of payload.elements ?? []) {
        if (typeof element.lat !== "number" || typeof element.lon !== "number") continue;
        const amenity = element.tags?.amenity;
        const key = amenity === "pharmacy" ? "pharmacies" : amenity === "restaurant" ? "restaurants" : amenity === "cafe" ? "cafes" : null;
        if (!key) continue;
        const point = { lat: element.lat, lon: element.lon };
        const openingHours = element.tags?.opening_hours;
        const opening = evaluateOpeningHours(openingHours);
        result[key].push({
          name: element.tags?.name || (amenity === "pharmacy" ? "Pharmacy" : amenity === "restaurant" ? "Restaurant" : "Café"),
          ...point,
          distanceMeters: Math.round(haversineMeters(centre, point)),
          detail: [element.tags?.cuisine, opening.label].filter(Boolean).join(" · ") || undefined,
          address: [element.tags?.["addr:housenumber"], element.tags?.["addr:street"]].filter(Boolean).join(" ") || undefined,
          source: "osm",
          openingHours,
          openStatus: opening.status,
          openLabel: opening.label,
          closesInMinutes: opening.closesInMinutes,
        });
      }
      result.pharmacies = sortByOpenStatus(result.pharmacies);
      result.restaurants = sortByOpenStatus(result.restaurants);
      result.cafes = sortByOpenStatus(result.cafes);
      return result;
    } catch { continue; }
  }
  return null;
}

async function fromGeoapify(centre: Coordinates, radiusMeters: number) {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) return null;
  try {
    const url = new URL("https://api.geoapify.com/v2/places");
    url.searchParams.set("categories", "healthcare.pharmacy,catering.restaurant,catering.cafe");
    url.searchParams.set("filter", `circle:${centre.lon},${centre.lat},${radiusMeters}`);
    url.searchParams.set("bias", `proximity:${centre.lon},${centre.lat}`);
    url.searchParams.set("limit", "30");
    url.searchParams.set("apiKey", apiKey);
    const response = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(6000) });
    if (!response.ok) return null;
    const payload = await response.json() as { features?: Array<{ geometry?: { coordinates?: [number, number] }; properties?: Record<string, unknown> }> };
    const result = { pharmacies: [] as NearbyPlace[], restaurants: [] as NearbyPlace[], cafes: [] as NearbyPlace[] };
    for (const feature of payload.features ?? []) {
      const coords = feature.geometry?.coordinates;
      if (!coords) continue;
      const properties = feature.properties ?? {};
      const categories = Array.isArray(properties.categories) ? properties.categories.map(String) : [];
      const key = categories.some((c) => c.includes("pharmacy")) ? "pharmacies" : categories.some((c) => c.includes("restaurant")) ? "restaurants" : categories.some((c) => c.includes("cafe")) ? "cafes" : null;
      if (!key) continue;
      const point = { lon: Number(coords[0]), lat: Number(coords[1]) };
      const openingHours = typeof properties.opening_hours === "string" ? properties.opening_hours : undefined;
      const opening = evaluateOpeningHours(openingHours);
      result[key].push({
        name: String(properties.name || properties.formatted || "Nearby place"),
        lat: point.lat,
        lon: point.lon,
        distanceMeters: Math.round(haversineMeters(centre, point)),
        address: typeof properties.formatted === "string" ? properties.formatted : undefined,
        source: "geoapify",
        openingHours,
        openStatus: opening.status,
        openLabel: opening.label,
        closesInMinutes: opening.closesInMinutes,
        detail: opening.label,
      });
    }
    result.pharmacies = sortByOpenStatus(result.pharmacies);
    result.restaurants = sortByOpenStatus(result.restaurants);
    result.cafes = sortByOpenStatus(result.cafes);
    return result;
  } catch { return null; }
}

async function foursquareSearch(centre: Coordinates, radiusMeters: number, query: string, sourceKey: "pharmacies" | "restaurants" | "cafes") {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) return [] as NearbyPlace[];
  try {
    const url = new URL("https://places-api.foursquare.com/places/search");
    url.searchParams.set("query", query);
    url.searchParams.set("ll", `${centre.lat},${centre.lon}`);
    url.searchParams.set("radius", String(radiusMeters));
    url.searchParams.set("limit", "8");
    url.searchParams.set("sort", "DISTANCE");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, "X-Places-Api-Version": "2025-06-17", Accept: "application/json" },
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return [];
    const payload = await response.json() as { results?: Array<Record<string, unknown>> };
    return (payload.results ?? []).flatMap((item) => {
      const geocodes = item.geocodes as { main?: { latitude?: number; longitude?: number } } | undefined;
      const lat = Number(geocodes?.main?.latitude);
      const lon = Number(geocodes?.main?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
      const location = item.location as Record<string, unknown> | undefined;
      return [{
        name: String(item.name || (sourceKey === "pharmacies" ? "Pharmacy" : sourceKey === "restaurants" ? "Restaurant" : "Café")),
        lat,
        lon,
        distanceMeters: Math.round(haversineMeters(centre, { lat, lon })),
        address: typeof location?.formatted_address === "string" ? location.formatted_address : undefined,
        source: "foursquare" as const,
        openStatus: "unknown" as const,
        openLabel: "Hours not confirmed",
        detail: "Hours not confirmed",
      }];
    });
  } catch { return []; }
}

async function fromFoursquare(centre: Coordinates, radiusMeters: number) {
  if (!process.env.FOURSQUARE_API_KEY) return null;
  const [pharmacies, restaurants, cafes] = await Promise.all([
    foursquareSearch(centre, radiusMeters, "pharmacy", "pharmacies"),
    foursquareSearch(centre, radiusMeters, "restaurant", "restaurants"),
    foursquareSearch(centre, radiusMeters, "cafe", "cafes"),
  ]);
  return { pharmacies, restaurants, cafes };
}

export async function getNearbyPlaces(centre: Coordinates, radiusMeters: number): Promise<NearbyPlaceGroups> {
  const key = cacheKey(centre, radiusMeters);
  const cached = memoryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cacheHit: true };

  const groups: NearbyPlaceGroups = { pharmacies: [], restaurants: [], cafes: [], providersUsed: [], cacheHit: false };

  const osm = await fromOsm(centre, radiusMeters);
  if (osm) {
    groups.providersUsed.push("OpenStreetMap");
    mergePlaces(groups, "pharmacies", osm.pharmacies);
    mergePlaces(groups, "restaurants", osm.restaurants);
    mergePlaces(groups, "cafes", osm.cafes);
  }

  const needsMore = groups.pharmacies.length < 3 || groups.restaurants.length < 5 || groups.cafes.length < 3;
  if (needsMore) {
    const geoapify = await fromGeoapify(centre, radiusMeters);
    if (geoapify) {
      groups.providersUsed.push("Geoapify");
      mergePlaces(groups, "pharmacies", geoapify.pharmacies);
      mergePlaces(groups, "restaurants", geoapify.restaurants);
      mergePlaces(groups, "cafes", geoapify.cafes);
    }
  }

  const stillNeedsMore = groups.pharmacies.length < 3 || groups.restaurants.length < 5 || groups.cafes.length < 3;
  if (stillNeedsMore) {
    const foursquare = await fromFoursquare(centre, radiusMeters);
    if (foursquare) {
      groups.providersUsed.push("Foursquare");
      mergePlaces(groups, "pharmacies", foursquare.pharmacies);
      mergePlaces(groups, "restaurants", foursquare.restaurants);
      mergePlaces(groups, "cafes", foursquare.cafes);
    }
  }

  memoryCache.set(key, { expiresAt: Date.now() + TTL_MS, value: groups });
  if (memoryCache.size > 250) {
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
  return groups;
}
