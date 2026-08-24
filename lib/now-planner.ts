import { getConfidentialRoutes } from "./confidential-routes";
import { getLiveNeedChoices, type LiveNeedChoice, type LiveNeedScenario } from "./live-needs";
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

export async function planComposableRequest(request: NowComposableRequest): Promise<ConstraintPlan> {
  const zone = routeZone(request.routeId);
  let location = request.location;
  const transportMinutes = request.transport?.minutes ?? 0;
  const protectedMarginMinutes = request.ticket?.protectedMarginMinutes ?? 15;
  let elapsed = transportMinutes;
  const needs: PlannedNeed[] = [];
  const factors = ["available time", "protected ticket margin"];
  if (transportMinutes) factors.push("transport connection");

  for (const need of request.needs) {
    const scenario = liveScenario(need.type);
    if (!scenario) {
      const service = serviceMinutes(need.type);
      elapsed += service;
      needs.push({ type: need.type, cuisine: need.cuisine, selected: null, choices: [], travelMinutes: 0, serviceMinutes: service, totalMinutes: service, withinMinutes: need.withinMinutes, deadlineProtected: !need.withinMinutes || elapsed <= need.withinMinutes });
      continue;
    }

    const rawChoices = await getLiveNeedChoices(zone, scenario, location, request.routeId);
    const choices = need.type === "food" ? filterCuisine(rawChoices, need.cuisine) : rawChoices;
    const preferenceMatched = !need.cuisine || choices.length > 0;
    const usable = choices.filter((choice) => choice.openStatus !== "closed");
    const selected = usable[0] ?? choices[0] ?? null;
    const travelMinutes = selected?.travelMinutes ?? (selected ? Math.max(1, Math.ceil(selected.distanceMeters / 75)) : 0);
    const service = selected || need.type !== "food" ? serviceMinutes(need.type) : 0;
    const totalMinutes = travelMinutes + service;
    elapsed += totalMinutes;
    const deadlineProtected = !need.withinMinutes || elapsed <= need.withinMinutes;

    needs.push({
      type: need.type,
      cuisine: need.cuisine,
      selected,
      choices: choices.slice(0, need.type === "food" ? 3 : 5),
      travelMinutes,
      serviceMinutes: service,
      totalMinutes,
      withinMinutes: need.withinMinutes,
      deadlineProtected,
      preferenceMatched,
    });

    if (selected) location = { lat: selected.lat, lon: selected.lon };
    if (need.cuisine && !preferenceMatched) {
      factors.push(`${need.cuisine} cuisine unavailable — no substitute presented`);
    } else {
      factors.push(`${need.type} inserted`, ...(need.cuisine ? [`${need.cuisine} cuisine preference matched`] : []));
    }
  }

  const totalCommittedMinutes = elapsed;
  const remainingMinutes = Math.max(0, request.availableMinutes - totalCommittedMinutes);
  const ticketProtected = remainingMinutes >= protectedMarginMinutes && needs.every((need) => need.deadlineProtected);

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
  };
}
