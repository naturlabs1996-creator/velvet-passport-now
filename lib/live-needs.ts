import { getNearbyPlaces, type NearbyPlace } from "./nearby-places";
import { getEffectiveInternalPois } from "./internal-catalog-effective";
import type { InternalPoiCategory } from "./internal-catalog";
import { sortByOpenStatus, type OpenStatus } from "./opening-hours";
import { getWalkingRoutes, type WalkingRoute } from "./walking-routing";

export type LiveNeedScenario = "food" | "pharmacy" | "water" | "restroom" | "sitdown";
export type LiveNeedChoice = {
  name: string;
  detail: string;
  distanceMeters: number;
  lat: number;
  lon: number;
  source: string;
  openStatus?: OpenStatus;
  openLabel?: string;
  openingHours?: string;
  closesInMinutes?: number;
  travelMinutes?: number;
  safetyWindowMinutes?: number;
  minutesOpenAfterArrival?: number;
  walkingSource?: WalkingRoute["source"];
  walkingLive?: boolean;
  walkingCacheHit?: boolean;
};

const ZONE_CENTRES: Record<string, { lat: number; lon: number }> = {
  "Louvre & Opéra": { lat: 48.8662, lon: 2.3371 },
  "Le Marais": { lat: 48.8590, lon: 2.3622 },
  "Saint-Germain-des-Prés": { lat: 48.8534, lon: 2.3333 },
  "Montmartre": { lat: 48.8867, lon: 2.3431 },
  "Quartier latin": { lat: 48.8463, lon: 2.3470 },
  "Bords de Seine": { lat: 48.8550, lon: 2.3480 },
};

const CONTEXT_SAFETY_MINUTES = {
  pharmacy: 20,
  restaurant: 60,
  cafe: 30,
} as const;

const PARIS_DATA = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets";
type ParisRecord = Record<string, unknown>;

type GeocodeFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: { label?: string };
};

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

