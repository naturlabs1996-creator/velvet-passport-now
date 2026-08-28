import { getPassAccess } from "../../../../../lib/pass-access";
import { MONTREAL_PILOT_ROUTES, getMontrealPilotRoute } from "../../../../../lib/montreal-pilot-routes";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await getPassAccess();
  if (!access.allowed) {
    return Response.json({ error: "A valid NOW Pass is required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();

  if (id) {
    const route = getMontrealPilotRoute(id);
    if (!route) return Response.json({ error: "Pilot route not found" }, { status: 404 });
    return Response.json({ city: "montreal", pilot: true, route }, { headers: { "Cache-Control": "private, no-store" } });
  }

  return Response.json({
    city: "montreal",
    pilot: true,
    count: MONTREAL_PILOT_ROUTES.length,
    routes: MONTREAL_PILOT_ROUTES,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
