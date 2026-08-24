import { buildRoutePlan, buildIntegratedRoutePlan, isNowScenario, type RoutePlan } from "../../../../lib/now-engine";
import { getConfidentialRoutes } from "../../../../lib/confidential-routes";
import { getPassAccess } from "../../../../lib/pass-access";
import { getLiveNeedChoices, type LiveNeedScenario, type LiveNeedChoice } from "../../../../lib/live-needs";

export const runtime = "nodejs";

type TransportConnection = {
  minutes: number;
  mode: string;
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

function integrateTransport(plan: RoutePlan, connection: TransportConnection, availableMinutes: number): RoutePlan {
  const connectionMinutes = Math.max(1, Math.min(120, Math.round(connection.minutes)));
  const remaining = Math.max(15, availableMinutes - connectionMinutes);
  const marginMinutes = Math.max(0, plan.ticket.marginMinutes - connectionMinutes);
  const protectedTicket = marginMinutes >= 15;
  const shiftedStops = plan.stops.map((stop, index) => ({
    ...stop,
    time: stop.time === "NOW" ? `+${String(connectionMinutes).padStart(2, "0")}` : stop.time,
    state: index === 0 ? "next" as const : stop.state,
  }));

  return {
    ...plan,
    eyebrow: `NOW CONNECTION · ${connection.label.toUpperCase()}`,
    title: `From ${connection.origin} into ${plan.title}`,
    meta: `${connectionMinutes} min connection · ${remaining} min route budget · ${protectedTicket ? "protected arrival" : "route must be shortened"}`,
    note: `${connection.source === "official" ? "Official Île-de-France Mobilités connection" : "Estimated local connection"} is now part of the route calculation. Optional route time is reduced before the protected ticket margin is sacrificed.`,
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
      factors: [...plan.calculation.factors, "real starting point", "transport duration", "route time remaining", "ticket margin after connection"],
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
  exactLocation?: { lat: number; lon: number },
  requestedChoice?: Record<string, unknown> | null,
) {
  const choices = await getLiveNeedChoices(zone, scenario, exactLocation, routeId);
  if (choices.length === 0) return { plan, choices: [], selected: null as LiveNeedChoice | null, manuallySelected: false };

  const requestedMatch = requestedChoice ? choices.find((choice) => sameChoice(choice, requestedChoice)) ?? null : null;
  const primary = requestedMatch ?? choices[0];
  const manuallySelected = Boolean(requestedMatch);
  const alternatives = choices.filter((choice) => choice !== primary).slice(0, 2).map((choice) => choice.name);
  const alternativeSelected = manuallySelected ? false : betterAlternativeSelected(primary, choices);
  const targetIndex = selectedRoute && plan.stops.length > 1 ? 1 : Math.max(0, plan.stops.findIndex((stop) => stop.state === "current"));
  const status = statusLine(primary);
  const updatedStops = plan.stops.map((stop, index) => index === targetIndex ? {
    ...stop,
    title: primary.name,
    detail: `${status}${manuallySelected ? " · YOUR SELECTION" : alternativeSelected ? " · BETTER ALTERNATIVE SELECTED" : ""} · ${primary.detail} · source: ${primary.source}${alternatives.length ? ` · alternatives: ${alternatives.join(" / ")}` : ""}`,
    state: primary.openStatus === "closing_soon" || primary.openStatus === "closed" ? "warning" as const : stop.state,
  } : stop);

  return {
    plan: {
      ...plan,
      note: `${plan.note} ${manuallySelected ? `You selected ${primary.name}; NOW recalculated the route around that choice.` : alternativeSelected ? "NOW avoided a less suitable timing option and selected the stronger available alternative." : `NOW selected ${primary.name} from the internal-first nearby catalog.`} Alternatives remain available so it can switch without another broad search.`,
      stops: updatedStops,
      calculation: {
        ...plan.calculation,
        generatedAt: new Date().toISOString(),
        factors: [...plan.calculation.factors, "internal POI catalog", "cached provider fallback", "distance from active Paris route", "open-now status", "contextual closing margin", ...(manuallySelected ? ["traveler-selected POI"] : [])],
      },
    },
    choices,
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
  if (!isNowScenario(input.scenario)) return Response.json({ error: "Unknown NOW scenario" }, { status: 400 });

  const ticketTime = typeof input.ticketTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.ticketTime) ? input.ticketTime : "16:30";
  const availableMinutes = typeof input.availableMinutes === "number" && Number.isFinite(input.availableMinutes)
    ? Math.max(15, Math.min(480, input.availableMinutes))
    : 90;

  const rawConnection = input.transport && typeof input.transport === "object" ? input.transport as Record<string, unknown> : null;
  const transport = rawConnection && typeof rawConnection.minutes === "number" && Number.isFinite(rawConnection.minutes)
    && typeof rawConnection.origin === "string" && typeof rawConnection.label === "string"
    ? {
        minutes: rawConnection.minutes,
        mode: typeof rawConnection.mode === "string" ? rawConnection.mode : "transport",
        label: rawConnection.label,
        origin: rawConnection.origin.slice(0, 180),
        detail: typeof rawConnection.detail === "string" ? rawConnection.detail.slice(0, 240) : undefined,
        source: rawConnection.source === "official" ? "official" as const : "estimated" as const,
      }
    : null;

  const routeBudget = transport ? Math.max(15, availableMinutes - Math.max(1, Math.round(transport.minutes))) : availableMinutes;
  const routeId = typeof input.routeId === "string" ? input.routeId : null;
  const confidential = routeId ? getConfidentialRoutes().find((route) => route.id === routeId) : undefined;
  const selectedRoute = routeId
    ? buildIntegratedRoutePlan(routeId, input.scenario, ticketTime, routeBudget, typeof input.blockedStop === "string" ? input.blockedStop : undefined)
    : null;
  let plan = selectedRoute ?? buildRoutePlan(input.scenario, ticketTime);
  let liveNeedChoices: Awaited<ReturnType<typeof getLiveNeedChoices>> = [];
  let selectedLiveChoice: LiveNeedChoice | null = null;
  let manuallySelected = false;

  if (LIVE_NEEDS.has(input.scenario as LiveNeedScenario)) {
    const requestedChoice = input.selectedPoi && typeof input.selectedPoi === "object" ? input.selectedPoi as Record<string, unknown> : null;
    const live = await enrichLiveNeed(
      plan,
      input.scenario as LiveNeedScenario,
      confidential?.zone ?? "Louvre & Opéra",
      routeId,
      Boolean(selectedRoute),
      locationFromInput(input.location),
      requestedChoice,
    );
    plan = live.plan;
    liveNeedChoices = live.choices;
    selectedLiveChoice = live.selected;
    manuallySelected = live.manuallySelected;
  }

  if (transport) plan = integrateTransport(plan, transport, availableMinutes);

  return Response.json({
    ...plan,
    liveNeed: liveNeedChoices.length && selectedLiveChoice ? {
      scenario: input.scenario,
      choices: liveNeedChoices,
      selected: selectedLiveChoice,
      selectedStatus: statusLine(selectedLiveChoice),
      manuallySelected,
      betterAlternativeSelected: manuallySelected ? false : betterAlternativeSelected(selectedLiveChoice, liveNeedChoices),
      cacheStrategy: "internal catalog first; address geocode cached 7 days; external POI zone cache 30 minutes; provider fallback only when needed",
    } : null,
  }, {
    headers: {
      "Cache-Control": "no-store",
      "X-NOW-Data-Mode": liveNeedChoices.length ? "internal-first-nearby" : transport ? "transport-integrated" : "prepared",
    },
  });
}