function normalizedName(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function estimatedWalkMinutes(distanceMeters: number) {
  return Math.max(1, Math.ceil(distanceMeters / 75));
}

function contextualSafetyMinutes(scenario: LiveNeedScenario) {
  if (scenario === "pharmacy") return CONTEXT_SAFETY_MINUTES.pharmacy;
  if (scenario === "food") return CONTEXT_SAFETY_MINUTES.restaurant;
  return CONTEXT_SAFETY_MINUTES.cafe;
}

async function applyWalkingRoutes(centre: { lat: number; lon: number }, choices: LiveNeedChoice[]) {
  if (!choices.length) return choices;
  const walking = await getWalkingRoutes(centre, choices.map((choice) => ({ lat: choice.lat, lon: choice.lon })));
  return choices.map((choice, index) => {
    const route = walking[index];
    if (!route) return choice;
    return {
      ...choice,
      distanceMeters: route.distanceMeters,
      travelMinutes: route.minutes,
      walkingSource: route.source,
      walkingLive: route.live,
      walkingCacheHit: route.cacheHit,
      detail: [choice.detail, `${route.minutes} min walk`, route.source === "valhalla" ? "street-routed" : "walking estimate"].join(" · "),
    };
  });
}

function applyContextualAvailability(choice: LiveNeedChoice, scenario: LiveNeedScenario): LiveNeedChoice {
  if (choice.openStatus === "closed") return choice;

  const travelMinutes = choice.travelMinutes ?? estimatedWalkMinutes(choice.distanceMeters);
  const safetyWindowMinutes = contextualSafetyMinutes(scenario);
  const closesInMinutes = choice.closesInMinutes;

  if (typeof closesInMinutes !== "number") {
    return { ...choice, travelMinutes, safetyWindowMinutes };
  }

  const minutesOpenAfterArrival = closesInMinutes - travelMinutes;
  const contextuallyClosingSoon = minutesOpenAfterArrival <= safetyWindowMinutes;
  const openStatus: OpenStatus = contextuallyClosingSoon ? "closing_soon" : "open";
  const openLabel = contextuallyClosingSoon
    ? `Closing too soon · ${Math.max(0, minutesOpenAfterArrival)} min after arrival`
    : `Open with margin · ${minutesOpenAfterArrival} min after arrival`;

  return {
    ...choice,
    openStatus,
    openLabel,
    travelMinutes,
    safetyWindowMinutes,
    minutesOpenAfterArrival,
    detail: [choice.detail, openLabel].filter(Boolean).join(" · "),
  };
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

async function geocodeInternalAddress(address: string): Promise<{ lat: number; lon: number; label: string } | null> {
  try {
    const url = new URL("https://api-adresse.data.gouv.fr/search/");
    url.searchParams.set("q", address);
    url.searchParams.set("limit", "1");
    const response = await fetch(url, {
      next: { revalidate: 604800 },
      signal: AbortSignal.timeout(4500),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const payload = await response.json() as { features?: GeocodeFeature[] };
    const feature = payload.features?.[0];
    const coordinates = feature?.geometry?.coordinates;
    if (!coordinates || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1])) return null;
    return { lon: coordinates[0], lat: coordinates[1], label: feature?.properties?.label || address };
  } catch {
    return null;
  }
}

function statusMatch(name: string, location: { lat: number; lon: number }, candidates: NearbyPlace[]) {
  const normalized = normalizedName(name);
  return candidates.find((candidate) => normalizedName(candidate.name) === normalized)
    ?? candidates.find((candidate) => haversineMeters(location, candidate) <= 80);
}

async function internalChoices(
  routeId: string | null | undefined,
  zone: string,
  category: InternalPoiCategory,
  centre: { lat: number; lon: number },
  providerCandidates: NearbyPlace[],
): Promise<LiveNeedChoice[]> {
  const catalog = getEffectiveInternalPois(routeId, zone, category);
  const resolved = await Promise.all(catalog.map(async (poi): Promise<LiveNeedChoice | null> => {
    const location = await geocodeInternalAddress(poi.address);
    if (!location) return null;
    const distanceMeters = Math.round(haversineMeters(centre, location));
    const status = statusMatch(poi.name, location, providerCandidates);
    const openStatus = status?.openStatus ?? "unknown";
    const openLabel = status?.openLabel ?? "Hours not confirmed";
    return {
      name: poi.name,
      detail: `${poi.address} · ${poi.note} · ${distanceMeters} m away · ${openLabel}`,
      distanceMeters,
      lat: location.lat,
      lon: location.lon,
      source: "Velvet Passport internal catalog",
      openStatus,
      openLabel,
      openingHours: status?.openingHours,
      closesInMinutes: status?.closesInMinutes,
    };
  }));
  const usable = resolved.filter((item): item is NonNullable<typeof item> => item !== null);
  return sortByOpenStatus(usable);
}

async function parisPublicPlaces(dataset: string, centre: { lat: number; lon: number }, radiusMeters: number): Promise<LiveNeedChoice[]> {
  const where = encodeURIComponent(`distance(geo_point_2d, geom'POINT(${centre.lon} ${centre.lat})') < ${radiusMeters}`);
  const urls = [
    `${PARIS_DATA}/${dataset}/records?where=${where}&limit=40`,
    `${PARIS_DATA}/${dataset}/records?limit=80`,
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(5000) });
      if (!response.ok) continue;
      const payload = await response.json() as { results?: ParisRecord[] };
      const choices: LiveNeedChoice[] = [];
      for (const record of payload.results ?? []) {
        const coords = point(record);
        if (!coords) continue;
        const distanceMeters = Math.round(haversineMeters(centre, coords));
        if (distanceMeters > radiusMeters) continue;
        choices.push({ name: label(record, dataset), detail: `${distanceMeters} m away`, distanceMeters, ...coords, source: "Paris Data", openStatus: "unknown", openLabel: "Availability from public dataset" });
      }
      return choices.sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 5);
    } catch { continue; }
  }
  return [];
}

function commercialChoices(items: NearbyPlace[]): LiveNeedChoice[] {
  return items.slice(0, 8).map((item) => ({
    name: item.name,
    detail: [item.address, item.detail, item.openLabel, `${item.distanceMeters} m away`].filter(Boolean).join(" · "),
    distanceMeters: item.distanceMeters,
    lat: item.lat,
    lon: item.lon,
    source: item.source === "osm" ? "OpenStreetMap" : item.source === "geoapify" ? "Geoapify" : "Foursquare",
    openStatus: item.openStatus ?? "unknown",
    openLabel: item.openLabel ?? "Hours not confirmed",
    openingHours: item.openingHours,
    closesInMinutes: item.closesInMinutes,
  }));
}

