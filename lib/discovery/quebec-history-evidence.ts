import type { ResearchLead } from "./research-collectors";
import { discoverDirectSourceUrls, fetchDeepEvidenceWindows, sourceFamilyOf } from "./deep-source-evidence";
import { QUEBEC_CITY_HISTORY_ERAS } from "./quebec-history-context";

export type QuebecHistoryEvidenceStatus = "CONFIRMED" | "PARTIAL" | "UNCONFIRMED";

export type QuebecHistoryEvidenceResult = {
  lead: ResearchLead;
  status: QuebecHistoryEvidenceStatus;
  score: number;
  evidenceUrls: string[];
  independentSources: number;
  trustedSources: number;
  matchedHistoryTerms: string[];
  matchedEraIds: string[];
  reasons: string[];
  deepPagesOpened: number;
};

const USER_AGENT = "VelvetPassportPredatorQuebec/2.0 (Quebec City history enrichment; source-bound; fail closed)";
const TRUSTED_HOST_HINTS = [
  "ville.quebec.qc.ca",
  "patrimoine-culturel.gouv.qc.ca",
  "banq.qc.ca",
  "parks.canada.ca",
  "biographi.ca",
  "musee",
  "mcq.org",
  "civilisations.ca",
  "historymuseum.ca",
  "canada.ca",
];
const HISTORY_TERMS = [
  "histoire", "historique", "history", "historic", "patrimoine", "archive", "archives",
  "construit", "construction", "bâti", "batiment", "bâtiment", "maison", "immeuble",
  "propriétaire", "proprietaire", "occupé", "occupe", "habité", "habite", "commerce",
  "atelier", "marchand", "port", "quai", "incendie", "siège", "siege", "garnison",
  "Nouvelle-France", "Bas-Canada", "régime britannique", "regime britannique",
  "parcelle", "lot", "cadastre", "plan", "carte", "démoli", "demoli", "reconstruit",
  "transformé", "transforme", "architecte", "événement", "evenement", "procès", "proces",
  "grève", "greve", "émeute", "emeute", "arrestation", "explosion", "tramway",
];

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return "unknown"; }
}
function sourceQuality(host: string) {
  return TRUSTED_HOST_HINTS.some((hint) => host.includes(hint)) ? 1 : 0;
}
function xmlItems(xml: string) {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const read = (block: string, tag: string) => {
    const match = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i"));
    return stripHtml((match?.[1] ?? "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
  };
  return blocks.map((block) => ({ title: read(block, "title"), link: read(block, "link"), description: read(block, "description") }))
    .filter((item) => item.title && item.link);
}
async function fetchWithTimeout(url: string, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/rss+xml,text/xml,*/*" },
      signal: controller.signal,
      next: { revalidate: 86400 },
    });
  } finally {
    clearTimeout(timer);
  }
}
function identityTokens(name: string) {
  const generic = new Set(["quebec", "québec", "ville", "rue", "place", "parc", "square", "maison", "hotel", "hôtel"]);
  return normalize(name).split(/[^a-z0-9]+/).filter((token) => token.length >= 3 && !generic.has(token));
}
function identityMatches(lead: ResearchLead, text: string) {
  const t = normalize(text);
  const n = normalize(lead.name);
  if (n.length >= 7 && t.includes(n)) return true;
  const tokens = identityTokens(lead.name);
  if (!tokens.length) return false;
  const matched = tokens.filter((token) => t.includes(token)).length;
  return tokens.length === 1 ? matched === 1 : matched >= Math.min(2, tokens.length);
}
function matchedEras(text: string) {
  const t = normalize(text);
  return QUEBEC_CITY_HISTORY_ERAS.filter((era) =>
    era.searchAnchors.some((anchor) => t.includes(normalize(anchor))) ||
    era.urbanThemes.some((theme) => t.includes(normalize(theme)))
  ).map((era) => era.id);
}

export async function enrichQuebecHistoryEvidence(leads: ResearchLead[], maxLookups = 8) {
  const results: QuebecHistoryEvidenceResult[] = [];
  let allocated = 0;

  for (const lead of leads) {
    if (allocated >= maxLookups || (!lead.address && typeof lead.lat !== "number")) {
      results.push({
        lead,
        status: "UNCONFIRMED",
        score: 0,
        evidenceUrls: [],
        independentSources: 0,
        trustedSources: 0,
        matchedHistoryTerms: [],
        matchedEraIds: [],
        reasons: ["Quebec historical enrichment was not allocated or the current place identity is unresolved."],
        deepPagesOpened: 0,
      });
      continue;
    }
    allocated += 1;

    const queries = [
      `"${lead.name}" Québec histoire patrimoine`,
      `"${lead.name}" Québec archives plan adresse`,
      `"${lead.name}" site:ville.quebec.qc.ca archives`,
      `"${lead.name}" site:patrimoine-culturel.gouv.qc.ca`,
      `"${lead.name}" site:banq.qc.ca`,
    ];

    const searchEvidence: Array<{ text: string; url: string; host: string; family: string; trusted: number }> = [];
    for (const query of queries) {
      try {
        const response = await fetchWithTimeout(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`);
        if (!response.ok) continue;
        const xml = await response.text();
        for (const item of xmlItems(xml).slice(0, 8)) {
          const raw = `${item.title} ${item.description}`;
          if (!identityMatches(lead, raw)) continue;
          const host = hostOf(item.link);
          searchEvidence.push({
            text: normalize(raw),
            url: item.link,
            host,
            family: sourceFamilyOf(item.link),
            trusted: sourceQuality(host),
          });
        }
      } catch {
        // Search failures remain unknown; no evidence is invented.
      }
    }

    const direct = await discoverDirectSourceUrls(lead.name, 6);
    const urls = [...new Set([...direct, ...searchEvidence.map((e) => e.url)])].slice(0, 10);
    const deep = await fetchDeepEvidenceWindows(lead.name, urls, HISTORY_TERMS, 6);

    const deepEvidence = deep.windows
      .filter((item) => item.terms.length > 0)
      .map((item) => ({
        text: normalize(item.text),
        url: item.url,
        host: item.host,
        family: item.sourceFamily,
        trusted: sourceQuality(item.host),
      }))
      .filter((item) => identityMatches(lead, item.text));

    const evidence = [...searchEvidence, ...deepEvidence];
    const matchedHistoryTerms = [...new Set(HISTORY_TERMS.filter((term) =>
      evidence.some((item) => item.text.includes(normalize(term)))
    ))];
    const sourceFamilies = [...new Set(evidence.map((item) => item.family))];
    const trustedFamilies = [...new Set(evidence.filter((item) => item.trusted).map((item) => item.family))];
    const evidenceUrls = [...new Set(evidence.map((item) => item.url))].slice(0, 12);
    const matchedEraIds = [...new Set(evidence.flatMap((item) => matchedEras(item.text)))];

    const score = Math.min(
      100,
      matchedHistoryTerms.length * 5 +
      Math.min(36, sourceFamilies.length * 12) +
      Math.min(30, trustedFamilies.length * 15) +
      Math.min(18, deepEvidence.length * 6),
    );
    const status: QuebecHistoryEvidenceStatus =
      score >= 64 && sourceFamilies.length >= 2 && trustedFamilies.length >= 1 ? "CONFIRMED" :
      score >= 28 ? "PARTIAL" : "UNCONFIRMED";

    const reasons = [
      status === "CONFIRMED"
        ? "Quebec historical depth is corroborated across independent source families including at least one authoritative/local history source."
        : status === "PARTIAL"
          ? "Historical clues exist, but authoritative corroboration or independent-source depth remains incomplete."
          : "No sufficiently reliable identity-matched Quebec historical depth was established.",
      matchedEraIds.length
        ? `Historical-context cues matched eras: ${matchedEraIds.join(", ")}. These cues guide research only and are not evidence.`
        : "No era-context cue was used as proof.",
    ];

    const claim = `QUEBEC_HISTORY_EVIDENCE status=${status} score=${score} independent=${sourceFamilies.length} trusted=${trustedFamilies.length} eras=${matchedEraIds.join(",") || "none"}`;

    results.push({
      lead: { ...lead, rawClaims: [...lead.rawClaims, claim] },
      status,
      score,
      evidenceUrls,
      independentSources: sourceFamilies.length,
      trustedSources: trustedFamilies.length,
      matchedHistoryTerms,
      matchedEraIds,
      reasons,
      deepPagesOpened: deep.opened,
    });
  }

  return {
    results,
    leads: results.map((r) => r.lead),
    confirmed: results.filter((r) => r.status === "CONFIRMED"),
    partial: results.filter((r) => r.status === "PARTIAL"),
    unconfirmed: results.filter((r) => r.status === "UNCONFIRMED"),
    rule: "Quebec historical context accelerates source discovery but never substitutes for attached evidence, micro-location or material-continuity proof.",
  };
}
