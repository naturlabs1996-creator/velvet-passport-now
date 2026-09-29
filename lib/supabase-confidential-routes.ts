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
  access: string;
  coordinate_status: string | null;
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
      next: { revalidate: 60 },
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

export async function getSupabaseRouteCatalog(): Promise<SupabaseRouteCatalog> {
  try {
    const [routeRows, stopRows] = await Promise.all([
      readView<RouteRow>(
        "vp_now_test_routes",
        "route_id,route_number,public_title,duration_min,zone",
      ),
      readView<StopRow>(
        "vp_now_test_stop_zones",
        "stop_zone_id,route_id,sequence,label,access,coordinate_status",
      ),
    ]);

    if (routeRows.length !== 30 || stopRows.length !== 119) {
      throw new Error(`Unexpected V5 counts: routes=${routeRows.length}, stops=${stopRows.length}`);
    }

    const stopsByRoute = new Map<string, StopRow[]>();
    for (const stop of stopRows) {
      const list = stopsByRoute.get(stop.route_id) ?? [];
      list.push(stop);
      stopsByRoute.set(stop.route_id, list);
    }

    const routes = [...routeRows]
      .sort((a, b) => a.route_number - b.route_number)
      .map((row) => {
        const fallback = CONFIDENTIAL_ROUTES[row.route_number - 1];
        if (!fallback) throw new Error(`No fallback route for route number ${row.route_number}`);
        const rows = (stopsByRoute.get(row.route_id) ?? []).sort((a, b) => a.sequence - b.sequence);
        if (!rows.length) throw new Error(`No stop zones for ${row.route_id}`);

        const stops = rows.map((stop, index) => ({
          name: stop.label,
          access: toAccess(stop.access),
          alternative: rows[index + 1]?.label ?? rows[index - 1]?.label ?? stop.label,
        }));

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
