import { buildRoutePlan, isNowScenario } from "../../../../lib/now-engine";

export async function POST(request: Request) {
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

  return Response.json(buildRoutePlan(input.scenario, ticketTime), {
    headers: {
      "Cache-Control": "no-store",
      "X-NOW-Data-Mode": "prepared",
    },
  });
}
