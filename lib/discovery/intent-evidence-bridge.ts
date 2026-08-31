import type { ResearchLead } from "./research-collectors";

export type IntentEvidenceStatus = "CONFIRMED" | "PARTIAL" | "UNCONFIRMED";

export type IntentEvidenceResult = {
  lead: ResearchLead;
  status: IntentEvidenceStatus;
  score: number;
  matchedTerms: string[];
  evidenceUrls: string[];
  independentSources: number;
  queries: string[];
  reasons: string[];
};

const USER_AGENT = "VelvetPassportIntentBridge/1.0 (focused intent verification; cached public search)";

const THEME_TERMS: Record<string, string[]> = {
  "beyond-the-classics": ["unusual", "less known", "off the beaten", "hidden gem", "independent", "atypical", "insolite"],
  "quiet-paris": ["quiet", "calm", "peaceful", "tranquil", "away from crowds", "paisible"],
  "secret-gardens": ["garden", "jardin", "courtyard", "cour", "green space"],
  "forgotten-passages": ["passage", "covered passage", "galerie", "arcade"],
  "hidden-bookshops": ["bookshop", "bookstore", "librairie", "literary", "books"],
  "unusual-museums": ["museum", "musée", "collection", "cabinet", "unusual", "insolite"],
  "paris-after-dark": ["night", "evening", "late opening", "open late", "nocturne", "after dark", "soir", "soirée"],
  "rainy-day-paris": ["indoor", "covered", "inside", "museum", "gallery", "bookshop", "arcade"],
};

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "unknown"; }
}

function xmlItems(xml: string) {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const read = (block: string, tag: string) => {
    const match = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i"));
    return stripHtml((match?.[1] ?? "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
  };
  return blocks.map((block) => ({ title: read(block, "title"), link: read(block, "link"), description: read(block, "description") })).filter((item) => item.title && item.link);
}

async function fetchWithTimeout(url: string, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "application/rss+xml,text/xml,*/*" }, signal: controller.signal, next: { revalidate: 21600 } });
  } finally { clearTimeout(timer); }
}

function placeLike(lead: ResearchLead) {
  return typeof lead.lat === "number" && typeof lead.lon === "number" || Boolean(lead.address);
}

function buildQueries(lead: ResearchLead) {
  const terms = THEME_TERMS[lead.theme] ?? [];
  const primary = terms.slice(0, 4).join(" OR ");
  const secondary = terms.slice(4, 8).join(" OR ");
  return [
    `\"${lead.name}\" Paris (${primary})`,
    secondary ? `\"${lead.name}\" Paris (${secondary})` : `\"${lead.name}\" Paris ${lead.query}`,
  ];
}

export async function verifyIntentEvidence(leads: ResearchLead[], maxLookups = 8) {
  const eligible = leads.filter(placeLike).slice(0, Math.max(1, Math.min(maxLookups, 16)));
  const results: IntentEvidenceResult[] = [];
  let lookups = 0;

  for (const lead of leads) {
    if (!eligible.includes(lead)) {
      results.push({ lead, status: "UNCONFIRMED", score: 0, matchedTerms: [], evidenceUrls: [], independentSources: 0, queries: [], reasons: ["Focused intent verification was not allocated to this candidate or it lacks a resolved physical place identity."] });
      continue;
    }

    const terms = THEME_TERMS[lead.theme] ?? [];
    const queries = buildQueries(lead);
    const evidence: Array<{ text: string; url: string; host: string }> = [];

    for (const query of queries) {
      lookups += 1;
      try {
        const response = await fetchWithTimeout(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`);
        if (!response.ok) continue;
        const xml = await response.text();
        for (const item of xmlItems(xml).slice(0, 8)) {
          const text = normalize(`${item.title} ${item.description}`);
          if (!text.includes(normalize(lead.name).split(" ")[0] ?? "")) continue;
          evidence.push({ text, url: item.link, host: hostOf(item.link) });
        }
      } catch {
        // Search failure leaves intent unconfirmed rather than inventing evidence.
      }
    }

    const matchedTerms = [...new Set(terms.filter((term) => evidence.some((item) => item.text.includes(normalize(term)))) )];
    const sources = [...new Set(evidence.filter((item) => terms.some((term) => item.text.includes(normalize(term)))).map((item) => item.host))];
    const evidenceUrls = [...new Set(evidence.filter((item) => terms.some((term) => item.text.includes(normalize(term)))).map((item) => item.url))].slice(0, 8);
    const score = Math.min(100, matchedTerms.length * 22 + Math.min(44, sources.length * 22));
    const status: IntentEvidenceStatus = score >= 66 && sources.length >= 2 ? "CONFIRMED" : score >= 30 ? "PARTIAL" : "UNCONFIRMED";
    const reasons = [
      status === "CONFIRMED" ? "Focused search found theme-specific evidence across at least two independent sources." : status === "PARTIAL" ? "Focused search found some theme-specific evidence, but independent confirmation is still incomplete." : "Focused search did not find enough theme-specific evidence to confirm the traveler-intent fit.",
    ];

    const bridgeClaim = matchedTerms.length ? `INTENT_EVIDENCE ${lead.theme}: ${matchedTerms.join(", ")} | independent_sources=${sources.length} | status=${status}` : `INTENT_EVIDENCE ${lead.theme}: status=${status}`;
    results.push({ lead: { ...lead, rawClaims: [...lead.rawClaims, bridgeClaim] }, status, score, matchedTerms, evidenceUrls, independentSources: sources.length, queries, reasons });
  }

  return {
    results,
    leads: results.map((item) => item.lead),
    confirmed: results.filter((item) => item.status === "CONFIRMED"),
    partial: results.filter((item) => item.status === "PARTIAL"),
    unconfirmed: results.filter((item) => item.status === "UNCONFIRMED"),
    lookups,
    rule: "A semantic scent or resolved place may trigger focused research, but intent fit is confirmed only from explicit theme evidence. Search recurrence is investigative evidence and cannot by itself verify publication claims.",
  };
}
