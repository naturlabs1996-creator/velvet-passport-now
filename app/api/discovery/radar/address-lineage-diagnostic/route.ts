import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets";

async function query(dataset: string, term: string) {
  const where = `search(*, "${term.replace(/"/g, "\\\"")}")`;
  const url = `${BASE}/${dataset}/records?where=${encodeURIComponent(where)}&limit=5`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "VelvetPassportAddressLineage/0.1 (official Paris Data diagnostic)",
        accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { /* keep raw */ }
    return {
      ok: response.ok,
      status: response.status,
      url,
      json,
      raw: response.ok ? undefined : text.slice(0, 500),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  try {
    const [caduc, current] = await Promise.all([
      query("denominations-des-voies-caduques", "rue Perdue"),
      query("denominations-emprises-voies-actuelles", "Maître Albert"),
    ]);

    return NextResponse.json({
      ok: caduc.ok && current.ok,
      generatedAt: new Date().toISOString(),
      caduc,
      current,
    }, {
      status: caduc.ok && current.ok ? 200 : 502,
      headers: { "cache-control": "no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      generatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "address_lineage_diagnostic_failed",
    }, {
      status: 500,
      headers: { "cache-control": "no-store, max-age=0" },
    });
  }
}
