import { getConfidentialRoutes } from "./confidential-routes";
import { getLiveNeedChoices, type LiveNeedChoice, type LiveNeedScenario } from "./live-needs";
import { liveNeedsHealthSignal, walkingHealthSignal } from "./now-health-adapters";
import { summarizeNowHealth, type NowHealthSignal, type NowHealthSnapshot } from "./now-health";
import type { NowComposableRequest, NowNeedConstraint } from "./now-request";

export type PlannedNeed = {
  type: NowNeedConstraint["type"];
  cuisine?: string;
  selected: LiveNeedChoice | null;
  choices: LiveNeedChoice[];
  travelMinutes: number;
  serviceMinutes: number;
  totalMinutes: number;
  withinMinutes?: number;
  deadlineProtected: boolean;
  preferenceMatched?: boolean;
  timeFeasible?: boolean;
};

export type ConstraintPlan = {
  routeId?: string;
  availableMinutes: number;
  transportMinutes: number;
  protectedMarginMinutes: number;
  needs: PlannedNeed[];
  totalCommittedMinutes: number;
  remainingMinutes: number;
  ticketProtected: boolean;
  factors: string[];
  health: NowHealthSnapshot;
};

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function serviceMinutes(type: NowNeedConstraint["type"]) {
  if (type === "food") return 45;
  if (type === "pharmacy") return 10;
  if (type === "water" || type === "restroom" || type === "sitdown") return 8;
  return 5;
}

function choiceTravelMinutes(choice: LiveNeedChoice) {
  return choice.travelMinutes ?? Math.max(1, Math.ceil(choice.distanceMeters / 75));
}

function filterCuisine(choices: LiveNeedChoice[], cuisine?: string) {
  if (!cuisine) return choices;
  const wanted = normalize(cuisine);
  const aliases: Record<string, string[]> = {
    chinese: ["chinese", "china", "cantonese", "sichuan", "szechuan", "dim sum", "hotpot"],
    chinois: ["chinese", "china", "cantonese", "sichuan", "szechuan", "dim sum", "hotpot", "chinois"],
    italian: ["italian", "pizza", "pasta", "italien"],
    italien: ["italian", "pizza", "pasta", "italien"],
    japanese: ["japanese", "sushi", "ramen", "japonais"],
    japonais: ["japanese", "sushi", "ramen", "japonais"],
  };
  const terms = aliases[wanted] ?? [wanted];
  return choices.filter((choice) => {
    const haystack = normalize(`${choice.name} ${choice.detail}`);
    return terms.some((term) => haystack.includes(normalize(term)));
  });
}

function routeZone(routeId?: string) {
  if (!routeId) return "Louvre & Opéra";
  return getConfidentialRoutes().find((route) => route.id === routeId)?.zone ?? "Louvre & Opéra";
}

function liveScenario(type: NowNeedConstraint["type"]): LiveNeedScenario | null {
  return ["food", "pharmacy", "water", "restroom", "sitdown"].includes(type) ? type as LiveNeedScenario : null;
}

function needPriority(need: NowNeedConstraint) {
  // Explicit deadlines are hard constraints and always outrank comfort/curation.
  if (need.withinMinutes !== undefined) return Math.max(0, need.withinMinutes);
  if (need.type === "pharmacy") return 300;
  if (need.type === "water" || need.type === "restroom") return 400;
  if (need.type === "medication" || need.type === "glucose") return 450;
  if (need.type === "sitdown" || need.type === "battery") return 700;
  if (need.type === "food") return 900;
  return 800;
}

function orderedNeeds(needs: NowNeedConstraint[]) {
  return needs
    .map((need, index) => ({ need, index }))
    .sort((a, b) => needPriority(a.need) - needPriority(b.need) || a.index - b.index)
    .map(({ need }) => need);
}

