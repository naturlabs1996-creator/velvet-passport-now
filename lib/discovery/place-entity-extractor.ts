import type { ResearchLead } from "./research-collectors";

export type PlaceExtractionResult = {
  sourceLeadId: string;
  sourceUrl: string;
  extracted: ResearchLead[];
  ok: boolean;
  error?: string;
};

const USER_AGENT = "VelvetPassportPlaceExtractor/1.0 (deep source entity extraction; cached public pages)";
const GENERIC = /^(paris|france|home|menu|visit|guide|travel|things to do|best places|read more|learn more|about|contact|official website|wikipedia)$/i;
const BAD = /hotel booking|privacy|cookie|newsletter|facebook|instagram|youtube|tripadvisor|terms|login|sign in|subscribe|museum[s]? in paris|things to do in paris/i;

function clean(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function decodeEntities(value: string) {
  return clean(value.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))));
}

function plausiblePlaceName(value: string) {
  const text = decodeEntities(value).replace(/^[\d.\-–—: ]+/, "").replace(/[|•].*$/, "").trim();
  if (text.length < 4 || text.length > 90 || GENERIC.test(text) || BAD.test(text)) return null;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 9) return null;
  const signal = /\b(mus[eé]e|museum|maison|h[oô]tel|passage|galerie|jardin|garden|square|cour|courtyard|librairie|bookshop|bookstore|atelier|chapelle|church|église|cemetery|cimetière|catacomb|palais|pavillon|villa|théâtre|theatre|café|cafe|bibliothèque|library|fondation|foundation|rue|street|place|arcade|halle|market|marché)\b/i.test(text);
  const proper = words.filter((word) => /^[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+$/.test(word)).length >= Math.min(2, words.length);
  return signal || proper ? text : null;
}

async function fetchWithTimeout(url: string, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" }, signal: controller.signal, next: { revalidate: 21600 } });
  } finally { clearTimeout(timer); }
}

function extractCandidateTexts(html: string) {
  const texts: string[] = [];
  const patterns = [
    /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi,
    /<a\b[^>]*>([\s\S]*?)<\/a>/gi,
    /<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null && texts.length < 300) {
      const candidate = plausiblePlaceName(match[1] ?? "");
      if (candidate) texts.push(candidate);
    }
  }
  return [...new Set(texts.map((item) => item.trim()))];
}

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "unknown"; }
}

export async function extractPlaceEntitiesFromSources(leads: ResearchLead[], maxSourcePages = 6, maxEntitiesPerPage = 8) {
  const eligible = leads.filter((lead) => lead.sourceType === "EDITORIAL" || lead.sourceType === "OFFICIAL").slice(0, Math.max(1, Math.min(maxSourcePages, 10)));
  const results: PlaceExtractionResult[] = [];

  for (const lead of eligible) {
    try {
      const response = await fetchWithTimeout(lead.url);
      if (!response.ok || !(response.headers.get("content-type") ?? "").includes("text/html")) {
        results.push({ sourceLeadId: lead.id, sourceUrl: lead.url, extracted: [], ok: false, error: `http_${response.status}` });
        continue;
      }
      const html = (await response.text()).slice(0, 900_000);
      const names = extractCandidateTexts(html).filter((name) => name.toLowerCase() !== lead.name.toLowerCase()).slice(0, Math.max(1, Math.min(maxEntitiesPerPage, 12)));
      const observedAt = new Date().toISOString();
      const host = hostOf(lead.url);
      const extracted = names.map((name, index): ResearchLead => ({
        id: `extracted:${Buffer.from(`${lead.id}:${name}`).toString("base64url").slice(0, 28)}:${index}`,
        pageId: lead.pageId,
        theme: lead.theme,
        query: lead.query,
        name,
        snippet: `Extracted as a named place candidate from ${lead.name}`,
        url: lead.url,
        sourceType: lead.sourceType,
        publisher: lead.publisher,
        independentKey: host,
        observedAt,
        rawClaims: [`PLACE_ENTITY_EXTRACTED_FROM ${lead.url}`, `SOURCE_CONTEXT ${lead.name}`],
      }));
      results.push({ sourceLeadId: lead.id, sourceUrl: lead.url, extracted, ok: true });
    } catch (error) {
      results.push({ sourceLeadId: lead.id, sourceUrl: lead.url, extracted: [], ok: false, error: error instanceof Error ? error.message : "source_fetch_failed" });
    }
  }

  const extracted = results.flatMap((item) => item.extracted);
  const seen = new Set<string>();
  const deduped = extracted.filter((lead) => {
    const key = lead.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    results,
    leads: deduped,
    sourcePagesAttempted: eligible.length,
    sourcePagesOpened: results.filter((item) => item.ok).length,
    extractedCount: deduped.length,
    rule: "Editorial and official pages are containers of leads, not proof that extracted places satisfy the traveler intent. Every extracted entity must still pass place resolution, Paris entity lock, focused intent verification, relevance and claim-level verification.",
  };
}
