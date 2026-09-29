import { buildIntegratedRoutePlan } from "../../../../../lib/now-engine";
import { getSupabaseRouteCatalog } from "../../../../../lib/supabase-confidential-routes";

export const runtime = "nodejs";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview" && process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const catalog = await getSupabaseRouteCatalog();
  const scenarios = ["route", "rain", "blocked"] as const;
  const results = catalog.routes.map((route) => {
    const scenarioResults = scenarios.map((scenario) => {
      const plan = buildIntegratedRoutePlan(route.id, scenario, "16:30", 90, undefined, route);
      const errors: string[] = [];
      if (!plan) errors.push("no-plan");
      if (plan && plan.stops.length < 2) errors.push("too-few-stops");
      if (plan && !plan.title) errors.push("missing-title");
      if (plan && !plan.ticket.protected) errors.push("ticket-unprotected");
      if (plan && plan.ticket.marginMinutes < 15) errors.push("margin-below-15");
      if (plan && plan.stops.some((stop) => !stop.title || !stop.duration || !stop.time)) errors.push("invalid-stop");
      return {
        scenario,
        ok: errors.length === 0,
        errors,
        stopCount: plan?.stops.length ?? 0,
        title: plan?.title ?? null,
        marginMinutes: plan?.ticket.marginMinutes ?? null,
      };
    });

    return {
      id: route.id,
      zone: route.zone,
      title: route.title,
      sourceStopCount: route.stops.length,
      ok: scenarioResults.every((item) => item.ok),
      scenarios: scenarioResults,
    };
  });

  const failed = results.filter((route) => !route.ok);
  const generatedPlans = results.reduce((sum, route) => sum + route.scenarios.length, 0);

  return Response.json({
    ok: catalog.source === "supabase-v5-test" && results.length === 30 && failed.length === 0,
    source: catalog.source,
    routesTested: results.length,
    generatedPlans,
    failedRoutes: failed.length,
    failures: failed,
    results,
  }, {
    status: failed.length ? 500 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
