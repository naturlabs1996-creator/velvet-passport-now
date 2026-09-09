import type { ResearchLead } from "./research-collectors";

export type ExposureLevel = "LOW" | "MODERATE" | "HIGH" | "MASS_TOURISM" | "UNKNOWN";
export type ExposureScope = "EXACT_ANGLE" | "ENTITY_ONLY" | "UNKNOWN";
export type ExposureVerdict = "PASS" | "EXCEPTION_REVIEW" | "FAIL" | "HOLD_UNKNOWN";
export type ExposureAuditStatus = "EXPOSED" | "CHECKED_NO_ANGLE" | "UNAVAILABLE";

export type ExposureSignal = {
  family: string;
  kind: "OFFICIAL_TOURISM" | "TRAVEL_EDITORIAL" | "MARKETPLACE" | "MASS_LANGUAGE" | "ENTITY_FAME";
  scope: "EXACT_ANGLE" | "ENTITY";
  weight: number;
  note: string;
};

export type ExposureAuditCoverage = {
  family: string;
  status: ExposureAuditStatus;
  opened: boolean;
  matched: number;
  inspectedIdentityPages: number;
  officialTourism: boolean;
};

export type ExposureResult = {
  lead: ResearchLead;
  level: ExposureLevel;
  score: number;
  exposureDegree: number | null;
  entityExposureScore: number;
  exactAngleExposureScore: number | null;
  scope: ExposureScope;
  verdict: ExposureVerdict;
  signals: string[];
  trace: ExposureSignal[];
  sourceFamilies: string[];
  auditCoverage: ExposureAuditCoverage[];
  auditedFamilies: number;
  officialTourismAudited: number;
  auditCoveragePass: boolean;
};

const MASS_TERMS = ["eiffel tower", "louvre museum", "musée du louvre", "arc de triomphe", "champs-élysées", "disneyland paris"];
const OFFICIAL_TOURISM_HOSTS = ["parisjetaime.com", "visitparisregion.com", "france.fr"];
const TRAVEL_EDITORIAL_HOSTS = ["sortiraparis.com", "parissecret.com", "timeout.com", "lonelyplanet.com", "cntraveler.com", "travelandleisure.com", "atlasobscura.com"];
const MARKETPLACE_HOSTS = ["tripadvisor.com", "getyourguide.com", "viator.com"];
const MASS_LANGUAGE = /top 10|top 15|must-see|must see|most visited|iconic|world-famous|world famous|incontournable|les plus visit[eé]s/i;
const MIN_AUDITED_FAMILIES_FOR_PASS = 3;
const MIN_OFFICIAL_TOURISM_FAMILIES_FOR_PASS = 1;

const THEME_ANGLE_TERMS: Record<string, RegExp[]> = {
  "beyond-the-classics": [/insolite|unusual|atypique|offbeat|hors des sentiers battus|off the beaten|m[eé]connu|less[- ]known|hidden gem|discret|dissimul/i],
  "unusual-museums": [/mus[eé]e insolite|unusual museum|atypique|quirky|offbeat|cabinet de curiosit[eé]s|souterrain|underground|[eé]gout|sewer|crypte/i],
  "quiet-paris": [/quiet|calm|peaceful|paisible|tranquil|uncrowded|away from crowds|loin de la foule/i],
  "secret-gardens": [/hidden garden|jardin cach[eé]|jardin secret|cour cach[eé]e|hidden courtyard|secluded/i],
  "forgotten-passages": [/covered passage|passage couvert|galerie couverte|forgotten passage|passage oubli[eé]|passage m[eé]connu|hidden passage/i],
  "hidden-bookshops": [/hidden bookshop|librairie cach[eé]e|independent bookshop|librairie ind[eé]pendante|rare books|livres rares/i],
  "paris-after-dark": [/nocturne|late opening|open late|night opening|after dark|night visit|visite de nuit|ouvert.*soir/i],
  "rainy-day-paris": [/indoor|int[eé]rieur|covered|couvert|abrit[eé]|passage couvert|galerie couverte/i],
};

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return "unknown"; }
}
function familyMatches(host: string, family: string) {
  return host === family || host.endsWith(`.${family}`);
}
function isOfficialTourismFamily(family: string) {
  return OFFICIAL_TOURISM_HOSTS.some((official) => familyMatches(family, official));
}
function sourceKind(host: string): ExposureSignal["kind"] | null {
  if (OFFICIAL_TOURISM_HOSTS.some((family) => familyMatches(host, family))) return "OFFICIAL_TOURISM";
  if (TRAVEL_EDITORIAL_HOSTS.some((family) => familyMatches(host, family))) return "TRAVEL_EDITORIAL";
  if (MARKETPLACE_HOSTS.some((family) => familyMatches(host, family))) return "MARKETPLACE";
  return null;
}
function sourceWeight(kind: ExposureSignal["kind"]) {
  if (kind === "OFFICIAL_TOURISM") return 38;
  if (kind === "MARKETPLACE") return 30;
  if (kind === "TRAVEL_EDITORIAL") return 24;
  if (kind === "MASS_LANGUAGE") return 18;
  return 0;
}
function exactAngleMatched(theme: string, text: string) {
  const patterns = THEME_ANGLE_TERMS[theme] ?? [];
  return patterns.some((pattern) => pattern.test(text));
}
function evidenceRows(lead: ResearchLead) {
  return (lead.evidenceTrace ?? []).map((entry) => ({
    host: hostOf(entry.url),
    family: (entry.independentKey || hostOf(entry.url)).toLowerCase(),
    text: normalize([entry.title, ...(entry.claims ?? [])].filter(Boolean).join(" ")),
  }));
}
function parseAuditCoverage(lead: ResearchLead) {
  const rank: Record<ExposureAuditStatus, number> = { UNAVAILABLE: 0, CHECKED_NO_ANGLE: 1, EXPOSED: 2 };
  const coverage = new Map<string, ExposureAuditCoverage>();
  for (const claim of lead.rawClaims) {
    const match = claim.match(/^EXPOSURE_AUDIT\s+family=([^\s]+)\s+status=(EXPOSED|CHECKED_NO_ANGLE|UNAVAILABLE)\s+opened=(0|1)\s+matched=(\d+)\s+inspected=(\d+)$/i);
    if (!match) continue;
    const family = match[1].toLowerCase();
    const status = match[2].toUpperCase() as ExposureAuditStatus;
    const row: ExposureAuditCoverage = {
      family,
      status,
      opened: match[3] === "1",
      matched: Number(match[4]),
      inspectedIdentityPages: Number(match[5]),
      officialTourism: isOfficialTourismFamily(family),
    };
    const existing = coverage.get(family);
    if (!existing || rank[row.status] > rank[existing.status]) coverage.set(family, row);
  }
  return [...coverage.values()];
}

