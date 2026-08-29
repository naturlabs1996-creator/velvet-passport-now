import type { MontrealPilotRoute, MontrealPilotStop } from "./montreal-pilot-routes";

type Coordinates = { lat: number; lon: number };

export type PilotSimulationScenario = {
  currentLocation?: Coordinates;
  visitedStopIds?: string[];
  unavailableStopIds?: string[];
  weather?: "route" | "rain" | "snow" | "heat" | "cold";
  paused?: boolean;
};

export type PilotSimulationResult = {
  routeId: string;
  nextStop: MontrealPilotStop | null;
  skippedStopIds: string[];
  remainingStopIds: string[];
  distanceToNextMeters: number | null;
  walkingMinutesToNext: number | null;
  paused: boolean;
  weatherAction: "continue" | "prefer-indoor" | "shorten-outdoor";
  safe: boolean;
  notes: string[];
};

function haversineMeters(a: Coordinates, b: Coordinates) {
  const toRad = (value: number) => value * Math.PI / 180;
  const radius = 6_371_000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function walkingMinutes(distanceMeters: number) {
  return Math.max(1, Math.round(distanceMeters / 78));
}

function stopByName(route: MontrealPilotRoute, name?: string) {
  if (!name) return null;
  return route.stops.find((stop) => stop.name === name) ?? null;
}

function chooseFallback(route: MontrealPilotRoute, stop: MontrealPilotStop, visited: Set<string>, unavailable: Set<string>) {
  const fallback = stopByName(route, stop.fallback);
  if (!fallback) return null;
  if (visited.has(fallback.id) || unavailable.has(fallback.id)) return null;
  return fallback;
}

export function simulateMontrealPilotRoute(route: MontrealPilotRoute, scenario: PilotSimulationScenario = {}): PilotSimulationResult {
  const visited = new Set(scenario.visitedStopIds ?? []);
  const unavailable = new Set(scenario.unavailableStopIds ?? []);
  const skipped = new Set<string>();
  const notes: string[] = [];

  if (scenario.paused) {
    return {
      routeId: route.id,
      nextStop: null,
      skippedStopIds: [],
      remainingStopIds: route.stops.filter((stop) => !visited.has(stop.id)).map((stop) => stop.id),
      distanceToNextMeters: null,
      walkingMinutesToNext: null,
      paused: true,
      weatherAction: "continue",
      safe: true,
      notes: ["Route is paused; no movement or background replan should advance the journey."],
    };
  }

  let nextStop: MontrealPilotStop | null = null;
  for (const stop of route.stops) {
    if (visited.has(stop.id)) continue;
    if (unavailable.has(stop.id)) {
      skipped.add(stop.id);
      const fallback = chooseFallback(route, stop, visited, unavailable);
      if (fallback) {
        nextStop = fallback;
        notes.push(`${stop.name} is unavailable; using unvisited fallback ${fallback.name}.`);
        break;
      }
      notes.push(`${stop.name} is unavailable; its fallback is missing, unavailable, or already visited, so the stop is skipped.`);
      continue;
    }
    nextStop = stop;
    break;
  }

  const remainingStopIds = route.stops
    .filter((stop) => !visited.has(stop.id) && !skipped.has(stop.id) && stop.id !== nextStop?.id)
    .map((stop) => stop.id);

  const distanceToNextMeters = nextStop && scenario.currentLocation
    ? Math.round(haversineMeters(scenario.currentLocation, { lat: nextStop.lat, lon: nextStop.lon }))
    : null;

  const weather = scenario.weather ?? "route";
  const nextIsIndoor = nextStop?.access === "opening-hours";
  let weatherAction: PilotSimulationResult["weatherAction"] = "continue";
  if (weather === "rain" || weather === "snow") {
    weatherAction = nextIsIndoor ? "prefer-indoor" : "shorten-outdoor";
  }

  if (!nextStop) notes.push("No safe unvisited stop remains; end the pilot route instead of inventing another destination.");
  if (distanceToNextMeters !== null && distanceToNextMeters > 2_500) notes.push("GPS displacement is large; a fresh transport decision is required before continuing.");

  return {
    routeId: route.id,
    nextStop,
    skippedStopIds: Array.from(skipped),
    remainingStopIds,
    distanceToNextMeters,
    walkingMinutesToNext: distanceToNextMeters === null ? null : walkingMinutes(distanceToNextMeters),
    paused: false,
    weatherAction,
    safe: true,
    notes,
  };
}
