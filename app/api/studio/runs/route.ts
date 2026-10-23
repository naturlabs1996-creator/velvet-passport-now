import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const REPO = "naturlabs1996-creator/velvet-passport-now";
const TARGETS = [
  { key: "audio_fr", label: "Paris 05 · Master FR", run: 39629212549 },
  { key: "audio_en", label: "Paris 05 · Master EN", run: 39783346444 },
  { key: "staging", label: "Paris 05 · Staging bilingue", run: 39857004074 },
  { key: "engine_qa", label: "Production Engine · QA", run: 39855255237 },
  { key: "studio_qa", label: "Studio · Build", run: 39857840507 },
] as const;
export async function GET() {
  const data = await Promise.all(TARGETS.map(async item => {
    try {
      const response = await fetch(`https://api.github.com/repos/${REPO}/actions/runs/${item.run}`, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "VelvetProductionStudio" },
        cache: "no-store",
        signal: AbortSignal.timeout(7000),
      });
      if (!response.ok) return { ...item, status: "unavailable", conclusion: null, url: `https://github.com/${REPO}/actions/runs/${item.run}` };
      const result = await response.json() as { status?: string; conclusion?: string | null; html_url?: string; updated_at?: string };
      return { ...item, status: result.status ?? "unknown", conclusion: result.conclusion ?? null, updated_at: result.updated_at ?? null,
        url: `https://github.com/${REPO}/actions/runs/${item.run}` };
    } catch {
      return { ...item, status: "unavailable", conclusion: null, url: `https://github.com/${REPO}/actions/runs/${item.run}` };
    }
  }));
  let renderRun: { key: string; label: string; run: number; status: string; conclusion: string | null; url: string } | null = null;
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/paris05-controlled-av-render.yml/runs?per_page=1`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "VelvetProductionStudio" },
      cache: "no-store", signal: AbortSignal.timeout(7000),
    });
    if (response.ok) {
      const payload = await response.json() as { workflow_runs?: { id: number; status: string; conclusion: string | null; html_url: string }[] };
      const latest = payload.workflow_runs?.[0];
      if (latest) renderRun = { key: "render", label: "Paris 05 · Latest controlled render", run: latest.id,
        status: latest.status, conclusion: latest.conclusion, url: latest.html_url };
    }
  } catch { /* render status remains unavailable; no dispatch occurs */ }
  return NextResponse.json({ route_id: "VP-PAR-05", source: "GitHub Actions", checked_at: new Date().toISOString(), runs: renderRun ? [...data, renderRun] : data }, {
    headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
