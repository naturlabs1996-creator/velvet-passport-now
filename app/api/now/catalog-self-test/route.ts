import { buildIntegratedRoutePlan } from "../../../../lib/now-engine";
import { getSupabaseRouteCatalog } from "../../../../lib/supabase-confidential-routes";

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
  const sourceStops = catalog.routes.flatMap((route) => route.stops);
  const storyStops = sourceStops.filter((stop) => Boolean(stop.story?.narrativeMd));
  const geocodedStops = sourceStops.filter((stop) => stop.latitude != null && stop.longitude != null);
  const reviewStops = sourceStops.filter((stop) => stop.coordinateStatus === "REVIEW");
  const storylessStops = sourceStops.filter((stop) => !stop.story?.narrativeMd).map((stop) => stop.name);
  const batch15Stops = sourceStops.filter((stop) => stop.story?.experienceBatch === "01-05");
  const batch15Excerpts = batch15Stops.filter((stop) => Boolean(stop.story?.publicExcerpt));
  const batch15LookFor = batch15Stops.filter((stop) => Boolean(stop.story?.canonicalLookFor));
  const batch610Stops = sourceStops.filter((stop) =>
    (stop.stories ?? (stop.story ? [stop.story] : [])).some((story) => story.experienceBatch === "06-10")
  );
  const batch610StoryAppearances = batch610Stops.flatMap((stop) =>
    (stop.stories ?? (stop.story ? [stop.story] : [])).filter((story) => story.experienceBatch === "06-10")
  );
  const batch610UniqueStories = new Map(batch610StoryAppearances.map((story) => [story.id, story]));
  const batch610Excerpts = [...batch610UniqueStories.values()].filter((story) => Boolean(story.publicExcerpt));
  const batch610LookFor = [...batch610UniqueStories.values()].filter((story) => Boolean(story.canonicalLookFor));
  const batch610MultiStoryStops = batch610Stops.filter((stop) =>
    (stop.stories ?? []).filter((story) => story.experienceBatch === "06-10").length > 1
  );
  const batch1115Stops = sourceStops.filter((stop) =>
    (stop.stories ?? (stop.story ? [stop.story] : [])).some((story) => story.experienceBatch === "11-15")
  );
  const batch1115Stories = batch1115Stops.flatMap((stop) =>
    (stop.stories ?? (stop.story ? [stop.story] : [])).filter((story) => story.experienceBatch === "11-15")
  );
  const batch1620Stops = sourceStops.filter((stop) =>
    (stop.stories ?? (stop.story ? [stop.story] : [])).some((story) => story.experienceBatch === "16-20")
  );
  const batch1620Stories = batch1620Stops.flatMap((stop) =>
    (stop.stories ?? (stop.story ? [stop.story] : [])).filter((story) => story.experienceBatch === "16-20")
  );
  const batch2630Stops = sourceStops.filter((stop) =>
    (stop.stories ?? (stop.story ? [stop.story] : [])).some((story) => story.experienceBatch === "26-30")
  );
  const batch2630Stories = batch2630Stops.flatMap((stop) =>
    (stop.stories ?? (stop.story ? [stop.story] : [])).filter((story) => story.experienceBatch === "26-30")
  );
  const batch2630ReviewStops = batch2630Stops.filter((stop) => stop.coordinateStatus === "REVIEW");

  return Response.json({
    ok: catalog.source === "supabase-v5-test"
      && results.length === 30
      && failed.length === 0
      && sourceStops.length === 119
      && storyStops.length === 119
      && geocodedStops.length === 104
      && reviewStops.length === 15
      && storylessStops.length === 0
      && batch15Stops.length === 18
      && batch15Excerpts.length === 18
      && batch15LookFor.length === 3
      && batch610Stops.length === 21
      && batch610StoryAppearances.length === 24
      && batch610UniqueStories.size === 23
      && batch610Excerpts.length === 23
      && batch610LookFor.length === 5
      && batch610MultiStoryStops.length === 3
      && batch1115Stops.length === 20
      && batch1115Stories.length === 20
      && batch1620Stops.length === 20
      && batch1620Stories.length === 20
      && batch2630Stops.length === 20
      && batch2630Stories.length === 20
      && batch2630ReviewStops.length === 7,
    source: catalog.source,
    routesTested: results.length,
    generatedPlans,
    failedRoutes: failed.length,
    failures: failed,
    content: {
      sourceStops: sourceStops.length,
      storyStops: storyStops.length,
      geocodedStops: geocodedStops.length,
      reviewStops: reviewStops.length,
      storylessStops,
      batch15: {
        stops: batch15Stops.length,
        excerpts: batch15Excerpts.length,
        lookFor: batch15LookFor.length,
      },
      batch610: {
        stops: batch610Stops.length,
        storyLinks: batch610StoryAppearances.length,
        uniqueStories: batch610UniqueStories.size,
        excerpts: batch610Excerpts.length,
        lookFor: batch610LookFor.length,
        multiStoryStops: batch610MultiStoryStops.length,
      },
      batch1115: {
        stops: batch1115Stops.length,
        stories: batch1115Stories.length,
      },
      batch1620: {
        stops: batch1620Stops.length,
        stories: batch1620Stories.length,
      },
      batch2630: {
        stops: batch2630Stops.length,
        stories: batch2630Stories.length,
        reviewStops: batch2630ReviewStops.length,
      },
      sample: sourceStops.slice(0, 3).map((stop) => ({
        name: stop.name,
        storyTitle: stop.story?.title ?? null,
        excerpt: stop.storyExcerpt ?? null,
        coordinateStatus: stop.coordinateStatus ?? null,
      })),
    },
    results,
  }, {
    status: failed.length ? 500 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