export function scoreExposure(lead: ResearchLead): ExposureResult {
  const entityText = normalize([lead.name, lead.snippet, lead.url, lead.publisher, ...lead.rawClaims].filter(Boolean).join(" "));
  const trace: ExposureSignal[] = [];

  let entityExposureScore = 0;
  if (MASS_TERMS.some((term) => entityText.includes(normalize(term)))) {
    entityExposureScore += 80;
    trace.push({ family: "entity-prior", kind: "ENTITY_FAME", scope: "ENTITY", weight: 80, note: "Mass-tourism entity prior detected; exact-angle exposure still requires separate evidence." });
  }
  if (MASS_LANGUAGE.test(entityText)) {
    entityExposureScore += 18;
    trace.push({ family: "entity-language", kind: "MASS_LANGUAGE", scope: "ENTITY", weight: 18, note: "High-exposure language appears in entity-level material." });
  }
  entityExposureScore = Math.max(0, Math.min(100, entityExposureScore));

  const angleFamilies = new Set<string>();
  let exactAngleExposureScore = 0;

  for (const row of evidenceRows(lead)) {
    const kind = sourceKind(row.host);
    if (!kind || !exactAngleMatched(lead.theme, row.text)) continue;
    const weight = sourceWeight(kind);
    angleFamilies.add(row.family);
    exactAngleExposureScore += weight;
    trace.push({ family: row.family, kind, scope: "EXACT_ANGLE", weight, note: `${kind} source exposes the active Velvet angle, not merely the place identity.` });
    if (MASS_LANGUAGE.test(row.text)) {
      exactAngleExposureScore += 18;
      trace.push({ family: row.family, kind: "MASS_LANGUAGE", scope: "EXACT_ANGLE", weight: 18, note: "Mass/listicle language is attached to the exact angle." });
    }
  }

  const rawAngle = normalize(lead.rawClaims.filter((claim) => /INTENT_EVIDENCE|DEEP_EVIDENCE|HUNTER|SOURCE/i.test(claim)).join(" "));
  if (rawAngle && exactAngleMatched(lead.theme, rawAngle)) {
    const rawHosts = [...new Set((lead.evidenceTrace ?? []).map((entry) => hostOf(entry.url)).filter((host) => sourceKind(host)))];
    for (const host of rawHosts) {
      if (angleFamilies.has(host)) continue;
      const kind = sourceKind(host);
      if (!kind) continue;
      const weight = Math.round(sourceWeight(kind) * 0.75);
      angleFamilies.add(host);
      exactAngleExposureScore += weight;
      trace.push({ family: host, kind, scope: "EXACT_ANGLE", weight, note: "Focused intent/deep-evidence claim is bound to a tourism-facing source family." });
    }
  }

  const auditCoverage = parseAuditCoverage(lead);
  const audited = auditCoverage.filter((item) => item.status === "EXPOSED" || item.status === "CHECKED_NO_ANGLE");
  const auditedFamilies = new Set(audited.map((item) => item.family)).size;
  const officialTourismAudited = new Set(audited.filter((item) => item.officialTourism).map((item) => item.family)).size;
  const auditCoveragePass = auditedFamilies >= MIN_AUDITED_FAMILIES_FOR_PASS && officialTourismAudited >= MIN_OFFICIAL_TOURISM_FAMILIES_FOR_PASS;

  const hasExactAngleEvidence = angleFamilies.size > 0;
  const boundedExact = Math.max(0, Math.min(100, exactAngleExposureScore));
  const exposureDegree = hasExactAngleEvidence ? Math.round((10 - boundedExact / 10) * 10) / 10 : null;
  const score = hasExactAngleEvidence ? boundedExact : 0;
  const level: ExposureLevel = !hasExactAngleEvidence ? "UNKNOWN" : score >= 80 ? "MASS_TOURISM" : score >= 55 ? "HIGH" : score >= 30 ? "MODERATE" : "LOW";
  const scope: ExposureScope = hasExactAngleEvidence ? "EXACT_ANGLE" : entityExposureScore > 0 ? "ENTITY_ONLY" : "UNKNOWN";

  let verdict: ExposureVerdict;
  if (exposureDegree !== null && exposureDegree < 6.5) verdict = "FAIL";
  else if (exposureDegree === null || !auditCoveragePass) verdict = "HOLD_UNKNOWN";
  else if (exposureDegree >= 7) verdict = "PASS";
  else verdict = "EXCEPTION_REVIEW";

  const signals = [
    ...trace.map((item) => `${item.scope}:${item.kind}:${item.family} (${item.weight}) ${item.note}`),
    ...auditCoverage.map((item) => `AUDIT:${item.family}:${item.status} opened=${item.opened ? 1 : 0} matched=${item.matched} inspected=${item.inspectedIdentityPages}${item.officialTourism ? " official-tourism" : ""}`),
  ];
  if (!auditCoveragePass && verdict !== "FAIL") signals.push(`AUDIT_GATE:HOLD audited_families=${auditedFamilies}/${MIN_AUDITED_FAMILIES_FOR_PASS} official_tourism=${officialTourismAudited}/${MIN_OFFICIAL_TOURISM_FAMILIES_FOR_PASS}`);

  const claim = `EXPOSURE_EVIDENCE scope=${scope} level=${level} exactScore=${hasExactAngleEvidence ? score : "UNKNOWN"} degree=${exposureDegree ?? "UNKNOWN"} entityScore=${entityExposureScore} verdict=${verdict} families=${angleFamilies.size} audited=${auditedFamilies} official_audited=${officialTourismAudited} coverage=${auditCoveragePass ? "PASS" : "HOLD"}`;

  return {
    lead: { ...lead, rawClaims: [...lead.rawClaims.filter((item) => !item.startsWith("EXPOSURE_EVIDENCE ")), claim] },
    level,
    score,
    exposureDegree,
    entityExposureScore,
    exactAngleExposureScore: hasExactAngleEvidence ? score : null,
    scope,
    verdict,
    signals,
    trace,
    sourceFamilies: [...angleFamilies],
    auditCoverage,
    auditedFamilies,
    officialTourismAudited,
    auditCoveragePass,
  };
}

