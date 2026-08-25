type Coordinates = { lat: number; lon: number };

export type WalkingRoute = {
  minutes: number;
  distanceMeters: number;
  source: "valhalla" | "estimated";
  live: boolean;
  cacheHit: boolean;
};

type CacheEntry = { expiresAt: number; value: WalkingRoute };
const cache = new Map<string, CacheEntry>();
const LIVE_TTL_MS = 30 * 60 * 1000;
const FALLBACK_TTL_MS = 2 * 60 * 1000;
const WALK_KMH = 4.7;

function haversineMeters(a: Coordinates, b: Coordinates) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function key(a: Coordinates, b: Coordinates) {
  return `${a.lat.toFixed(4)}:${a.lon.toFixed(4)}>${b.lat.toFixed(4)}:${b.lon.toFixed(4)}`;
}

function estimatedRoute(origin: Coordinates, destination: Coordinates): WalkingRoute {
  const straight = haversineMeters(origin, destination);
  const distanceMeters = Math.max(1, Math.round(straight * 1.18));
  const minutes = Math.max(1, Math.ceil((distanceMeters / 1000) / WALK_KMH * 60));
  return { minutes, distanceMeters, source: "estimated", live: false, cacheHit: false };
}

function remember(origin: Coordinates, destination: Coordinates, value: WalkingRoute) {
  const ttl = value.live && value.source === "valhalla" ? LIVE_TTL_MS : FALLBACK_TTL_MS;
  cache.set(key(origin, destination), { expiresAt: Date.now() + ttl, value });
  while (cache.size > 300) cache.delete(cache.keys().next().value as string);
}

export async function getWalkingRoutes(origin: Coordinates, destinations: Coordinates[]): Promise<WalkingRoute[]> {
  if (!destinations.length) return [];

  const results: Array<WalkingRoute | null> = destinations.map((destination) => {
    const cacheKey = key(origin, destination);
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cacheHit: true };
    if (cached) cache.delete(cacheKey);
    return null;
  });

  const missing = destinations
    .map((destination, index) => ({ destination, index }))
    .filter(({ index }) => results[index] === null);

  if (missing.length) {
    try {
      const response = await fetch("https://valhalla1.openstreetmap.de/sources_to_targets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-Client-Id": "velvet-passport-now",
        },
        body: JSON.stringify({
          sources: [origin],
          targets: missing.map(({ destination }) => destination),
          costing: "pedestrian",
          units: "kilometers",
          verbose: false,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const payload = await response.json() as {
          sources_to_targets?: {
            durations?: Array<Array<number | null>>;
            distances?: Array<Array<number | null>>;
          };
        };
        const durations = payload.sources_to_targets?.durations?.[0] ?? [];
        const distances = payload.sources_to_targets?.distances?.[0] ?? [];
        missing.forEach(({ destination, index }, missingIndex) => {
          const seconds = Number(durations[missingIndex]);
          const kilometres = Number(distances[missingIndex]);
          if (Number.isFinite(seconds) && seconds > 0 && Number.isFinite(kilometres) && kilometres > 0) {
            const route: WalkingRoute = {
              minutes: Math.max(1, Math.ceil(seconds / 60)),
              distanceMeters: Math.max(1, Math.round(kilometres * 1000)),
              source: "valhalla",
              live: true,
              cacheHit: false,
            };
            results[index] = route;
            remember(origin, destination, route);
          }
        });
      }
    } catch {
      // Missing pairs receive the deterministic fallback below.
    }
  }

  destinations.forEach((destination, index) => {
    if (results[index]) return;
    const route = estimatedRoute(origin, destination);
    results[index] = route;
    remember(origin, destination, route);
  });

  return results as WalkingRoute[];
}

export async function getWalkingRoute(origin: Coordinates, destination: Coordinates): Promise<WalkingRoute> {
  const [route] = await getWalkingRoutes(origin, [destination]);
  return route;
}