function dedupe(choices: LiveNeedChoice[]) {
  const seen = new Set<string>();
  return choices.filter((item) => {
    const key = normalizedName(item.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sourceRank(source: string) {
  return source === "Velvet Passport internal catalog" ? 0 : source === "OpenStreetMap" ? 1 : source === "Geoapify" ? 2 : 3;
}

function prioritizeChoices(choices: LiveNeedChoice[]) {
  const statusRank: Record<OpenStatus, number> = { open: 0, unknown: 1, closing_soon: 2, closed: 3 };
  return dedupe(choices).sort((a, b) => {
    const aStatus = statusRank[a.openStatus ?? "unknown"];
    const bStatus = statusRank[b.openStatus ?? "unknown"];
    if (aStatus !== bStatus) return aStatus - bStatus;
    if (a.openStatus === "open" && b.openStatus === "open") {
      const aRemaining = a.minutesOpenAfterArrival ?? a.closesInMinutes ?? Number.POSITIVE_INFINITY;
      const bRemaining = b.minutesOpenAfterArrival ?? b.closesInMinutes ?? Number.POSITIVE_INFINITY;
      if (aRemaining !== bRemaining) return bRemaining - aRemaining;
    }
    const sourceDelta = sourceRank(a.source) - sourceRank(b.source);
    if (sourceDelta !== 0) return sourceDelta;
    return (a.travelMinutes ?? Number.POSITIVE_INFINITY) - (b.travelMinutes ?? Number.POSITIVE_INFINITY) || a.distanceMeters - b.distanceMeters;
  });
}

export async function getLiveNeedChoices(zone: string, scenario: LiveNeedScenario, exactLocation?: { lat: number; lon: number }, routeId?: string | null) {
  const centre = exactLocation ?? centreForZone(zone);
  if (scenario === "water") {
    const choices = await parisPublicPlaces("fontaines-a-boire", centre, 900);
    return (await applyWalkingRoutes(centre, choices)).sort((a, b) => (a.travelMinutes ?? 999) - (b.travelMinutes ?? 999)).slice(0, 5);
  }
  if (scenario === "restroom") {
    const choices = await parisPublicPlaces("sanisettesparis", centre, 900);
    return (await applyWalkingRoutes(centre, choices)).sort((a, b) => (a.travelMinutes ?? 999) - (b.travelMinutes ?? 999)).slice(0, 5);
  }

  const places = await getNearbyPlaces(centre, 900);

  if (scenario === "sitdown") {
    const curated = await internalChoices(routeId, zone, "cafe", centre, places.cafes);
    const external = commercialChoices(places.cafes);
    const routed = await applyWalkingRoutes(centre, dedupe([...curated, ...external]).slice(0, 8));
    const contextual = routed.map((choice) => applyContextualAvailability(choice, scenario));
    const verifiedCafes = prioritizeChoices(contextual).filter((choice) => choice.openStatus === "open").slice(0, 5);
    if (verifiedCafes.length) return verifiedCafes;

    const fallback = await parisPublicPlaces("espaces_verts", centre, 800);
    return (await applyWalkingRoutes(centre, fallback)).map((choice) => ({
      ...choice,
      detail: `${choice.detail} · Quiet outdoor fallback; café availability could not be verified.`,
    })).slice(0, 5);
  }

  const category: InternalPoiCategory = scenario === "pharmacy" ? "pharmacy" : "restaurant";
  const providerCandidates = scenario === "pharmacy" ? places.pharmacies : places.restaurants;
  const curated = await internalChoices(routeId, zone, category, centre, providerCandidates);
  const external = commercialChoices(providerCandidates);
  const routed = await applyWalkingRoutes(centre, dedupe([...curated, ...external]).slice(0, 8));
  const contextual = routed.map((choice) => applyContextualAvailability(choice, scenario));
  const prioritized = prioritizeChoices(contextual);

  // Commercial recommendations fail closed. Quantity never outranks verified
  // opening margin: unknown, closed, or contextually closing-soon venues are
  // never reintroduced simply to fill the result list.
  return prioritized.filter((choice) => choice.openStatus === "open").slice(0, 5);
}
