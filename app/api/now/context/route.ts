import { getPassAccess } from "../../../../lib/pass-access";

export const runtime = "nodejs";

type Coordinates = { lat: number; lon: number };
type NearbyItem = { name: string; lat: number; lon: number; distanceMeters: number; detail?: string };

const PARIS_BOUNDS = { minLat: 48.815, maxLat: 48.905, minLon: 2.224, maxLon: 2.470 };
const PARIS_DATA = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets";

function inParis({ lat, lon }: Coordinates) {
  return lat >= PARIS_BOUNDS.minLat && lat <= PARIS_BOUNDS.maxLat && lon >= PARIS_BOUNDS.minLon && lon <= PARIS_BOUNDS.maxLon;
}

function haversineMeters(a: Coordinates, b: Coordinates) {
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function findCoordinates(value: unknown): Coordinates | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.lat === "number" && typeof obj.lon === "number") return { lat: obj.lat, lon: obj.lon };
  if (typeof obj.lat === "number" && typeof obj.lng === "number") return { lat: obj.lat, lon: obj.lng };
  if (Array.isArray(obj.coordinates) && obj.coordinates.length >= 2 && typeof obj.coordinates[0] === "number" && typeof obj.coordinates[1] === "number") {
    return { lon: obj.coordinates[0], lat: obj.coordinates[1] };
  }
  for (const key of ["geo_point_2d", "geometry", "geom", "geo_shape", "coordonnees_geo", "coordinates"]) {
    const found = findCoordinates(obj[key]);
    if (found) return found;
  }
  return null;
}

function labelRecord(record: Record<string, unknown>, fallback: string) {
  for (const key of ["nom", "name", "libelle", "voie", "adresse", "adresse_complete", "description", "type_objet", "type"] ) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 180);
  }
  return fallback;
}

async function parisDataset(dataset: string, centre: Coordinates, radiusMeters: number, limit = 60): Promise<NearbyItem[]> {
  const urls = [
    `${PARIS_DATA}/${dataset}/records?where=${encodeURIComponent(`distance(geo_point_2d, geom'POINT(${centre.lon} ${centre.lat})') < ${radiusMeters}`)}&limit=${limit}`,
    `${PARIS_DATA}/${dataset}/records?limit=${limit}`,
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url, { next: { revalidate: 900 }, signal: AbortSignal.timeout(5500) });
      if (!response.ok) continue;
      const data = await response.json() as { results?: Record<string, unknown>[] };
      const items = (data.results ?? []).map((record) => {
        const coords = findCoordinates(record);
        if (!coords) return null;
        const distanceMeters = Math.round(haversineMeters(centre, coords));
        if (distanceMeters > radiusMeters) return null;
        return { name: labelRecord(record, dataset), lat: coords.lat, lon: coords.lon, distanceMeters };
      }).filter(Boolean) as NearbyItem[];
      return items.sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 12);
    } catch { /* use fallback */ }
  }
  return [];
}

async function weather(centre: Coordinates) {
  try {
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${centre.lat.toFixed(4)}&lon=${centre.lon.toFixed(4)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "VelvetPassportNOW/1.0 https://github.com/naturlabs1996-creator/velvet-passport-now", Accept: "application/json" },
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error("weather unavailable");
    const data = await response.json() as any;
    const first = data?.properties?.timeseries?.[0];
    const details = first?.data?.instant?.details ?? {};
    const nextHour = first?.data?.next_1_hours ?? first?.data?.next_6_hours ?? {};
    const symbol = nextHour?.summary?.symbol_code ?? "unknown";
    const precipitation = Number(nextHour?.details?.precipitation_amount ?? 0);
    const temperature = Number(details.air_temperature ?? NaN);
    const wind = Number(details.wind_speed ?? NaN);
    const scenario = precipitation > 0.2 || /rain|sleet|showers/.test(symbol) ? "rain"
      : /snow/.test(symbol) ? "snow"
      : Number.isFinite(temperature) && temperature >= 28 ? "heat"
      : Number.isFinite(temperature) && temperature <= 4 ? "cold"
      : "route";
    return { available: true, temperature, wind, precipitation, symbol, scenario, source: "MET Norway" };
  } catch {
    return { available: false, scenario: "route", source: "MET Norway" };
  }
}

