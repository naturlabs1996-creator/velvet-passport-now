import { buildRoutePlan, buildIntegratedRoutePlan, isNowScenario, type RoutePlan } from "../../../../lib/now-engine";
import { getConfidentialRoutes } from "../../../../lib/confidential-routes";
import { getPassAccess } from "../../../../lib/pass-access";

export const runtime = "nodejs";

type TransportConnection = {
  minutes: number;
  mode: string;
  label: string;
  origin: string;
  detail?: string;
  source?: "official" | "estimated";
};

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

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Request body is required" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  if (!isNowScenario(input.scenario)) {
    return Response.json({ error: "Unknown NOW scenario" }, { status: 400 });
  }

  const ticketTime = typeof input.ticketTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.ticketTime)
    ? input.ticketTime
    : "16:30";

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
  const selectedRoute = typeof input.routeId === "string"
    ? buildIntegratedRoutePlan(input.routeId, input.scenario, ticketTime, routeBudget, typeof input.blockedStop === "string" ? input.blockedStop : undefined)
    : null;
  const basePlan = selectedRoute ?? buildRoutePlan(input.scenario, ticketTime);
  const plan = transport ? integrateTransport(basePlan, transport, availableMinutes) : basePlan;

  return Response.json(plan, {
    headers: {
      "Cache-Control": "no-store",
      "X-NOW-Data-Mode": transport ? "transport-integrated" : "prepared",
    },
  });
}
