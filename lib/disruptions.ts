export type Coordinates = { lat: number; lon: number };
export type DisruptionSeverity = "blocked" | "caution" | "nearby";
export type RouteDisruption = {
  id: string;
  kind: "closure" | "works" | "event";
  label: string;
  severity: DisruptionSeverity;
  distanceMeters: number;
  source: string;
  geometryPoints: Coordinates[];
};

type DatasetResult = {
  items: RouteDisruption[];
  providerIssue: boolean;
};

const PARIS_DATA = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets";
const GEOCODE = "https://api-adresse.data.gouv.fr/search/";
const geocodeCache = new Map<string, { expiresAt: number; value: Coordinates | null }>();
const GEO_TTL = 7 * 24 * 60 * 60 * 1000;

type ParisRecord = Record<string, unknown>;

function rad(value: number) { return value * Math.PI / 180; }
function haversineMeters(a: Coordinates, b: Coordinates) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function flattenCoordinates(value: unknown, out: Coordinates[] = []): Coordinates[] {
  if (!Array.isArray(value)) return out;
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    const lon = Number(value[0]);
    const lat = Number(value[1]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) out.push({ lat, lon });
    return out;
  }
  for (const child of value) flattenCoordinates(child, out);
  return out;
}

function geometryPoints(record: ParisRecord): Coordinates[] {
  for (const key of ["geo_shape", "geometry", "geom", "geo_point_2d", "coordonnees_geo"]) {
    const raw = record[key];
    if (!raw || typeof raw !== "object") continue;
    const object = raw as Record<string, unknown>;
    if (typeof object.lat === "number" && typeof object.lon === "number") return [{ lat: object.lat, lon: object.lon }];
    const points = flattenCoordinates(object.coordinates);
    if (points.length) return points;
  }
  return [];
}

function recordLabel(record: ParisRecord, fallback: string) {
  for (const key of ["chantier_synthese", "libelle", "description", "voie", "adresse", "nom", "name", "type"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 180);
  }
  return fallback;
}

function pointToSegmentMeters(point: Coordinates, a: Coordinates, b: Coordinates) {
  const meanLat = rad((point.lat + a.lat + b.lat) / 3);
  const scaleX = 111320 * Math.cos(meanLat);
  const scaleY = 110540;
  const px = (point.lon - a.lon) * scaleX;
  const py = (point.lat - a.lat) * scaleY;
  const bx = (b.lon - a.lon) * scaleX;
  const by = (b.lat - a.lat) * scaleY;
  const len2 = bx * bx + by * by;
  if (len2 <= 0.0001) return Math.hypot(px, py);
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / len2));
  return Math.hypot(px - t * bx, py - t * by);
}

function distanceToRoute(point: Coordinates, route: Coordinates[]) {
  if (!route.length) return Infinity;
  if (route.length === 1) return haversineMeters(point, route[0]);
  let best = Infinity;
  for (let i = 0; i < route.length - 1; i += 1) best = Math.min(best, pointToSegmentMeters(point, route[i], route[i + 1]));
  return best;
}

async function geocodePlace(name: string): Promise<Coordinates | null> {
  const key = name.trim().toLocaleLowerCase("fr-FR");
  const cached = geocodeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  try {
    const url = new URL(GEOCODE);
    url.searchParams.set("q", `${name}, Paris`);
    url.searchParams.set("limit", "1");
    const response = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(4500) });
    if (!response.ok) throw new Error("geocode unavailable");
    const payload = await response.json() as { features?: Array<{ geometry?: { coordinates?: [number, number] } }> };
    const coords = payload.features?.[0]?.geometry?.coordinates;
    const value = coords && Number.isFinite(coords[0]) && Number.isFinite(coords[1]) ? { lon: coords[0], lat: coords[1] } : null;
    geocodeCache.set(key, { expiresAt: Date.now() + GEO_TTL, value });
    return value;
  } catch {
    geocodeCache.set(key, { expiresAt: Date.now() + 15 * 60 * 1000, value: null });
    return null;
  }
}

async function fetchDataset(dataset: string, kind: RouteDisruption["kind"], limit = 100): Promise<DatasetResult> {
  try {
    const response = await fetch(`${PARIS_DATA}/${dataset}/records?limit=${limit}`, { next: { revalidate: 900 }, signal: AbortSignal.timeout(5500) });
    if (!response.ok) return { items: [], providerIssue: true };
    const payload = await response.json() as { results?: ParisRecord[] };
    const items = (payload.results ?? []).map((record, index) => ({
      id: String(record.num_emprise ?? record.id ?? `${dataset}-${index}`),
      kind,
      label: recordLabel(record, kind === "works" ? "Road works" : kind === "closure" ? "Road closure" : "Traffic event"),
      severity: "nearby" as const,
      distanceMeters: Infinity,
      source: `Paris Data · ${dataset}`,
      geometryPoints: geometryPoints(record),
    })).filter((item) => item.geometryPoints.length > 0);
    return { items, providerIssue: false };
  } catch {
    return { items: [], providerIssue: true };
  }
}

export async function getRouteDisruptions(stopNames: string[], origin?: Coordinates) {
  const stopCoords = (await Promise.all(stopNames.map(geocodePlace))).filter((point): point is Coordinates => Boolean(point));
  const route = origin ? [origin, ...stopCoords] : stopCoords;
  if (!route.length) return { disruptions: [] as RouteDisruption[], routeGeometry: route, blockedStop: null as string | null, degraded: true };

  const [closures, works, events] = await Promise.all([
    fetchDataset("fermetures-voirie", "closure", 100),
    fetchDataset("chantiers-a-paris", "works", 100),
    fetchDataset("circulation_evenement", "event", 100),
  ]);

  const providerIssue = closures.providerIssue || works.providerIssue || events.providerIssue;
  const assessed = [...closures.items, ...works.items, ...events.items].map((item) => {
    const distanceMeters = Math.min(...item.geometryPoints.map((point) => distanceToRoute(point, route)));
    const severity: DisruptionSeverity = distanceMeters <= 25 ? "blocked" : distanceMeters <= 70 ? "caution" : "nearby";
    return { ...item, distanceMeters: Math.round(distanceMeters), severity };
  }).filter((item) => item.distanceMeters <= 180).sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 12);

  const blocking = assessed.find((item) => item.severity === "blocked");
  let blockedStop: string | null = null;
  if (blocking && stopCoords.length) {
    let best = Infinity;
    stopCoords.forEach((point, index) => {
      const distance = Math.min(...blocking.geometryPoints.map((candidate) => haversineMeters(point, candidate)));
      if (distance < best) { best = distance; blockedStop = stopNames[index] ?? null; }
    });
  }

  const routeGeometryDegraded = stopCoords.length < Math.max(1, Math.ceil(stopNames.length / 2));
  return {
    disruptions: assessed,
    routeGeometry: route,
    blockedStop,
    degraded: providerIssue || routeGeometryDegraded,
  };
}
