import { getPassAccess } from "../../../../lib/pass-access";
import { getNearbyPlaces } from "../../../../lib/nearby-places";
import { getRainAhead } from "../../../../lib/rain-ahead";
import { getWeatherIntelligence, type Coordinates } from "../../../../lib/weather-intelligence";

export const runtime = "nodejs";

type NearbyItem = { name: string; lat: number; lon: number; distanceMeters: number; detail?: string };
type ParisRecord = Record<string, unknown>;

const PARIS_BOUNDS = { minLat: 48.815, maxLat: 48.905, minLon: 2.224, maxLon: 2.470 };
const PARIS_DATA = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets";

function inParis(point: Coordinates) {
  return point.lat >= PARIS_BOUNDS.minLat && point.lat <= PARIS_BOUNDS.maxLat && point.lon >= PARIS_BOUNDS.minLon && point.lon <= PARIS_BOUNDS.maxLon;
}

function haversineMeters(a: Coordinates, b: Coordinates) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function pointFromUnknown(value: unknown): Coordinates | null {
  if (!value || typeof value !== "object") return null;
  const object = value as Record<string, unknown>;
  if (typeof object.lat === "number" && typeof object.lon === "number") return { lat: object.lat, lon: object.lon };
  const coordinates = object.coordinates;
  if (Array.isArray(coordinates) && typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
    return { lon: coordinates[0], lat: coordinates[1] };
  }
  return null;
}

function recordPoint(record: ParisRecord): Coordinates | null {
  for (const key of ["geo_point_2d", "coordonnees_geo", "geometry", "geom", "geo_shape"]) {
    const point = pointFromUnknown(record[key]);
    if (point) return point;
  }
  return null;
}

function recordLabel(record: ParisRecord, fallback: string) {
  for (const key of ["nom", "name", "libelle", "voie", "adresse", "adresse_complete", "description", "type_objet", "type"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 180);
  }
  return fallback;
}

async function parisDataset(dataset: string, centre: Coordinates, radiusMeters: number): Promise<NearbyItem[]> {
  const where = encodeURIComponent(`distance(geo_point_2d, geom'POINT(${centre.lon} ${centre.lat})') < ${radiusMeters}`);
  const urls = [
    `${PARIS_DATA}/${dataset}/records?where=${where}&limit=80`,
    `${PARIS_DATA}/${dataset}/records?limit=80`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, { next: { revalidate: 900 }, signal: AbortSignal.timeout(5500) });
      if (!response.ok) continue;
      const payload = await response.json() as { results?: ParisRecord[] };
      const nearby: NearbyItem[] = [];
      for (const record of payload.results ?? []) {
        const point = recordPoint(record);
        if (!point) continue;
        const distanceMeters = Math.round(haversineMeters(centre, point));
        if (distanceMeters > radiusMeters) continue;
        nearby.push({ name: recordLabel(record, dataset), lat: point.lat, lon: point.lon, distanceMeters });
      }
      nearby.sort((a, b) => a.distanceMeters - b.distanceMeters);
      return nearby.slice(0, 12);
    } catch { continue; }
  }
  return [];
}

export async function POST(request: Request) {
  const access = await getPassAccess();
  if (!access.allowed) return Response.json({ error: "A valid Paris NOW Pass is required" }, { status: 401 });

  let body: { lat?: unknown; lon?: unknown; radiusMeters?: unknown };
  try { body = await request.json() as { lat?: unknown; lon?: unknown; radiusMeters?: unknown }; }
  catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }

  const lat = Number(body.lat);
  const lon = Number(body.lon);
  const centre = { lat, lon };
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inParis(centre)) {
    return Response.json({ error: "Paris coordinates are required for live context." }, { status: 422 });
  }
  const radiusMeters = Math.max(250, Math.min(1500, Number(body.radiusMeters) || 800));

  const [forecast, rainAhead, fountains, restrooms, closures, works, amenities] = await Promise.all([
    getWeatherIntelligence(centre),
    getRainAhead(centre),
    parisDataset("fontaines-a-boire", centre, radiusMeters),
    parisDataset("sanisettesparis", centre, radiusMeters),
    parisDataset("circulation_evenement", centre, radiusMeters),
    parisDataset("chantiers-a-paris", centre, radiusMeters),
    getNearbyPlaces(centre, radiusMeters),
  ]);

  const disruptions = [...closures, ...works].sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 12);
  return Response.json({
    location: centre,
    radiusMeters,
    weather: forecast,
    rainAhead,
    water: fountains,
    restrooms,
    pharmacies: amenities.pharmacies,
    restaurants: amenities.restaurants,
    cafes: amenities.cafes,
    disruptions,
    providers: { places: amenities.providersUsed, placesCacheHit: amenities.cacheHit },
    decision: {
      suggestedScenario: forecast.scenario,
      nearbyWater: fountains.length > 0,
      nearbyRestroom: restrooms.length > 0,
      nearbyPharmacy: amenities.pharmacies.length > 0,
      streetIssueNearby: disruptions.some((item) => item.distanceMeters <= 250),
      offerRainAdjustment: rainAhead.alert,
      rainAdjustmentAction: rainAhead.alert ? "ask-traveler-before-adjusting" : null,
    },
    sources: [
      "NOW Weather Intelligence · regional multi-model strategy",
      ...forecast.readings.filter((reading) => reading.available).map((reading) => reading.source),
      ...(rainAhead.available ? ["MET Norway · Rain Ahead"] : []),
      "Ville de Paris / Eau de Paris · Paris Data",
      "OpenStreetMap contributors · ODbL",
      ...(process.env.GEOAPIFY_API_KEY ? ["Geoapify · fallback provider"] : []),
      ...(process.env.FOURSQUARE_API_KEY ? ["Foursquare · fallback provider"] : []),
    ],
    generatedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=900" } });
}
