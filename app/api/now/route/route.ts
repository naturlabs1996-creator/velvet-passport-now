import { buildRoutePlan, buildIntegratedRoutePlan, isNowScenario, type RoutePlan } from "../../../../lib/now-engine";
import { getConfidentialRoutes } from "../../../../lib/confidential-routes";
import { getPassAccess } from "../../../../lib/pass-access";
import { getLiveNeedChoices, type LiveNeedScenario, type LiveNeedChoice } from "../../../../lib/live-needs";
import { getRouteDisruptions, type RouteDisruption } from "../../../../lib/disruptions";
import { normalizeNowRequest } from "../../../../lib/now-request";
import { planComposableRequest, type ConstraintPlan } from "../../../../lib/now-planner";

export const runtime = "nodejs";

type TransportConnection = {
  minutes: number;
  mode?: string;
  label: string;
  origin: string;
  detail?: string;
  source?: "official" | "estimated";
};

const LIVE_NEEDS = new Set<LiveNeedScenario>(["food", "pharmacy", "water", "restroom", "sitdown"]);

function formatRemaining(minutes?: number) {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) return "";
  if (minutes < 60) return `${Math.round(minutes)} MIN LEFT`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest ? `${hours}H ${rest} MIN LEFT` : `${hours}H LEFT`;
}

function statusLine(choice: LiveNeedChoice) {
  const remaining = formatRemaining(choice.closesInMinutes);
  if (choice.openStatus === "open") return `OPEN NOW${remaining ? ` · ${remaining}` : ""}`;
  if (choice.openStatus === "closing_soon") return `CLOSING SOON${remaining ? ` · ${remaining}` : ""}`;
  if (choice.openStatus === "closed") return "CLOSED NOW";
  return "HOURS NOT CONFIRMED";
}

function betterAlternativeSelected(primary: LiveNeedChoice, choices: LiveNeedChoice[]) {
  if (primary.source !== "Velvet Passport internal catalog") return true;
  return choices.slice(1).some((choice) => choice.openStatus === "closing_soon" || choice.openStatus === "closed");
}

function sameChoice(a: LiveNeedChoice, requested: Record<string, unknown>) {
  const requestedName = typeof requested.name === "string" ? requested.name.trim().toLocaleLowerCase("fr-FR") : "";
  const requestedLat = Number(requested.lat);
  const requestedLon = Number(requested.lon);
  const sameName = requestedName && a.name.trim().toLocaleLowerCase("fr-FR") === requestedName;
  const closeCoordinates = Number.isFinite(requestedLat) && Number.isFinite(requestedLon)
    && Math.abs(a.lat - requestedLat) < 0.00025
    && Math.abs(a.lon - requestedLon) < 0.00035;
  return Boolean(sameName && closeCoordinates);
}

