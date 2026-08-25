import { runGlobalNowHealth } from "../../../../lib/now-health-aggregate";

export const runtime = "nodejs";

function authorized(request: Request) {
  const expected = process.env.NOW_HEALTH_KEY?.trim();
  if (!expected) return false;
  const provided = request.headers.get("x-now-health-key")?.trim();
  return Boolean(provided && provided === expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Health endpoint unavailable" }, { status: 404 });
  }

  const health = await runGlobalNowHealth();
  return Response.json(health, {
    status: health.status === "red" ? 503 : 200,
    headers: {
      "Cache-Control": "private, no-store",
      "X-NOW-Health": health.status,
      "X-NOW-Health-Action": health.action,
    },
  });
}
