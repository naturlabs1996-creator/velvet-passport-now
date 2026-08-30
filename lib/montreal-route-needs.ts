import { getNearbyPlaces, type NearbyPlace } from "./nearby-places";
import { getMontrealOsmNeeds, type MontrealNeedPlace } from "./montreal-needs-provider";
import type { MontrealPilotRoute } from "./montreal-pilot-routes";

type Coordinates = { lat: number; lon: number };

type CommercialPlace = NearbyPlace | MontrealNeedPlace;

export type MontrealRouteNeeds = {
  routeId: string;
  centre: Coordinates;
  requestedRadiusMeters: number;
  radiusMeters: number;
  radiusExpanded: boolean;
  restaurants: CommercialPlace[];
  cafes: CommercialPlace[];
  pharmacies: CommercialPlace[];
  restrooms: MontrealNeedPlace[];
  water: MontrealNeedPlace[];
  usefulShops: MontrealNeedPlace[];
  providersUsed: string[];
  providerReachable: boolean;
  cacheHit: boolean;
};

function routeCentre(route: MontrealPilotRoute): Coordinates {
  const count = Math.max(1, route.stops.length);
  return {
    lat: route.stops.reduce((sum, stop) => sum + stop.lat, 0) / count,
    lon: route.stops.reduce((sum, stop) => sum + stop.lon, 0) / count,
  };
}

function normalizedName(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function mergeCommercial(primary: CommercialPlace[], fallback: NearbyPlace[], max: number) {
  const result = [...primary];
  for (const item of fallback) {
    const duplicate = result.some((candidate) => {
      const sameName = normalizedName(candidate.name) === normalizedName(item.name);
      const close = Math.abs(candidate.lat - item.lat) < 0.0006 && Math.abs(candidate.lon - item.lon) < 0.0008;
      return sameName || close;
    });
    if (!duplicate) result.push(item);
    if (result.length >= max) break;
  }
  return result.slice(0, max);
}

function resultCount(osm: Awaited<ReturnType<typeof getMontrealOsmNeeds>>) {
  return osm.pharmacies.length
    + osm.restaurants.length
    + osm.cafes.length
    + osm.restrooms.length
    + osm.water.length
    + osm.usefulShops.length;
}

function commercialCoverage(osm: Awaited<ReturnType<typeof getMontrealOsmNeeds>>) {
  return osm.pharmacies.length >= 2 && osm.restaurants.length >= 3 && osm.cafes.length >= 3;
}

export async function getMontrealRouteNeeds(route: MontrealPilotRoute, radiusMeters = 700): Promise<MontrealRouteNeeds> {
  const centre = routeCentre(route);
  const requestedRadius = Math.max(300, Math.min(1200, radiusMeters));
  let effectiveRadius = requestedRadius;
  let osm = await getMontrealOsmNeeds(centre, effectiveRadius);

  const shouldExpand = requestedRadius < 800 && (resultCount(osm) === 0 || !commercialCoverage(osm));
  if (shouldExpand) {
    const expandedRadius = Math.min(800, requestedRadius + 100);
    const expanded = await getMontrealOsmNeeds(centre, expandedRadius);
    if (resultCount(expanded) > resultCount(osm) || commercialCoverage(expanded)) {
      osm = expanded;
      effectiveRadius = expandedRadius;
    }
  }

  const needsFallback = osm.pharmacies.length < 2 || osm.restaurants.length < 3 || osm.cafes.length < 3;
  const fallback = needsFallback ? await getNearbyPlaces(centre, effectiveRadius) : null;

  const restaurants = mergeCommercial(osm.restaurants, fallback?.restaurants ?? [], 3);
  const cafes = mergeCommercial(osm.cafes, fallback?.cafes ?? [], 3);
  const pharmacies = mergeCommercial(osm.pharmacies, fallback?.pharmacies ?? [], 2);

  const providersUsed = [
    ...(osm.providerReachable ? ["OpenStreetMap"] : []),
    ...(fallback?.providersUsed ?? []),
  ];

  return {
    routeId: route.id,
    centre,
    requestedRadiusMeters: requestedRadius,
    radiusMeters: effectiveRadius,
    radiusExpanded: effectiveRadius > requestedRadius,
    restaurants,
    cafes,
    pharmacies,
    restrooms: osm.restrooms.slice(0, 4),
    water: osm.water.slice(0, 4),
    usefulShops: osm.usefulShops.slice(0, 4),
    providersUsed: Array.from(new Set(providersUsed)),
    providerReachable: osm.providerReachable || Boolean(fallback?.providersUsed.length),
    cacheHit: osm.cacheHit && (fallback ? fallback.cacheHit : true),
  };
}
