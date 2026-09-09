import type { ResearchLead } from "./research-collectors";
import type { ResearchEvidence } from "./research-verification";
import { discoverDirectSourceUrls, fetchDeepEvidenceWindows, sourceFamilyOf } from "./deep-source-evidence";
import { huntIndependentEvidence, type ExposureAuditCoverage } from "./entity-specific-evidence-hunter";

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
  deepPagesOpened: number;
  directSourceUrls: number;
  carriedSourceUrls: number;
  hunterSearches: number;
  hunterPagesOpened: number;
  hunterHits: number;
  hunterFamiliesAdded: string[];
  exposureAudit: ExposureAuditCoverage[];
};

const THEME_TERMS: Record<string, string[]> = {
  "beyond-the-classics": ["unusual", "less known", "off the beaten", "hidden gem", "independent", "atypical", "insolite", "under-the-radar"],
  "quiet-paris": ["quiet", "calm", "peaceful", "tranquil", "away from crowds", "paisible", "uncrowded"],
  "secret-gardens": ["garden", "jardin", "courtyard", "cour", "green space"],
  "forgotten-passages": ["covered passage", "passage couvert", "galerie couverte", "covered arcade", "historic covered passage", "hidden passage", "secret passage", "forgotten passage", "passage méconnu"],
  "hidden-bookshops": ["bookshop", "bookstore", "librairie", "literary", "books", "independent bookstore"],
  "unusual-museums": ["unusual museum", "musée insolite", "insolite", "atypical museum", "musée atypique", "quirky museum", "weird museum", "offbeat museum", "cabinet of curiosities", "cabinet de curiosités", "small unusual museum"],
  "paris-after-dark": ["night", "evening", "late opening", "open late", "nocturne", "after dark", "soir", "soirée"],
  "rainy-day-paris": ["indoor", "covered", "inside", "museum", "gallery", "bookshop", "arcade"],
};

const GENERIC_HIGH_EXPOSURE = ["must-see", "must see", "top attraction", "iconic", "most visited", "world famous"];

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function stripHtml(value: string) { return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
function hostOf(url: string) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "unknown"; } }
function wikidataEntityId(lead: ResearchLead) {
  return lead.rawClaims.map((claim) => claim.match(/^WIKIDATA_ENTITY\s+(Q\d+)$/i)?.[1]).find(Boolean);
}
function carriedCanonicalUrls(lead: ResearchLead) {
  const claimUrls = lead.rawClaims
    .map((claim) => claim.match(/^(?:WIKIDATA_SOURCE_URL|PARIS_DATA_SOURCE_URL)\s+(https?:\/\/\S+)$/i)?.[1])
    .filter((value): value is string => Boolean(value));
  const directLeadUrl = lead.sourceType === "OFFICIAL" && /^https?:\/\//i.test(lead.url) ? [lead.url] : [];
  return [...new Set([...claimUrls, ...directLeadUrl])];
}
function primaryVenueAlias(name: string) {
  let alias = name.trim().replace(/\s{2,}/g, " ");
  alias = alias.split(/\s+-\s+/)[0]?.trim() || alias;
  alias = alias.split(/,\s+(?:Hôtel|Hotel)\b/i)[0]?.trim() || alias;
  alias = alias.replace(/\s+mus[eé]e\s+et\s+biblioth[eè]que\s*$/i, "").trim();
  alias = alias.replace(/^Les\s+Catacombes\s+de\s+Paris$/i, "Catacombes de Paris");
  return alias.length >= 4 ? alias : name.trim();
}
function sourceTypeForUrl(url: string): ResearchEvidence["sourceType"] {
  const host = hostOf(url);
  if (/\.gouv\.fr$|(^|\.)paris\.fr$|(^|\.)musee-orangerie\.fr$|(^|\.)musee-orsay\.fr$/.test(host)) return "OFFICIAL";
  if (/wikipedia\.org$|wikimedia\.org$/.test(host)) return "WIKIDATA";
  return "EDITORIAL";
}
function placeLike(lead: ResearchLead) {
  return (typeof lead.lat === "number" && typeof lead.lon === "number") || Boolean(lead.address);
}
function buildQueries(lead: ResearchLead) {
  const terms = THEME_TERMS[lead.theme] ?? [];
  const name = primaryVenueAlias(lead.name);
  return terms.slice(0, 3).map((term) => `\"${name}\" Paris \"${term}\"`);
}
function traceEvidence(lead: ResearchLead, items: Array<{ url: string; sourceFamily: string; text: string; matchedTerms?: string[] }>): ResearchEvidence[] {
  const observedAt = new Date().toISOString();
  return [...new Map(items.map((item, index) => {
    const host = hostOf(item.url);
    const claims = [stripHtml(item.text).slice(0, 900), ...(item.matchedTerms ?? [])].filter(Boolean);
    const evidence: ResearchEvidence = {
      sourceId: `intent-trace:${Buffer.from(`${lead.id}|${item.url}|${index}`).toString("base64url").slice(0, 28)}`,
      sourceType: sourceTypeForUrl(item.url),
      publisher: host,
      url: item.url,
      title: `${lead.name} intent evidence`,
      observedAt,
      claims,
      independentKey: item.sourceFamily || sourceFamilyOf(item.url),
    };
    return [`${evidence.independentKey}|${evidence.url}`, evidence] as const;
  })).values()];
}
function mergeExposureAudit(current: ExposureAuditCoverage[], incoming: ExposureAuditCoverage[]) {
  const rank = { UNAVAILABLE: 0, CHECKED_NO_ANGLE: 1, EXPOSED: 2 } as const;
  const merged = new Map(current.map((item) => [item.family, item]));
  for (const item of incoming) {
    const existing = merged.get(item.family);
    if (!existing || rank[item.status] > rank[existing.status]) merged.set(item.family, item);
    else if (existing && item.status === existing.status) merged.set(item.family, {
      ...existing,
      opened: existing.opened || item.opened,
      matched: Math.max(existing.matched, item.matched),
      inspectedIdentityPages: Math.max(existing.inspectedIdentityPages, item.inspectedIdentityPages),
    });
  }
  return [...merged.values()];
}