export function applyExposureIntelligence(leads: ResearchLead[]) {
  const results = leads.map(scoreExposure);
  return {
    results,
    leads: results.map((item) => item.lead),
    pass: results.filter((item) => item.verdict === "PASS").length,
    exceptionReview: results.filter((item) => item.verdict === "EXCEPTION_REVIEW").length,
    fail: results.filter((item) => item.verdict === "FAIL").length,
    holdUnknown: results.filter((item) => item.verdict === "HOLD_UNKNOWN").length,
    auditCoveragePass: results.filter((item) => item.auditCoveragePass).length,
    low: results.filter((item) => item.level === "LOW").length,
    moderate: results.filter((item) => item.level === "MODERATE").length,
    high: results.filter((item) => item.level === "HIGH").length,
    massTourism: results.filter((item) => item.level === "MASS_TOURISM").length,
    unknown: results.filter((item) => item.level === "UNKNOWN").length,
    rule: "Velvet Exposure Degree is evaluated under the exact traveler angle. Entity fame is contextual only. A positive exposure signal can FAIL a candidate immediately when degree <6.5. PASS or EXCEPTION_REVIEW additionally requires traceable audit coverage across at least three publisher families and at least one official-tourism family (Paris je t'aime, Visit Paris Region, or equivalent). EXPOSED and CHECKED_NO_ANGLE count as audited; UNAVAILABLE never counts as silence. Missing or insufficient audit coverage is HOLD_UNKNOWN, never silently treated as low exposure. Normal PASS requires Exposure Degree >=7/10; 6.5-6.9 is EXCEPTION_REVIEW only.",
  };
}
