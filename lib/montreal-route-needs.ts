import { getNearbyPlaces, type NearbyPlace } from "./nearby-places";
import type { MontrealPilotRoute } from "./montreal-pilot-routes";

type Coordinates = { lat: number; lon: number };

type CivicNeed = {
  name: string;
  lat: number;
  lon: number;
  distanceMeters: number;
  detail?: string;
  source: "osm";
};

export type MontrealRouteNeeds = {
  routeId: string;
  centre: Coordinates;
  radiusMeters: number;
  restaurants: NearbyPlace[];
  cafes: NearbyPlace[];
  pharmacies: NearbyPlace[];
  restrooms: CivicNeed[];
  water: CivicNeed[];
  usefulShops: CivicNeed[];
  providersUsed: string[];
  cacheHit: boolean;
};

type CacheEntry = { expiresAt: number; value: { restrooms: CivicNeed[]; water: CivicNeed[]; usefulShops: CivicNeed[] } };
const civicCache = new Map<string, CacheEntry>();
const CIVIC_TTL_MS = 30 * 60 * 1000;
const CIVIC_NEGATIVE_TTL_MS = 2 * 60 * 1000;
const OSM_TIMEOUT_MS = 4500;

function haversineMeters(a: Coordinates, b: Coordinates) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function routeCentre(route: MontrealPilotRoute): Coordinates {
  const count = Math.max(1, route.stops.length);
  return {
    lat: route.stops.reduce((sum, stop) => sum + stop.lat, 0) / count,
    lon: route.stops.reduce((sum, stop) => sum + stop.lon, 0) / count,
  };
}

function cacheKey(centre: Coordinates, radiusMeters: number) {
  return `${centre.lat.toFixed(3)}:${centre.lon.toFixed(3)}:${Math.round(radiusMeters / 100) * 100}`;
}

function clean(items: CivicNeed[], max: number) {
  const seen = new Set<string>();
  return items
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .filter((item) => {
      const key = `${item.name.toLowerCase()}:${item.lat.toFixed(4)}:${item.lon.toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max);
}

async function osmCivicNeeds(centre: Coordinates, radiusMeters: number) {
  const key = cacheKey(centre, radiusMeters);
  const cached = civicCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cacheHit: true };
  if (cached) civicCache.delete(key);

  const query = `[out:json][timeout:5];(
    node[amenity=toilets](around:${radiusMeters},${centre.lat},${centre.lon});
    node[amenity=drinking_water](around:${radiusMeters},${centre.lat},${centre.lon});
    node[shop=convenience](around:${radiusMeters},${centre.lat},${centre.lon});
    node[shop=supermarket](around:${radiusMeters},${centre.lat},${centre.lon});
  );out tags;`;
  const endpoints = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "VelvetPassportNOW/1.0" },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(OSM_TIMEOUT_MS),
      });
      if (!response.ok) continue;
      const payload = await response.json() as { elements?: Array<{ lat?: number; lon?: number; tags?: Record<string, string> }> };
      const restrooms: CivicNeed[] = [];
      const water: CivicNeed[] = [];
      const usefulShops: CivicNeed[] = [];

      for (const element of payload.elements ?? []) {
        if (typeof element.lat !== "number" || typeof element.lon !== "number") continue;
        const point = { lat: element.lat, lon: element.lon };
        const distanceMeters = Math.round(haversineMeters(centre, point));
        const tags = element.tags ?? {};
        const item: CivicNeed = {
          name: tags.name || (tags.amenity === "toilets" ? "Public restroom" : tags.amenity === "drinking_water" ? "Drinking water" : "Useful shop"),
          ...point,
          distanceMeters,
          detail: [tags.opening_hours, tags.wheelchair === "yes" ? "wheelchair accessible" : undefined].filter(Boolean).join(" · ") || undefined,
          source: "osm",
        };
        if (tags.amenity === "toilets") restrooms.push(item);
        else if (tags.amenity === "drinking_water") water.push(item);
        else if (tags.shop === "convenience" || tags.shop === "supermarket") usefulShops.push(item);
      }

      const value = {
        restrooms: clean(restrooms, 4),
        water: clean(water, 4),
        usefulShops: clean(usefulShops, 4),
      };
      const hasAny = value.restrooms.length + value.water.length + value.usefulShops.length > 0;
      civicCache.set(key, { expiresAt: Date.now() + (hasAny ? CIVIC_TTL_MS : CIVIC_NEGATIVE_TTL_MS), value });
      if (civicCache.size > 250) {
        const oldest = civicCache.keys().next().value;
        if (oldest) civicCache.delete(oldest);
      }
      return { ...value, cacheHit: false };
    } catch { continue; }
  }

  const value = { restrooms: [], water: [], usefulShops: [] };
  civicCache.set(key, { expiresAt: Date.now() + CIVIC_NEGATIVE_TTL_MS, value });
  return { ...value, cacheHit: false };
}

export async function getMontrealRouteNeeds(route: MontrealPilotRoute, radiusMeters = 700): Promise<MontrealRouteNeeds> {
  const centre = routeCentre(route);
  const radius = Math.max(300, Math.min(1200, radiusMeters));
  const [places, civic] = await Promise.all([
    getNearbyPlaces(centre, radius),
    osmCivicNeeds(centre, radius),
  ]);

  return {
    routeId: route.id,
    centre,
    radiusMeters: radius,
    restaurants: places.restaurants.slice(0, 3),
    cafes: places.cafes.slice(0, 3),
    pharmacies: places.pharmacies.slice(0, 2),
    restrooms: civic.restrooms,
    water: civic.water,
    usefulShops: civic.usefulShops,
    providersUsed: Array.from(new Set([...places.providersUsed, "OpenStreetMap"])),
    cacheHit: places.cacheHit && civic.cacheHit,
  };
}
