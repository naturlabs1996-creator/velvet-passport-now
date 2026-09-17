import { NextResponse } from "next/server";

const allowedEvents = new Set([
  "page_view",
  "answer_engaged",
  "guide_cta_click",
  "mini_guide_click",
  "store_router_open",
  "store_selected",
  "now_interest",
]);

const supabaseUrl = "https://kbceicncyhjbegdbjhxl.supabase.co";
const supabasePublishableKey = "sb_publishable_QcO_SHeSjxJqu88Cw36gVw_xtKFB-hl";

type DiscoveryEvent = {
  event?: string;
  page?: string;
  theme?: string;
  source?: string;
  campaign?: string;
  asset?: string;
  store?: string;
  product?: string;
};

function clean(value: unknown, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) : undefined;
}

export async function POST(request: Request) {
  let body: DiscoveryEvent;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const event = clean(body.event, 48);
  if (!event || !allowedEvents.has(event)) {
    return NextResponse.json({ ok: false, error: "invalid_event" }, { status: 400 });
  }

  const payload = {
    p_event_type: event,
    p_page: clean(body.page) ?? null,
    p_theme: clean(body.theme) ?? null,
    p_source: clean(body.source) ?? null,
    p_campaign: clean(body.campaign) ?? null,
    p_asset: clean(body.asset) ?? null,
    p_store: clean(body.store, 40) ?? null,
    p_product: clean(body.product, 80) ?? null,
    p_session_id: null,
  };

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/vp_ingest_discovery_event`, {
      method: "POST",
      headers: {
        apikey: supabasePublishableKey,
        authorization: `Bearer ${supabasePublishableKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("VELVET_DISCOVERY_PERSIST_FAILED", response.status, await response.text());
      return NextResponse.json({ ok: false, error: "storage_failed" }, { status: 503 });
    }
  } catch (error) {
    console.error("VELVET_DISCOVERY_PERSIST_FAILED", error);
    return NextResponse.json({ ok: false, error: "storage_unavailable" }, { status: 503 });
  }

  return new NextResponse(null, { status: 204 });
}
