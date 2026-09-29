import { CONFIDENTIAL_ROUTES, type ConfidentialRoute } from "./confidential-routes";

const SUPABASE_URL = "https://ywcmmujuhtmredzvjhrg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_bgSsoqVp8AAdqcdqOjBCYw_tu0-Y7sd";

type RouteRow = {
  route_id: string;
  route_number: number;
  public_title: string;
  duration_min: number;
  zone: string;
};

type StopRow = {
  stop_zone_id: string;
  route_id: string;
  sequence: number;
  label: string;
  latitude: number | null;
  longitude: number | null;
  access: string;
  coordinate_status: string | null;
};

type StoryRow = {
  story_id: string;
  route_id: string;
  title: string;
  status: "LOCK" | "VELVET_DETAIL" | "TRANSITION" | "RESERVE";
  proof_level: "PROUVÉ" | "TRÈS_PROBABLE" | "RECONSTRUIT" | "HYPOTHÈSE" | null;
  event_micro_location: string | null;
  presentation_anchor: string | null;
  look_for: string | null;
  hidden_detail: string | null;
  ambience: string | null;
  narrative_sounds: string[] | null;
  canonical_narrative_md: string;
  canonical_public_excerpt: string | null;
  canonical_why_it_matters: string | null;
  canonical_look_for: string | null;
  canonical_role: string | null;
  experience_batch: string | null;
  experience_status: string | null;
  editorial_i18n: {
    fr?: { written?: string; audio?: string; lookFor?: string };
    en?: { written?: string; audio?: string; lookFor?: string };
  } | null;
  editorial_status: string | null;
};

type StoryLinkRow = {
  story_id: string;
  stop_zone_id: string;
};

export type SupabaseRouteCatalog = {
  routes: ConfidentialRoute[];
  source: "supabase-v5-test" | "static-fallback";
  stopCount: number;
};

async function readView<T>(view: string, select: string): Promise<T[]> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${view}?select=${encodeURIComponent(select)}`,
    {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error(`Supabase ${view} failed: ${response.status}`);
  return response.json() as Promise<T[]>;
}

function toAccess(value: string): "opening-hours" | "public-street" {
  return value === "PUBLIC_LIMITED_HOURS" || value === "INTERIOR_OCCASIONAL"
    ? "opening-hours"
    : "public-street";
}

function narrativeExcerpt(markdown: string) {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line !== "---")
    .map((line) => line.replace(/^[-*]\s+/, "").replace(/\*\*/g, ""));
  const text = lines.join(" ");
  return text.length <= 300 ? text : text.slice(0, 297).trimEnd() + "…";
}

function storyView(story: StoryRow) {
  return {
    id: story.story_id,
    title: story.title,
    status: story.status,
    proofLevel: story.proof_level,
    narrativeMd: story.canonical_narrative_md,
    eventMicroLocation: story.event_micro_location,
    presentationAnchor: story.presentation_anchor,
    lookFor: story.look_for,
    hiddenDetail: story.hidden_detail,
    ambience: story.ambience,
    narrativeSounds: story.narrative_sounds ?? [],
    publicExcerpt: story.canonical_public_excerpt ?? narrativeExcerpt(story.canonical_narrative_md),
    whyItMatters: story.canonical_why_it_matters,
    canonicalLookFor: story.canonical_look_for,
    canonicalRole: story.canonical_role,
    experienceBatch: story.experience_batch,
    experienceStatus: story.experience_status,
    editorialI18n: story.editorial_i18n,
    editorialStatus: story.editorial_status,
  };
}

export async function getSupabaseRouteCatalog(): Promise<SupabaseRouteCatalog> {
  try {
    const [routeRows, stopRows, storyRows, storyLinks] = await Promise.all([
      readView<RouteRow>(
        "vp_now_test_routes",
        "route_id,route_number,public_title,duration_min,zone",
      ),
      readView<StopRow>(
        "vp_now_test_stop_zones",
        "stop_zone_id,route_id,sequence,label,latitude,longitude,access,coordinate_status",
      ),
      readView<StoryRow>(
        "vp_now_test_stories",
        "story_id,route_id,title,status,proof_level,event_micro_location,presentation_anchor,look_for,hidden_detail,ambience,narrative_sounds,canonical_narrative_md,canonical_public_excerpt,canonical_why_it_matters,canonical_look_for,canonical_role,experience_batch,experience_status,editorial_i18n,editorial_status",
      ),
      readView<StoryLinkRow>(
        "vp_now_test_story_stop_zones",
        "story_id,stop_zone_id",
      ),
    ]);

    if (routeRows.length !== 30 || stopRows.length !== 119 || storyRows.length !== 121 || storyLinks.length !== 122) {
      throw new Error(`Unexpected V5 counts: routes=${routeRows.length}, stops=${stopRows.length}, stories=${storyRows.length}, links=${storyLinks.length}`);
    }

    const stopsByRoute = new Map<string, StopRow[]>();
    for (const stop of stopRows) {
      const list = stopsByRoute.get(stop.route_id) ?? [];
      list.push(stop);
      stopsByRoute.set(stop.route_id, list);
    }

    const storyById = new Map(storyRows.map((story) => [story.story_id, story]));
    const storyIdsByStop = new Map<string, string[]>();
    for (const link of storyLinks) {
      const list = storyIdsByStop.get(link.stop_zone_id) ?? [];
      list.push(link.story_id);
      storyIdsByStop.set(link.stop_zone_id, list);
    }

    const routes = [...routeRows]
      .sort((a, b) => a.route_number - b.route_number)
      .map((row) => {
        const fallback = CONFIDENTIAL_ROUTES[row.route_number - 1];
        if (!fallback) throw new Error(`No fallback route for route number ${row.route_number}`);
        const rows = (stopsByRoute.get(row.route_id) ?? []).sort((a, b) => a.sequence - b.sequence);
        if (!rows.length) throw new Error(`No stop zones for ${row.route_id}`);

        const stops = rows.map((stop, index) => {
          const stories = (storyIdsByStop.get(stop.stop_zone_id) ?? [])
            .map((storyId) => storyById.get(storyId))
            .filter((story): story is StoryRow => Boolean(story))
            .map(storyView);
          const firstStory = stories[0];
          return {
            name: stop.label,
            access: toAccess(stop.access),
            alternative: rows[index + 1]?.label ?? rows[index - 1]?.label ?? stop.label,
            storyExcerpt: firstStory?.publicExcerpt ?? (firstStory?.narrativeMd ? narrativeExcerpt(firstStory.narrativeMd) : undefined),
            story: firstStory,
            stories,
            latitude: stop.latitude,
            longitude: stop.longitude,
            coordinateStatus: stop.coordinate_status,
          };
        });

        return {
          id: fallback.id,
          zone: row.zone,
          title: row.public_title,
          durationMinutes: row.duration_min,
          stops,
          blockedStreetAlternative: fallback.blockedStreetAlternative,
          ticketProtection: true,
          uncoveredAddressesIncluded: fallback.uncoveredAddressesIncluded,
        } satisfies ConfidentialRoute;
      });

    return { routes, source: "supabase-v5-test", stopCount: stopRows.length };
  } catch (error) {
    console.error("Paris NOW Supabase V5 catalog unavailable; using static fallback", error);
    return {
      routes: CONFIDENTIAL_ROUTES,
      source: "static-fallback",
      stopCount: CONFIDENTIAL_ROUTES.reduce((sum, route) => sum + route.stops.length, 0),
    };
  }
}