export async function planComposableRequest(request: NowComposableRequest): Promise<ConstraintPlan> {
  const zone = routeZone(request.routeId);
  let location = request.location;
  const transportMinutes = request.transport?.minutes ?? 0;
  const protectedMarginMinutes = request.ticket?.protectedMarginMinutes ?? 15;
  let elapsed = transportMinutes;
  const needs: PlannedNeed[] = [];
  const factors = ["available time", "protected ticket margin", "hard-deadline priority"];
  const healthSignals: NowHealthSignal[] = [];
  if (transportMinutes) factors.push("transport connection");

  const prioritizedNeeds = orderedNeeds(request.needs);

  for (const need of prioritizedNeeds) {
    const scenario = liveScenario(need.type);
    if (!scenario) {
      const service = serviceMinutes(need.type);
      const protectsOverallTime = elapsed + service + protectedMarginMinutes <= request.availableMinutes;
      const protectsNeedDeadline = !need.withinMinutes || elapsed + service <= need.withinMinutes;
      if (!protectsOverallTime || !protectsNeedDeadline) {
        factors.push(`${need.type} could not be safely inserted — request rejected rather than shown as a fake stop`);
        continue;
      }
      elapsed += service;
      needs.push({ type: need.type, cuisine: need.cuisine, selected: null, choices: [], travelMinutes: 0, serviceMinutes: service, totalMinutes: service, withinMinutes: need.withinMinutes, deadlineProtected: true, timeFeasible: true });
      continue;
    }

    const rawChoices = await getLiveNeedChoices(zone, scenario, location, request.routeId);
    healthSignals.push(liveNeedsHealthSignal(scenario, rawChoices));
    if (rawChoices.some((choice) => choice.walkingSource !== undefined || choice.walkingLive !== undefined)) {
      healthSignals.push(walkingHealthSignal(rawChoices));
    }

    const preferenceChoices = need.type === "food" ? filterCuisine(rawChoices, need.cuisine) : rawChoices;
    const preferenceMatched = !need.cuisine || preferenceChoices.length > 0;
    const service = serviceMinutes(need.type);
    const commercialCritical = need.type === "food" || need.type === "pharmacy";
    const openChoices = preferenceChoices.filter((choice) => {
      if (choice.openStatus === "closed") return false;
      if (commercialCritical && (!choice.openStatus || choice.openStatus === "unknown")) return false;
      if (choice.openStatus === "closing_soon" && typeof choice.minutesOpenAfterArrival === "number") {
        return choice.minutesOpenAfterArrival >= service;
      }
      return true;
    });

    const feasibleChoices = openChoices.filter((choice) => {
      const arrivalAndService = elapsed + choiceTravelMinutes(choice) + service;
      const protectsOverallTime = arrivalAndService + protectedMarginMinutes <= request.availableMinutes;
      const protectsNeedDeadline = !need.withinMinutes || arrivalAndService <= need.withinMinutes;
      return protectsOverallTime && protectsNeedDeadline;
    });

    const timeFeasible = feasibleChoices.length > 0;
    if (!timeFeasible) {
      if (need.cuisine && !preferenceMatched) {
        factors.push(`${need.cuisine} cuisine unavailable — no substitute presented`);
      } else {
        factors.push(`${need.cuisine ? `${need.cuisine} ` : ""}${need.type} options are not safely verifiable within the protected constraints — request rejected, no fake stop`);
      }
      continue;
    }

    const selected = feasibleChoices[0];
    const travelMinutes = choiceTravelMinutes(selected);
    const totalMinutes = travelMinutes + service;
    elapsed += totalMinutes;

    needs.push({
      type: need.type,
      cuisine: need.cuisine,
      selected,
      choices: feasibleChoices.slice(0, need.type === "food" ? 3 : 5),
      travelMinutes,
      serviceMinutes: service,
      totalMinutes,
      withinMinutes: need.withinMinutes,
      deadlineProtected: true,
      preferenceMatched,
      timeFeasible: true,
    });

    location = { lat: selected.lat, lon: selected.lon };
    factors.push(`${need.type} inserted`, ...(need.cuisine ? [`${need.cuisine} cuisine preference matched`] : []), ...(need.withinMinutes ? [`${need.type} deadline protected`] : []));
  }

  const totalCommittedMinutes = elapsed;
  const remainingMinutes = Math.max(0, request.availableMinutes - totalCommittedMinutes);
  const ticketProtected = remainingMinutes >= protectedMarginMinutes;

  return {
    routeId: request.routeId,
    availableMinutes: request.availableMinutes,
    transportMinutes,
    protectedMarginMinutes,
    needs,
    totalCommittedMinutes,
    remainingMinutes,
    ticketProtected,
    factors,
    health: summarizeNowHealth(healthSignals),
  };
}