async function osmAmenities(centre: Coordinates, radiusMeters: number) {
  const query = `[out:json][timeout:8];(node[amenity=pharmacy](around:${radiusMeters},${centre.lat},${centre.lon});node[amenity=restaurant](around:${radiusMeters},${centre.lat},${centre.lon});node[amenity=cafe](around:${radiusMeters},${centre.lat},${centre.lon}););out center tags 40;`;
  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "VelvetPassportNOW/1.0" },
      body: new URLSearchParams({ data: query }),
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(8500),
    });
    if (!response.ok) throw new Error("amenities unavailable");
    const data = await response.json() as { elements?: Array<{ lat?: number; lon?: number; tags?: Record<string, string> }> };
    const groups: Record<string, NearbyItem[]> = { pharmacies: [], restaurants: [], cafes: [] };
    for (const element of data.elements ?? []) {
      if (typeof element.lat !== "number" || typeof element.lon !== "number") continue;
      const amenity = element.tags?.amenity;
      const group = amenity === "pharmacy" ? "pharmacies" : amenity === "restaurant" ? "restaurants" : amenity === "cafe" ? "cafes" : null;
      if (!group) continue;
      const coords = { lat: element.lat, lon: element.lon };
      groups[group].push({
        name: element.tags?.name || (amenity === "pharmacy" ? "Pharmacy" : amenity === "restaurant" ? "Restaurant" : "Café"),
        ...coords,
        distanceMeters: Math.round(haversineMeters(centre, coords)),
        detail: [element.tags?.cuisine, element.tags?.opening_hours].filter(Boolean).join(" · ") || undefined,
      });
    }
    for (const key of Object.keys(groups)) groups[key] = groups[key].sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 8);
    return { ...groups, available: true, source: "OpenStreetMap contributors" };
  } catch {
    return { pharmacies: [], restaurants: [], cafes: [], available: false, source: "OpenStreetMap contributors" };
  }
}

export async function POST(request: Request) {
  const access = await getPassAccess();
  if (!access.allowed) return Response.json({ error: "A valid Paris NOW Pass is required" }, { status: 401 });

  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  const lat = Number(body?.lat);
  const lon = Number(body?.lon);
  const centre = { lat, lon };
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inParis(centre)) {
    return Response.json({ error: "Paris coordinates are required for live context." }, { status: 422 });
  }
  const radiusMeters = Math.max(250, Math.min(1500, Number(body?.radiusMeters) || 800));

  const [forecast, fountains, restrooms, closures, works, amenities] = await Promise.all([
    weather(centre),
    parisDataset("fontaines-a-boire", centre, radiusMeters),
    parisDataset("sanisettesparis", centre, radiusMeters),
    parisDataset("circulation_evenement", centre, radiusMeters),
    parisDataset("chantiers-a-paris", centre, radiusMeters),
    osmAmenities(centre, radiusMeters),
  ]);

  const disruptions = [...closures, ...works].sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 12);
  return Response.json({
    location: centre,
    radiusMeters,
    weather: forecast,
    water: fountains,
    restrooms,
    pharmacies: amenities.pharmacies,
    restaurants: amenities.restaurants,
    cafes: amenities.cafes,
    disruptions,
    decision: {
      suggestedScenario: forecast.scenario,
      nearbyWater: fountains.length > 0,
      nearbyRestroom: restrooms.length > 0,
      nearbyPharmacy: amenities.pharmacies.length > 0,
      streetIssueNearby: disruptions.some((item) => item.distanceMeters <= 250),
    },
    sources: [
      "MET Norway · CC BY 4.0",
      "Ville de Paris / Eau de Paris · Paris Data",
      "OpenStreetMap contributors · ODbL",
    ],
    generatedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=900" } });
}
