import { evaluateOpeningHours, sortByOpenStatus, type OpenStatus } from "./opening-hours";

type Coordinates = { lat: number; lon: number };

export type MontrealNeedPlace = {
  name: string;
  lat: number;
  lon: number;
  distanceMeters: number;
  detail?: string;
  address?: string;
  source: "osm";
  openingHours?: string;
  openStatus?: OpenStatus;
  openLabel?: string;
  closesInMinutes?: number;
};

export type MontrealNeedGroups = {
  pharmacies: MontrealNeedPlace[];
  restaurants: MontrealNeedPlace[];
  cafes: MontrealNeedPlace[];
  restrooms: MontrealNeedPlace[];
  water: MontrealNeedPlace[];
  usefulShops: MontrealNeedPlace[];
  providerReachable: boolean;
  cacheHit: boolean;
};

type CacheEntry = { expiresAt: number; value: MontrealNeedGroups };
const cache = new Map<string, CacheEntry>();
const POSITIVE_TTL_MS = 30 * 60 * 1000;
const NEGATIVE_TTL_MS = 60 * 1000;
const OSM_TIMEOUT_MS = 9000;
const RETRY_PASSES = 2;
const RETRY_BACKOFF_MS = 250;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function pointFromElement(element: { lat?: number; lon?: number; center?: { lat?: number; lon?: number } }) {
  const lat = typeof element.lat === "number" ? element.lat : element.center?.lat;
  const lon = typeof element.lon === "number" ? element.lon : element.center?.lon;
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  return { lat, lon };
}

function normalizedName(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function clean(items: MontrealNeedPlace[], max: number) {
  const seen = new Set<string>();
  return items
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .filter((item) => {
      const key = `${normalizedName(item.name)}:${item.lat.toFixed(4)}:${item.lon.toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max);
}

function empty(providerReachable = false): MontrealNeedGroups {
  return {
    pharmacies: [], restaurants: [], cafes: [], restrooms: [], water: [], usefulShops: [],
    providerReachable,
    cacheHit: false,
  };
}

function countGroups(groups: MontrealNeedGroups) {
  return groups.pharmacies.length + groups.restaurants.length + groups.cafes.length + groups.restrooms.length + groups.water.length + groups.usefulShops.length;
}

export async function getMontrealOsmNeeds(centre: Coordinates, radiusMeters: number): Promise<MontrealNeedGroups> {
  const radius = Math.max(300, Math.min(1200, radiusMeters));
  const key = cacheKey(centre, radius);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cacheHit: true };
  if (cached) cache.delete(key);

  const query = `[out:json][timeout:8];(
    nwr[amenity=pharmacy](around:${radius},${centre.lat},${centre.lon});
    nwr[amenity=restaurant](around:${radius},${centre.lat},${centre.lon});
    nwr[amenity=cafe](around:${radius},${centre.lat},${centre.lon});
    nwr[amenity=toilets](around:${radius},${centre.lat},${centre.lon});
    nwr[amenity=drinking_water](around:${radius},${centre.lat},${centre.lon});
    nwr[shop=convenience](around:${radius},${centre.lat},${centre.lon});
    nwr[shop=supermarket](around:${radius},${centre.lat},${centre.lon});
  );out center tags;`;

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter",
  ];

  let anyProviderReachable = false;

  for (let pass = 0; pass < RETRY_PASSES; pass += 1) {
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            "User-Agent": "VelvetPassportNOW/1.0 (travel-context)",
            Accept: "application/json",
          },
          body: new URLSearchParams({ data: query }),
          cache: "no-store",
          signal: AbortSignal.timeout(OSM_TIMEOUT_MS),
        });
        if (!response.ok) continue;
        anyProviderReachable = true;

        const payload = await response.json() as {
          elements?: Array<{
            lat?: number;
            lon?: number;
            center?: { lat?: number; lon?: number };
            tags?: Record<string, string>;
          }>;
        };

        const groups = empty(true);
        for (const element of payload.elements ?? []) {
          const point = pointFromElement(element);
          if (!point) continue;
          const tags = element.tags ?? {};
          const amenity = tags.amenity;
          const shop = tags.shop;
          const openingHours = tags.opening_hours;
          const opening = evaluateOpeningHours(openingHours);
          const address = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ") || undefined;
          const fallbackName = amenity === "pharmacy" ? "Pharmacy"
            : amenity === "restaurant" ? "Restaurant"
            : amenity === "cafe" ? "Café"
            : amenity === "toilets" ? "Public restroom"
            : amenity === "drinking_water" ? "Drinking water"
            : "Useful shop";
          const item: MontrealNeedPlace = {
            name: tags.name || fallbackName,
            ...point,
            distanceMeters: Math.round(haversineMeters(centre, point)),
            detail: [tags.cuisine, openingHours ? opening.label : undefined, tags.wheelchair === "yes" ? "wheelchair accessible" : undefined].filter(Boolean).join(" · ") || undefined,
            address,
            source: "osm",
            openingHours,
            openStatus: openingHours ? opening.status : "unknown",
            openLabel: openingHours ? opening.label : "Hours not confirmed",
            closesInMinutes: openingHours ? opening.closesInMinutes : undefined,
          };

          if (amenity === "pharmacy") groups.pharmacies.push(item);
          else if (amenity === "restaurant") groups.restaurants.push(item);
          else if (amenity === "cafe") groups.cafes.push(item);
          else if (amenity === "toilets") groups.restrooms.push(item);
          else if (amenity === "drinking_water") groups.water.push(item);
          else if (shop === "convenience" || shop === "supermarket") groups.usefulShops.push(item);
        }

        groups.pharmacies = sortByOpenStatus(clean(groups.pharmacies, 6));
        groups.restaurants = sortByOpenStatus(clean(groups.restaurants, 10));
        groups.cafes = sortByOpenStatus(clean(groups.cafes, 6));
        groups.restrooms = clean(groups.restrooms, 6);
        groups.water = clean(groups.water, 6);
        groups.usefulShops = clean(groups.usefulShops, 6);

        if (countGroups(groups) === 0) continue;

        cache.set(key, { expiresAt: Date.now() + POSITIVE_TTL_MS, value: groups });
        if (cache.size > 250) {
          const oldest = cache.keys().next().value;
          if (oldest) cache.delete(oldest);
        }
        return groups;
      } catch {
        continue;
      }
    }

    if (pass < RETRY_PASSES - 1) await sleep(RETRY_BACKOFF_MS * (pass + 1));
  }

  const value = empty(anyProviderReachable);
  cache.set(key, { expiresAt: Date.now() + NEGATIVE_TTL_MS, value });
  return value;
}
