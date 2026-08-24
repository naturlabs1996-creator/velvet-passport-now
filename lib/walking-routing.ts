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
const TTL_MS = 30 * 60 * 1000;
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

export async function getWalkingRoute(origin: Coordinates, destination: Coordinates): Promise<WalkingRoute> {
  const cacheKey = key(origin, destination);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cacheHit: true };

  let route = estimatedRoute(origin, destination);
  try {
    const response = await fetch("https://valhalla1.openstreetmap.de/route", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Client-Id": "velvet-passport-now",
      },
      body: JSON.stringify({
        locations: [origin, destination],
        costing: "pedestrian",
        units: "kilometers",
        directions_type: "none",
      }),
      signal: AbortSignal.timeout(4500),
    });

    if (response.ok) {
      const payload = await response.json() as {
        trip?: { summary?: { time?: number; length?: number } };
      };
      const seconds = Number(payload.trip?.summary?.time);
      const kilometres = Number(payload.trip?.summary?.length);
      if (Number.isFinite(seconds) && seconds > 0 && Number.isFinite(kilometres) && kilometres > 0) {
        route = {
          minutes: Math.max(1, Math.ceil(seconds / 60)),
          distanceMeters: Math.max(1, Math.round(kilometres * 1000)),
          source: "valhalla",
          live: true,
          cacheHit: false,
        };
      }
    }
  } catch {
    // Keep the deterministic local fallback when the fair-use public router is unavailable.
  }

  cache.set(cacheKey, { expiresAt: Date.now() + TTL_MS, value: route });
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  return route;
}
