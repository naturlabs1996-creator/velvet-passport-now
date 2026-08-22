import { buildRoutePlan, buildConfidentialRoutePlan, isNowScenario } from "../../../../lib/now-engine";
import { getConfidentialRoutes } from "../../../../lib/confidential-routes";
import { getPassAccess } from "../../../../lib/pass-access";

export const runtime = "nodejs";

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

  const availableMinutes = typeof input.availableMinutes === "number" && Number.isFinite(input.availableMinutes) ? input.availableMinutes : 90;
  const selectedRoute = typeof input.routeId === "string" && (input.scenario === "route" || input.scenario === "blocked" || input.scenario === "rain")
    ? buildConfidentialRoutePlan(input.routeId, ticketTime, input.scenario === "blocked" ? typeof input.blockedStop === "string" ? input.blockedStop : "__next__" : undefined, availableMinutes, input.scenario === "rain" ? "rain" : undefined)
    : null;
  return Response.json(selectedRoute ?? buildRoutePlan(input.scenario, ticketTime), {
    headers: {
      "Cache-Control": "no-store",
      "X-NOW-Data-Mode": "prepared",
    },
  });
}
