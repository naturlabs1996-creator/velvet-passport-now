import { getNearbyPlaces, type NearbyPlace } from "./nearby-places";

export type LiveNeedScenario = "food" | "pharmacy" | "water" | "restroom" | "sitdown";
export type LiveNeedChoice = { name: string; detail: string; distanceMeters: number; lat: number; lon: number; source: string };

const ZONE_CENTRES: Record<string, { lat: number; lon: number }> = {
  "Louvre & Opéra": { lat: 48.8662, lon: 2.3371 },
  "Le Marais": { lat: 48.8590, lon: 2.3622 },
  "Saint-Germain": { lat: 48.8534, lon: 2.3333 },
  "Montmartre": { lat: 48.8867, lon: 2.3431 },
  "Quartier latin": { lat: 48.8463, lon: 2.3470 },
  "Bords de Seine": { lat: 48.8550, lon: 2.3480 },
};

const PARIS_DATA = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets";
type ParisRecord = Record<string, unknown>;

function centreForZone(zone: string) {
  return ZONE_CENTRES[zone] ?? ZONE_CENTRES["Louvre & Opéra"];
}

function haversineMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function point(record: ParisRecord): { lat: number; lon: number } | null {
  for (const key of ["geo_point_2d", "coordonnees_geo", "geometry", "geom", "geo_shape"]) {
    const raw = record[key] as Record<string, unknown> | undefined;
    if (!raw) continue;
    if (typeof raw.lat === "number" && typeof raw.lon === "number") return { lat: raw.lat, lon: raw.lon };
    const coordinates = raw.coordinates;
    if (Array.isArray(coordinates) && typeof coordinates[0] === "number" && typeof coordinates[1] === "number") return { lon: coordinates[0], lat: coordinates[1] };
  }
  return null;
}

function label(record: ParisRecord, fallback: string) {
  for (const key of ["nom", "name", "libelle", "voie", "adresse", "adresse_complete", "description", "type_objet", "type"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 160);
  }
  return fallback;
}

async function parisPublicPlaces(dataset: string, centre: { lat: number; lon: number }, radiusMeters: number): Promise<LiveNeedChoice[]> {
  const where = encodeURIComponent(`distance(geo_point_2d, geom'POINT(${centre.lon} ${centre.lat})') < ${radiusMeters}`);
  const urls = [
    `${PARIS_DATA}/${dataset}/records?where=${where}&limit=40`,
    `${PARIS_DATA}/${dataset}/records?limit=80`,
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url, { next: { revalidate: 900 }, signal: AbortSignal.timeout(5000) });
      if (!response.ok) continue;
      const payload = await response.json() as { results?: ParisRecord[] };
      const choices: LiveNeedChoice[] = [];
      for (const record of payload.results ?? []) {
        const coords = point(record);
        if (!coords) continue;
        const distanceMeters = Math.round(haversineMeters(centre, coords));
        if (distanceMeters > radiusMeters) continue;
        choices.push({ name: label(record, dataset), detail: `${distanceMeters} m away`, distanceMeters, ...coords, source: "Paris Data" });
      }
      return choices.sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 5);
    } catch { continue; }
  }
  return [];
}

function commercialChoices(items: NearbyPlace[]): LiveNeedChoice[] {
  return items.slice(0, 5).map((item) => ({
    name: item.name,
    detail: [item.address, item.detail, `${item.distanceMeters} m away`].filter(Boolean).join(" · "),
    distanceMeters: item.distanceMeters,
    lat: item.lat,
    lon: item.lon,
    source: item.source === "osm" ? "OpenStreetMap" : item.source === "geoapify" ? "Geoapify" : "Foursquare",
  }));
}

export async function getLiveNeedChoices(zone: string, scenario: LiveNeedScenario, exactLocation?: { lat: number; lon: number }) {
  const centre = exactLocation ?? centreForZone(zone);
  if (scenario === "water") return parisPublicPlaces("fontaines-a-boire", centre, 900);
  if (scenario === "restroom") return parisPublicPlaces("sanisettesparis", centre, 900);
  if (scenario === "sitdown") return parisPublicPlaces("espaces_verts", centre, 800);

  const places = await getNearbyPlaces(centre, 900);
  if (scenario === "pharmacy") return commercialChoices(places.pharmacies);
  return commercialChoices(places.restaurants);
}
