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

  const record = {
    event,
    city: "Paris",
    page: clean(body.page),
    theme: clean(body.theme),
    source: clean(body.source),
    campaign: clean(body.campaign),
    asset: clean(body.asset),
    store: clean(body.store, 40),
    product: clean(body.product, 80),
    occurredAt: new Date().toISOString(),
  };

  // V1 collector: keeps the client/API contract stable while persistent storage
  // is connected in the next MVP step. Vercel function logs retain the event now.
  console.info("VELVET_DISCOVERY_EVENT", JSON.stringify(record));

  return new NextResponse(null, { status: 204 });
}
