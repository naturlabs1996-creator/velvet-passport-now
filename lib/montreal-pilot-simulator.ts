import type { MontrealPilotRoute, MontrealPilotStop } from "./montreal-pilot-routes";

type Coordinates = { lat: number; lon: number };
type TransitState = "normal" | "degraded" | "unavailable" | "unknown";

export type PilotSimulationScenario = {
  currentLocation?: Coordinates;
  visitedStopIds?: string[];
  unavailableStopIds?: string[];
  weather?: "route" | "rain" | "snow" | "heat" | "cold";
  paused?: boolean;
  transit?: {
    stm?: TransitState;
    rem?: TransitState;
  };
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
  transitAction: "continue" | "replan" | "walk-or-taxi";
  routeAction: "continue" | "replan-from-current-location" | "end-safely";
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

function transitDecision(transit?: PilotSimulationScenario["transit"]) {
  const stm = transit?.stm ?? "normal";
  const rem = transit?.rem ?? "normal";
  if (stm === "unavailable" && rem === "unavailable") return "walk-or-taxi" as const;
  if (stm === "unavailable" || rem === "unavailable" || stm === "degraded" || rem === "degraded") return "replan" as const;
  return "continue" as const;
}

export function simulateMontrealPilotRoute(route: MontrealPilotRoute, scenario: PilotSimulationScenario = {}): PilotSimulationResult {
  const visited = new Set(scenario.visitedStopIds ?? []);
  const unavailable = new Set(scenario.unavailableStopIds ?? []);
  const skipped = new Set<string>();
  const notes: string[] = [];
  const transitAction = transitDecision(scenario.transit);

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
      transitAction,
      routeAction: "continue",
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

  let routeAction: PilotSimulationResult["routeAction"] = "continue";
  if (!nextStop) {
    routeAction = "end-safely";
    notes.push("No safe unvisited stop remains; end the pilot route instead of inventing another destination.");
  } else if (distanceToNextMeters !== null && distanceToNextMeters > 2_500) {
    routeAction = "replan-from-current-location";
    notes.push("GPS displacement is large; a fresh transport decision is required before continuing.");
  }

  if (transitAction === "replan") {
    notes.push("STM or REM is degraded/unavailable; recalculate without assuming the affected service is usable.");
  } else if (transitAction === "walk-or-taxi") {
    notes.push("STM and REM are unavailable; offer only verified walking or taxi fallback until transit recovers.");
  }

  if (weatherAction === "shorten-outdoor") {
    notes.push(weather === "snow" ? "Snow protection active; shorten exposed outdoor segments." : "Rain protection active; shorten exposed outdoor segments.");
  } else if (weatherAction === "prefer-indoor") {
    notes.push("Adverse weather detected; prefer the verified indoor stop while it is open.");
  }

  return {
    routeId: route.id,
    nextStop,
    skippedStopIds: Array.from(skipped),
    remainingStopIds,
    distanceToNextMeters,
    walkingMinutesToNext: distanceToNextMeters === null ? null : walkingMinutes(distanceToNextMeters),
    paused: false,
    weatherAction,
    transitAction,
    routeAction,
    safe: true,
    notes,
  };
}