export async function verifyIntentEvidence(leads: ResearchLead[], maxLookups = 8) {
  const eligible = leads.filter(placeLike).slice(0, Math.max(1, Math.min(maxLookups, 16)));
  const results: IntentEvidenceResult[] = [];
  let lookups = 0;

  for (const lead of leads) {
    if (!eligible.includes(lead)) {
      results.push({
        lead,
        status: "UNCONFIRMED",
        score: 0,
        matchedTerms: [],
        evidenceUrls: [],
        independentSources: 0,
        queries: [],
        reasons: ["Focused intent verification was not allocated to this candidate or it lacks a resolved physical place identity."],
        deepPagesOpened: 0,
        directSourceUrls: 0,
        carriedSourceUrls: 0,
        hunterSearches: 0,
        hunterPagesOpened: 0,
        hunterHits: 0,
        hunterFamiliesAdded: [],
        exposureAudit: [],
      });
      continue;
    }

    const terms = THEME_TERMS[lead.theme] ?? [];
    const searchName = primaryVenueAlias(lead.name);
    const queries = buildQueries(lead);
    const entityId = wikidataEntityId(lead);
    const carriedUrls = carriedCanonicalUrls(lead);
    const rediscoveredUrls = await discoverDirectSourceUrls(searchName, 5, entityId);
    lookups += rediscoveredUrls.length;
    const directUrls = [...new Set([...carriedUrls, ...rediscoveredUrls])].slice(0, 7);

    const deep = await fetchDeepEvidenceWindows(searchName, directUrls, terms, 5);
    const deepEvidence = deep.windows
      .filter((item) => item.terms.length > 0)
      .map((item) => ({ text: normalize(item.text), url: item.url, host: item.host, sourceFamily: item.sourceFamily, matchedTerms: item.terms }));

    let themeEvidence = [...deepEvidence];
    let matchedTerms = [...new Set(themeEvidence.flatMap((item) => item.matchedTerms))];
    let sourceFamilies = [...new Set(themeEvidence.map((item) => item.sourceFamily))];
    let evidenceUrls = [...new Set(themeEvidence.map((item) => item.url))].slice(0, 8);
    let hunterSearches = 0;
    let hunterPagesOpened = 0;
    let hunterHits = 0;
    let hunterFamiliesAdded: string[] = [];
    let hunterEvidence: Array<{ text: string; url: string; host: string; sourceFamily: string; matchedTerms: string[] }> = [];
    let hunterMode: "CORROBORATE" | "COLD_START" | "NONE" = "NONE";
    let exposureAudit: ExposureAuditCoverage[] = [];

    if (matchedTerms.length === 0 && terms.length > 0) {
      const hunter = await huntIndependentEvidence({
        name: searchName,
        theme: lead.theme,
        claimTerms: [],
        existingFamilies: [],
        existingUrls: directUrls,
        maxSearches: 3,
        maxPages: 5,
        allowColdStart: true,
      });
      exposureAudit = mergeExposureAudit(exposureAudit, hunter.exposureAudit);
      hunterMode = hunter.mode;
      hunterSearches += hunter.attemptedSearches;
      hunterPagesOpened += hunter.deepPagesOpened;
      hunterHits += hunter.hits.length;
      hunterFamiliesAdded = [...new Set([...hunterFamiliesAdded, ...hunter.independentFamiliesAdded])];
      hunterEvidence.push(...hunter.hits.map((hit) => ({
        text: normalize(hit.text),
        url: hit.url,
        host: hostOf(hit.url),
        sourceFamily: hit.sourceFamily,
        matchedTerms: hit.matchedTerms,
      })));
      themeEvidence = [...themeEvidence, ...hunterEvidence];
      matchedTerms = [...new Set(themeEvidence.flatMap((item) => item.matchedTerms))];
      sourceFamilies = [...new Set(themeEvidence.map((item) => item.sourceFamily))];
      evidenceUrls = [...new Set(themeEvidence.map((item) => item.url))].slice(0, 10);
    }

    if (matchedTerms.length > 0 && sourceFamilies.length === 1) {
      const hunter = await huntIndependentEvidence({
        name: searchName,
        theme: lead.theme,
        claimTerms: matchedTerms,
        existingFamilies: sourceFamilies,
        existingUrls: [...new Set([...evidenceUrls, ...directUrls])],
        maxSearches: 3,
        maxPages: 5,
      });
      exposureAudit = mergeExposureAudit(exposureAudit, hunter.exposureAudit);
      if (hunterMode === "NONE") hunterMode = hunter.mode;
      hunterSearches += hunter.attemptedSearches;
      hunterPagesOpened += hunter.deepPagesOpened;
      hunterHits += hunter.hits.length;
      hunterFamiliesAdded = [...new Set([...hunterFamiliesAdded, ...hunter.independentFamiliesAdded])];
      const newEvidence = hunter.hits.map((hit) => ({
        text: normalize(hit.text),
        url: hit.url,
        host: hostOf(hit.url),
        sourceFamily: hit.sourceFamily,
        matchedTerms: hit.matchedTerms,
      }));
      hunterEvidence = [...hunterEvidence, ...newEvidence];
      themeEvidence = [...themeEvidence, ...newEvidence];
      matchedTerms = [...new Set(themeEvidence.flatMap((item) => item.matchedTerms))];
      sourceFamilies = [...new Set(themeEvidence.map((item) => item.sourceFamily))];
      evidenceUrls = [...new Set(themeEvidence.map((item) => item.url))].slice(0, 10);
    }

    const highExposureOnly = themeEvidence.length > 0 && themeEvidence.every((item) =>
      GENERIC_HIGH_EXPOSURE.some((term) => item.text.includes(normalize(term)))
    );
    let score = Math.min(100,
      matchedTerms.length * 18 +
      Math.min(48, sourceFamilies.length * 24) +
      Math.min(18, deepEvidence.length * 9) +
      Math.min(12, hunterHits * 6)
    );
    if (highExposureOnly) score = Math.max(0, score - 25);

    const status: IntentEvidenceStatus = score >= 68 && sourceFamilies.length >= 2
      ? "CONFIRMED"
      : score >= 32 ? "PARTIAL" : "UNCONFIRMED";

    const reasons = [
      status === "CONFIRMED"
        ? "Canonical-source research plus entity-specific hunting found identity-bound theme evidence across at least two independent publisher families."
        : status === "PARTIAL"
          ? "Canonical-source research found some identity-bound theme evidence, but independent publisher-family confirmation remains incomplete."
          : "Canonical-source deep research and the independent hunter did not find enough identity-bound theme evidence to confirm the traveler-intent fit.",
    ];
    if (entityId) reasons.push(`Wikidata identity ${entityId} was reused for canonical-source discovery.`);
    if (carriedUrls.length) reasons.push(`Collector carried ${carriedUrls.length} official/canonical source URL(s) directly into intent research.`);
    if (directUrls.length) reasons.push(`Direct source pool contains ${directUrls.length} canonical/official URL(s) for deeper reading.`);
    if (deepEvidence.length) reasons.push(`Deep context verification found entity-bound theme language on ${deepEvidence.length} source page(s).`);
    if (hunterMode === "COLD_START") reasons.push(`Cold-start hunter used the high-precision allowlist for theme ${lead.theme}; generic category membership was not accepted as intent evidence.`);
    if (hunterSearches) reasons.push(`Entity-specific hunter ran ${hunterSearches} targeted search(es) for the same entity.`);
    if (hunterFamiliesAdded.length) reasons.push(`Independent evidence hunter added ${hunterFamiliesAdded.length} new publisher family/families: ${hunterFamiliesAdded.join(", ")}.`);
    else if (hunterSearches) reasons.push("Independent evidence hunter found no qualifying new publisher family inside an identity-matched context window.");
    if (exposureAudit.length) reasons.push(`Exposure audit coverage: ${exposureAudit.map((item) => `${item.family}=${item.status}`).join(", ")}.`);
    if (highExposureOnly) reasons.push("Observed intent language appears only in generic high-exposure tourism framing, so confidence is reduced.");

    const bridgeClaim = matchedTerms.length
      ? `INTENT_EVIDENCE ${lead.theme}: ${matchedTerms.join(", ")} | independent_sources=${sourceFamilies.length} | deep_pages=${deepEvidence.length} | hunter_hits=${hunterHits} | hunter_mode=${hunterMode} | direct_sources=${directUrls.length} | carried_sources=${carriedUrls.length} | status=${status}`
      : `INTENT_EVIDENCE ${lead.theme}: direct_sources=${directUrls.length} | carried_sources=${carriedUrls.length} | hunter_hits=${hunterHits} | hunter_mode=${hunterMode} | status=${status}`;
    const exposureAuditClaims = exposureAudit.map((item) => `EXPOSURE_AUDIT family=${item.family} status=${item.status} opened=${item.opened ? 1 : 0} matched=${item.matched} inspected=${item.inspectedIdentityPages}`);

    const evidenceTrace = traceEvidence(lead, [...deepEvidence, ...hunterEvidence].map((item) => ({
      url: item.url,
      sourceFamily: item.sourceFamily,
      text: item.text,
      matchedTerms: item.matchedTerms,
    })));

    results.push({
      lead: { ...lead, rawClaims: [...lead.rawClaims.filter((claim) => !claim.startsWith("EXPOSURE_AUDIT ")), bridgeClaim, ...exposureAuditClaims], evidenceTrace: [...(lead.evidenceTrace ?? []), ...evidenceTrace] },
      status,
      score,
      matchedTerms,
      evidenceUrls,
      independentSources: sourceFamilies.length,
      queries,
      reasons,
      deepPagesOpened: deep.opened,
      directSourceUrls: directUrls.length,
      carriedSourceUrls: carriedUrls.length,
      hunterSearches,
      hunterPagesOpened,
      hunterHits,
      hunterFamiliesAdded,
      exposureAudit,
    });
  }

  return {
    results,
    leads: results.map((item) => item.lead),
    confirmed: results.filter((item) => item.status === "CONFIRMED"),
    partial: results.filter((item) => item.status === "PARTIAL"),
    unconfirmed: results.filter((item) => item.status === "UNCONFIRMED"),
    lookups,
    deepPagesOpened: results.reduce((sum, item) => sum + item.deepPagesOpened, 0),
    directSourceUrls: results.reduce((sum, item) => sum + item.directSourceUrls, 0),
    carriedSourceUrls: results.reduce((sum, item) => sum + item.carriedSourceUrls, 0),
    hunterSearches: results.reduce((sum, item) => sum + item.hunterSearches, 0),
    hunterPagesOpened: results.reduce((sum, item) => sum + item.hunterPagesOpened, 0),
    hunterHits: results.reduce((sum, item) => sum + item.hunterHits, 0),
    hunterFamiliesAdded: [...new Set(results.flatMap((item) => item.hunterFamiliesAdded))],
    exposureAuditFamilies: [...new Set(results.flatMap((item) => item.exposureAudit.map((audit) => audit.family)))],
    rule: "Focused Intent Evidence V3.3 uses canonical/direct sources first and the trusted entity-specific Hunter for independent discovery. Hunter exposure-audit coverage is carried forward as machine-readable EXPOSURE_AUDIT claims. Legacy Bing RSS search remains removed. Theme language must remain bound to the venue identity in the same local sentence/clause. CONFIRMED still requires score >=68 and at least two independent publisher families; no threshold is relaxed.",
  };
}