function durationMinutes(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function walkingMinutes(distanceMeters: number) {
  return Math.max(2, Math.ceil(Math.max(0, distanceMeters) / 78));
}

function effectiveWalkingMinutes(choice: LiveNeedChoice) {
  return choice.travelMinutes ?? walkingMinutes(choice.distanceMeters);
}

function serviceMinutes(scenario: LiveNeedScenario) {
  if (scenario === "food") return 45;
  if (scenario === "pharmacy") return 10;
  return 8;
}

function serviceLabel(scenario: LiveNeedScenario) {
  if (scenario === "food") return "meal window";
  if (scenario === "pharmacy") return "pharmacy stop";
  if (scenario === "water") return "water stop";
  if (scenario === "restroom") return "restroom stop";
  return "quiet pause";
}

function retimeStops(stops: RoutePlan["stops"]) {
  let elapsed = 0;
  return stops.map((stop, index) => {
    if (index === 0) {
      elapsed += durationMinutes(stop.duration);
      return { ...stop, time: "NOW", state: "current" as const };
    }
    const timed = {
      ...stop,
      time: `+${String(elapsed).padStart(2, "0")}`,
      state: index === stops.length - 1 ? "destination" as const : stop.state === "warning" ? "warning" as const : "next" as const,
    };
    elapsed += durationMinutes(stop.duration);
    return timed;
  });
}

function recalculatePoiTiming(
  plan: RoutePlan,
  primary: LiveNeedChoice,
  scenario: LiveNeedScenario,
  targetIndex: number,
  availableMinutes: number,
) {
  if (!["food", "pharmacy", "water", "restroom", "sitdown"].includes(scenario)) return plan;

  const walk = effectiveWalkingMinutes(primary);
  const service = serviceMinutes(scenario);
  const actualPoiMinutes = walk + service;
  const originalTargetMinutes = durationMinutes(plan.stops[targetIndex]?.duration ?? "0");
  const baseTotal = Number.parseInt(plan.meta, 10) || plan.stops.reduce((sum, stop) => sum + durationMinutes(stop.duration), 0);
  let projectedTotal = Math.max(actualPoiMinutes + 1, baseTotal - originalTargetMinutes + actualPoiMinutes);

  let stops = plan.stops.map((stop, index) => index === targetIndex ? {
    ...stop,
    duration: `${actualPoiMinutes} min`,
    detail: `${stop.detail} · ${walk} min ${primary.walkingSource === "valhalla" ? "street-routed walk" : "walk estimate"} · ${service} min ${serviceLabel(scenario)}`,
  } : stop);

  const removed: string[] = [];
  const protectedBudget = Math.max(15, availableMinutes - 15);
  while (projectedTotal > protectedBudget && stops.length > 3) {
    const removableIndex = stops.length - 2;
    if (removableIndex <= targetIndex) break;
    const [removedStop] = stops.splice(removableIndex, 1);
    projectedTotal = Math.max(actualPoiMinutes + 1, projectedTotal - durationMinutes(removedStop.duration));
    removed.push(removedStop.title);
  }

  const totalMinutes = Math.max(1, projectedTotal);
  const marginMinutes = Math.max(0, availableMinutes - totalMinutes);
  const protectedTicket = marginMinutes >= 15;
  stops = retimeStops(stops);

  return {
    ...plan,
    meta: `${totalMinutes} min · ${walk} min walk · ${service} min stop · ${marginMinutes} min ticket margin`,
    note: `${plan.note}${removed.length ? ` NOW removed ${removed.join(" and ")} before allowing the ticket margin to fall below 15 minutes.` : ""}`,
    stops,
    ticket: { ...plan.ticket, marginMinutes, protected: protectedTicket },
    calculation: {
      ...plan.calculation,
      generatedAt: new Date().toISOString(),
      factors: [...plan.calculation.factors, primary.walkingSource === "valhalla" ? "street-routed pedestrian ETA" : "fallback walking ETA", "on-site duration", "stop order recalculation", "ticket margin recalculation", ...(removed.length ? ["optional stop removal"] : [])],
    },
  };
}

function applyConstraintPlan(plan: RoutePlan, constraints: ConstraintPlan, routeBudget: number): RoutePlan {
  if (!constraints.needs.length) return plan;

  const needMinutes = constraints.needs.reduce((sum, need) => sum + need.totalMinutes, 0);
  let stops = [...plan.stops];
  let baseMinutes = Number.parseInt(plan.meta, 10) || stops.reduce((sum, stop) => sum + durationMinutes(stop.duration), 0);
  const protectedBudget = Math.max(0, routeBudget - constraints.protectedMarginMinutes);
  const removed: string[] = [];

  while (baseMinutes + needMinutes > protectedBudget && stops.length > 2) {
    const removableIndex = stops.length - 2;
    const [removedStop] = stops.splice(removableIndex, 1);
    baseMinutes = Math.max(0, baseMinutes - durationMinutes(removedStop.duration));
    removed.push(removedStop.title);
  }

  const needStops: RoutePlan["stops"] = constraints.needs.map((need) => ({
    time: "+00",
    duration: `${Math.max(1, need.totalMinutes)} min`,
    title: need.selected?.name ?? need.type.replace(/(^|_)(\w)/g, (_match, _space, letter: string) => letter.toUpperCase()),
    detail: [
      need.selected?.detail,
      need.cuisine ? `${need.cuisine} preference` : undefined,
      `${need.travelMinutes} min travel`,
      `${need.serviceMinutes} min stop`,
      need.withinMinutes ? `${need.deadlineProtected ? "deadline protected" : "deadline at risk"} · within ${need.withinMinutes} min` : undefined,
    ].filter(Boolean).join(" · "),
    state: need.deadlineProtected ? "next" as const : "warning" as const,
  }));

  const first = stops[0];
  const rest = stops.slice(1);
  stops = retimeStops([first, ...needStops, ...rest]);

  const totalMinutes = baseMinutes + needMinutes;
  const marginMinutes = Math.max(0, routeBudget - totalMinutes);
  const protectedTicket = marginMinutes >= constraints.protectedMarginMinutes && constraints.needs.every((need) => need.deadlineProtected);

  return {
    ...plan,
    meta: `${totalMinutes} min · ${constraints.needs.length} live need${constraints.needs.length === 1 ? "" : "s"} · ${marginMinutes} min ticket margin`,
    note: `${plan.note} NOW composed ${constraints.needs.length} live constraint${constraints.needs.length === 1 ? "" : "s"} into one route.${removed.length ? ` Optional stops removed first: ${removed.join(" / ")}.` : ""}`,
    stops,
    ticket: { ...plan.ticket, marginMinutes, protected: protectedTicket },
    calculation: {
      ...plan.calculation,
      generatedAt: new Date().toISOString(),
      factors: [...plan.calculation.factors, ...constraints.factors, "composable constraints", "optional-stop removal before ticket margin"],
    },
  };
}

function shiftRelativeStopTime(time: string, offsetMinutes: number) {
  if (time === "NOW") return `+${String(offsetMinutes).padStart(2, "0")}`;
  const match = time.trim().match(/^\+(\d+)(?:\s*min)?$/i);
  if (!match) return time;
  return `+${String(Number(match[1]) + offsetMinutes).padStart(2, "0")}`;
}

function integrateTransport(plan: RoutePlan, connection: TransportConnection, routeBudget: number): RoutePlan {
  const connectionMinutes = Math.max(1, Math.min(120, Math.round(connection.minutes)));
  const marginMinutes = plan.ticket.marginMinutes;
  const protectedTicket = plan.ticket.protected;
  const shiftedStops = plan.stops.map((stop, index) => ({
    ...stop,
    time: shiftRelativeStopTime(stop.time, connectionMinutes),
    state: index === 0 ? "next" as const : stop.state,
  }));

  return {
    ...plan,
    eyebrow: `NOW CONNECTION · ${connection.label.toUpperCase()}`,
    title: `From ${connection.origin} into ${plan.title}`,
    meta: `${connectionMinutes} min connection · ${routeBudget} min route budget · ${marginMinutes} min ticket margin · ${protectedTicket ? "protected arrival" : "route must be shortened"}`,
    note: `${connection.source === "official" ? "Official Île-de-France Mobilités connection" : "Estimated local connection"} is part of the route calculation. The connection is charged once; the already-reduced route budget is not debited a second time.`,
    stops: [
      {
        time: "NOW",
        duration: `${connectionMinutes} min`,
        title: connection.origin,
        detail: `${connection.label} · ${connection.detail || "connection to selected route"}`,
        state: "current" as const,
      },
      ...shiftedStops,
    ],
    ticket: { ...plan.ticket, marginMinutes, protected: protectedTicket },
    calculation: {
      ...plan.calculation,
      generatedAt: new Date().toISOString(),
      factors: [...plan.calculation.factors, "real starting point", "transport duration charged once", "route time remaining", "ticket margin after connection", "chronological stop retiming"],
    },
  };
}

function locationFromInput(value: unknown): { lat: number; lon: number } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const lat = Number(raw.lat);
  const lon = Number(raw.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  if (lat < 48.80 || lat > 48.92 || lon < 2.20 || lon > 2.50) return undefined;
  return { lat, lon };
}

async function enrichLiveNeed(
  plan: RoutePlan,
  scenario: LiveNeedScenario,
  zone: string,
  routeId: string | null,
  selectedRoute: boolean,
  availableMinutes: number,
  exactLocation?: { lat: number; lon: number },
  requestedChoice?: Record<string, unknown> | null,
) {
  const rawChoices = await getLiveNeedChoices(zone, scenario, exactLocation, routeId);
  const service = serviceMinutes(scenario);
  const commercialCritical = scenario === "food" || scenario === "pharmacy";
  const safeRawChoices = rawChoices.filter((choice) => {
    if (choice.openStatus === "closed") return false;
    if (commercialCritical && (!choice.openStatus || choice.openStatus === "unknown")) return false;
    if (choice.openStatus === "closing_soon" && typeof choice.minutesOpenAfterArrival === "number") {
      return choice.minutesOpenAfterArrival >= service;
    }
    return true;
  });
  if (safeRawChoices.length === 0) {
    return {
      plan: {
        ...plan,
        note: `${plan.note} NOW found no live ${scenario} option that can be safely verified right now, so the current route remains unchanged.`,
        calculation: {
          ...plan.calculation,
          generatedAt: new Date().toISOString(),
          factors: [...plan.calculation.factors, "live-need safety filter", "closed venue rejection", "unconfirmed commercial hours rejection", "closing-before-completion rejection"],
        },
      },
      choices: [],
      selected: null as LiveNeedChoice | null,
      manuallySelected: false,
    };
  }

  const targetIndex = selectedRoute && plan.stops.length > 1 ? 1 : Math.max(0, plan.stops.findIndex((stop) => stop.state === "current"));
  const timingProtectedScenario = scenario === "food" || scenario === "sitdown";
  const choices = timingProtectedScenario
    ? safeRawChoices.filter((choice) => recalculatePoiTiming(plan, choice, scenario, targetIndex, availableMinutes).ticket.protected)
    : safeRawChoices;

  if (choices.length === 0) {
    const label = scenario === "sitdown" ? "quiet stop" : scenario;
    return {
      plan: {
        ...plan,
        note: `${plan.note} NOW found ${label} options nearby, but none can be inserted safely without reducing the protected ticket margin below 15 minutes. The current route remains unchanged.`,
        calculation: {
          ...plan.calculation,
          generatedAt: new Date().toISOString(),
          factors: [...plan.calculation.factors, `${label} prevalidation`, "ticket-safe live-need filtering", "no unsafe substitution"],
        },
      },
      choices: [],
      selected: null as LiveNeedChoice | null,
      manuallySelected: false,
    };
  }

  const requestedMatch = requestedChoice ? choices.find((choice) => sameChoice(choice, requestedChoice)) ?? null : null;
  const primary = requestedMatch ?? choices[0];
  const manuallySelected = Boolean(requestedMatch);
  const alternatives = choices.filter((choice) => choice !== primary).slice(0, 2).map((choice) => choice.name);
  const alternativeSelected = manuallySelected ? false : betterAlternativeSelected(primary, choices);
  const status = statusLine(primary);
  const updatedStops = plan.stops.map((stop, index) => index === targetIndex ? {
    ...stop,
    title: primary.name,
    detail: `${status}${manuallySelected ? " · YOUR SELECTION" : alternativeSelected ? " · BETTER ALTERNATIVE SELECTED" : ""} · ${primary.detail} · source: ${primary.source}${alternatives.length ? ` · alternatives: ${alternatives.join(" / ")}` : ""}`,
    state: primary.openStatus === "closing_soon" || primary.openStatus === "closed" ? "warning" as const : stop.state,
  } : stop);

  const selectedPlan = recalculatePoiTiming({ ...plan, stops: updatedStops }, primary, scenario, targetIndex, availableMinutes);

  return {
    plan: {
      ...selectedPlan,
      note: `${selectedPlan.note} ${scenario === "food" ? `NOW prevalidated ${choices.length} ticket-safe restaurant option${choices.length === 1 ? "" : "s"}. ` : scenario === "sitdown" ? `NOW prevalidated ${choices.length} quiet stop${choices.length === 1 ? "" : "s"} against your reservation margin. ` : ""}${manuallySelected ? `You selected ${primary.name}; NOW rebuilt timing, stop order and ticket margin around that choice.` : alternativeSelected ? "NOW avoided a less suitable timing option and selected the stronger available alternative." : `NOW selected ${primary.name} from the internal-first nearby catalog.`} Alternatives remain available so it can switch without another broad search.`,
      calculation: {
        ...selectedPlan.calculation,
        generatedAt: new Date().toISOString(),
        factors: [...selectedPlan.calculation.factors, "internal POI catalog", "cached provider fallback", "distance from active Paris route", "open-now status", "contextual closing margin", ...(scenario === "food" ? ["legacy food prevalidation", "ticket-safe restaurant filtering"] : []), ...(scenario === "sitdown" ? ["quiet-stop prevalidation", "reservation-safe pause filtering"] : []), ...(manuallySelected ? ["traveler-selected POI"] : [])],
      },
    },
    choices: timingProtectedScenario ? choices.slice(0, 3) : choices,
    selected: primary,
    manuallySelected,
  };
}

export async function GET(request: Request) {
  const access = await getPassAccess();
  if (!access.allowed) return Response.json({ error: "A valid Paris NOW Pass is required" }, { status: 401 });
  const zone = new URL(request.url).searchParams.get("zone") ?? undefined;
  return Response.json({ routes: getConfidentialRoutes(zone).map(({ id, zone, title, durationMinutes, stops, ticketProtection }) => ({ id, zone, title, durationMinutes, stopCount: stops.length, ticketProtection })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const access = await getPassAccess();
  if (!access.allowed) return Response.json({ error: "A valid Paris NOW Pass is required" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "Request body is required" }, { status: 400 });

  const input = body as Record<string, unknown>;
  const hasComposableNeeds = Array.isArray(input.needs) && input.needs.length > 0;
  const legacyScenario = isNowScenario(input.scenario) ? input.scenario : hasComposableNeeds ? "route" : null;
  if (!legacyScenario) return Response.json({ error: "Unknown NOW scenario" }, { status: 400 });

  const normalized = normalizeNowRequest(input, legacyScenario);
  const availableMinutes = normalized.availableMinutes;
  const ticketTime = normalized.ticket?.time && /^([01]\d|2[0-3]):[0-5]\d$/.test(normalized.ticket.time) ? normalized.ticket.time : "16:30";
  const transport = normalized.transport ?? null;
  const remainingAfterTransport = transport ? availableMinutes - transport.minutes : availableMinutes;
  if (transport && remainingAfterTransport < 20) {
    return Response.json({
      error: "The connection consumes too much of the available time to build a safe Paris NOW route.",
      code: "INSUFFICIENT_TIME_AFTER_TRANSPORT",
      availableMinutes,
      transportMinutes: transport.minutes,
      remainingMinutes: Math.max(0, remainingAfterTransport),
    }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
  const routeBudget = remainingAfterTransport;
  const routeId = normalized.routeId ?? null;
  const confidential = routeId ? getConfidentialRoutes().find((route) => route.id === routeId) : undefined;
  const exactLocation = normalized.location ?? locationFromInput(input.location);

  let routeDisruptions: RouteDisruption[] = [];
  let disruptionDegraded = false;
  let autoBlockedStop: string | null = null;

  if (confidential && normalized.disruptions?.automatic !== false) {
    const disruptionCheck = await getRouteDisruptions(confidential.stops.map((stop) => stop.name), exactLocation);
    routeDisruptions = disruptionCheck.disruptions;
    disruptionDegraded = disruptionCheck.degraded;
    autoBlockedStop = disruptionCheck.blockedStop;
  }

  const explicitBlockedStop = normalized.disruptions?.blockedStop;
  const blockedStopForRoute = explicitBlockedStop ?? autoBlockedStop ?? undefined;
  const autoBlocked = Boolean(autoBlockedStop);
  const requestedWeather = normalized.weather?.scenario;
  const weatherScenario = requestedWeather === "rain" ? "rain" : legacyScenario;
  const routeScenario = weatherScenario === "rain"
    ? "rain"
    : blockedStopForRoute && (weatherScenario === "route" || weatherScenario === "blocked")
      ? "blocked"
      : weatherScenario;

  const selectedRoute = routeId
    ? buildIntegratedRoutePlan(routeId, routeScenario, ticketTime, routeBudget, blockedStopForRoute)
    : null;
  let plan = selectedRoute ?? buildRoutePlan(routeScenario, ticketTime);

  if (autoBlocked && routeDisruptions[0]) {
    const issue = routeDisruptions.find((item) => item.severity === "blocked") ?? routeDisruptions[0];
    plan = {
      ...plan,
      note: `${plan.note} NOW detected ${issue.label} on the active route from ${issue.source} and rebuilt the affected segment automatically.`,
      calculation: {
        ...plan.calculation,
        generatedAt: new Date().toISOString(),
        factors: [...plan.calculation.factors, "official disruption feed", "route corridor collision", "automatic blocked-stop substitution"],
      },
    };
  }

  let composablePlan: ConstraintPlan | null = null;
  let liveNeedChoices: Awaited<ReturnType<typeof getLiveNeedChoices>> = [];
  let selectedLiveChoice: LiveNeedChoice | null = null;
  let manuallySelected = false;

  if (hasComposableNeeds) {
    composablePlan = await planComposableRequest(normalized);
    plan = applyConstraintPlan(plan, composablePlan, routeBudget);
  } else if (LIVE_NEEDS.has(legacyScenario as LiveNeedScenario)) {
    const requestedChoice = input.selectedPoi && typeof input.selectedPoi === "object" ? input.selectedPoi as Record<string, unknown> : null;
    const live = await enrichLiveNeed(
      plan,
      legacyScenario as LiveNeedScenario,
      confidential?.zone ?? "Louvre & Opéra",
      routeId,
      Boolean(selectedRoute),
      routeBudget,
      exactLocation,
      requestedChoice,
    );
    plan = live.plan;
    liveNeedChoices = live.choices;
    selectedLiveChoice = live.selected;
    manuallySelected = live.manuallySelected;
  }

  if (transport) plan = integrateTransport(plan, transport, routeBudget);

  return Response.json({
    ...plan,
    composable: composablePlan ? {
      enabled: true,
      availableMinutes: composablePlan.availableMinutes,
      transportMinutes: composablePlan.transportMinutes,
      protectedMarginMinutes: composablePlan.protectedMarginMinutes,
      totalCommittedMinutes: composablePlan.totalCommittedMinutes,
      remainingMinutes: composablePlan.remainingMinutes,
      ticketProtected: plan.ticket.protected,
      needs: composablePlan.needs,
      factors: composablePlan.factors,
    } : null,
    disruptionProtection: routeId ? {
      checked: normalized.disruptions?.automatic !== false,
      degraded: disruptionDegraded,
      rerouted: autoBlocked,
      blockedStop: autoBlockedStop,
      issues: routeDisruptions.map((item) => ({
        id: item.id,
        kind: item.kind,
        label: item.label,
        severity: item.severity,
        distanceMeters: item.distanceMeters,
        source: item.source,
      })),
    } : null,
    liveNeed: liveNeedChoices.length && selectedLiveChoice ? {
      scenario: legacyScenario,
      choices: liveNeedChoices,
      selected: selectedLiveChoice,
      selectedStatus: statusLine(selectedLiveChoice),
      manuallySelected,
      eta: {
        walkingMinutes: effectiveWalkingMinutes(selectedLiveChoice),
        walkingDistanceMeters: selectedLiveChoice.distanceMeters,
        walkingSource: selectedLiveChoice.walkingSource ?? "estimated",
        walkingLive: Boolean(selectedLiveChoice.walkingLive),
        walkingCacheHit: Boolean(selectedLiveChoice.walkingCacheHit),
        serviceMinutes: serviceMinutes(legacyScenario as LiveNeedScenario),
        totalMinutes: effectiveWalkingMinutes(selectedLiveChoice) + serviceMinutes(legacyScenario as LiveNeedScenario),
      },
      betterAlternativeSelected: manuallySelected ? false : betterAlternativeSelected(selectedLiveChoice, liveNeedChoices),
      cacheStrategy: "internal catalog first; address geocode cached 7 days; external POI zone cache 30 minutes; pedestrian route matrix cached 30 minutes; provider fallback only when needed",
    } : null,
  }, {
    headers: {
      "Cache-Control": "no-store",
      "X-NOW-Data-Mode": composablePlan ? "composable" : liveNeedChoices.length ? "internal-first-nearby" : transport ? "transport-integrated" : "prepared",
    },
  });
}