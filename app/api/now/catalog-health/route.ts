import { getSupabaseRouteCatalog } from "../../../../../lib/supabase-confidential-routes";

export const runtime = "nodejs";

export async function GET() {
  const catalog = await getSupabaseRouteCatalog();
  return Response.json(
    {
      ok: catalog.source === "supabase-v5-test",
      source: catalog.source,
      routes: catalog.routes.length,
      stopZones: catalog.stopCount,
      expected: { routes: 30, stopZones: 119 },
    },
    {
      status: catalog.source === "supabase-v5-test" ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        "X-NOW-Catalog-Source": catalog.source,
      },
    },
  );
}
