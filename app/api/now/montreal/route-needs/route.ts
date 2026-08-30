import { getPassAccess } from "../../../../../lib/pass-access";
import { getMontrealPilotRoute } from "../../../../../lib/montreal-pilot-routes";
import { getMontrealRouteNeeds } from "../../../../../lib/montreal-route-needs";
import { getMontrealPassContext, parseMontrealTravelerPasses } from "../../../../../lib/montreal-external-passes";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await getPassAccess();
  if (!access.allowed) {
    return Response.json({ error: "A valid NOW Pass is required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const routeId = url.searchParams.get("routeId")?.trim() || "";
  const radius = Number(url.searchParams.get("radiusMeters") || 700);
  const route = getMontrealPilotRoute(routeId);
  if (!route) return Response.json({ error: "Pilot route not found" }, { status: 404 });

  const travelerPasses = parseMontrealTravelerPasses(url.searchParams.get("travelerPasses"));
  const needs = await getMontrealRouteNeeds(route, radius);
  const externalPasses = getMontrealPassContext(route.id, travelerPasses.recognized);

  return Response.json({
    city: "montreal",
    route: {
      id: route.id,
      zone: route.zone,
      titleFr: route.titleFr,
      titleEn: route.titleEn,
    },
    needs,
    travelerPasses: {
      recognized: travelerPasses.recognized,
      unknown: travelerPasses.unknown,
      ...externalPasses,
    },
    policy: {
      onDemandOnly: true,
      restaurantChoices: 3,
      pharmacyChoices: 2,
      cacheMinutes: 30,
      passBenefitsAwareness: true,
      passBenefitsNeverBypassTrustGate: true,
      rule: "Show only when the traveler asks or the NOW context requires it.",
    },
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
