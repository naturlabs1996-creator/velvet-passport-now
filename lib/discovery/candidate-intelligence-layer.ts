import type { ResearchLead } from "./research-collectors";

export type CandidateDecision = "DEEP_RESEARCH" | "TEST" | "HOLD" | "REJECT";
export type CandidateDepth = "0X" | "1X" | "2X" | "6X";

export type CandidateIntelligence = {
  lead: ResearchLead;
  score: number;
  decision: CandidateDecision;
  depth: CandidateDepth;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  dimensions: {
    identity: number;
    themeFit: number;
    evidencePotential: number;
    provenance: number;
    noveltyPotential: number;
    riskPenalty: number;
  };
  positiveSignals: string[];
  negativeSignals: string[];
  unknowns: string[];
};

export type CandidateIntelligenceBatch = {
  selected: ResearchLead[];
  deepResearch: CandidateIntelligence[];
  test: CandidateIntelligence[];
  hold: CandidateIntelligence[];
  rejected: CandidateIntelligence[];
  all: CandidateIntelligence[];
  rule: string;
};

const ICONIC_NAMES = [
  /\blouvre\b/i,
  /tour eiffel|eiffel tower/i,
  /arc de triomphe/i,
  /notre[- ]dame/i,
  /sacr[eé][ -]coeur/i,
  /mus[eé]e d['’]orsay|orsay museum/i,
  /centre pompidou|pompidou centre/i,
  /catacombes de paris|paris catacombs/i,
];

const THEME_CATEGORY_RULES: Record<string, RegExp[]> = {
  "unusual-museums": [/museum|mus[eé]e|house museum|atelier[- ]mus[eé]e/i],
  "beyond-the-classics": [/museum|mus[eé]e|house museum|passage|cultural venue|culturel|galerie/i],
  "quiet-paris": [/garden|jardin|park|parc|square|library|biblioth[eè]que|museum|mus[eé]e/i],
  "secret-gardens": [/garden|jardin|park|parc|square|courtyard|cour/i],
  "forgotten-passages": [/passage|galerie couverte|covered passage|arcade/i],
  "hidden-bookshops": [/bookshop|bookstore|librairie/i],
  "paris-after-dark": [/museum|mus[eé]e|theatre|th[eé][aâ]tre|performing arts|spectacle|concert|opera|op[eé]ra/i],
  "rainy-day-paris": [/museum|mus[eé]e|gallery|galerie|library|biblioth[eè]que|passage|covered|indoor/i],
};

function rawText(lead: ResearchLead) {
  return [lead.name, lead.snippet ?? "", lead.query, ...lead.rawClaims].join(" | ");
}

function hasResolvedIdentity(lead: ResearchLead) {
  return typeof lead.lat === "number" && typeof lead.lon === "number";
}

function hasOfficialSeed(lead: ResearchLead) {
  return lead.sourceType === "OFFICIAL" || lead.rawClaims.some((claim) => /PARIS_DATA_OFFICIAL_VENUE|PARIS_DATA_SOURCE_URL/i.test(claim));
}

function hasStructuredIdentity(lead: ResearchLead) {
  return lead.rawClaims.some((claim) => /WIKIDATA_ENTITY\s+Q\d+|PARIS_DATA_OFFICIAL_VENUE/i.test(claim));
}

function venueCategory(lead: ResearchLead) {
  return lead.rawClaims.map((claim) => claim.match(/^VENUE_POOL_CATEGORY\s+(.+)$/i)?.[1]).find(Boolean) ?? "";
}

function themeCompatible(lead: ResearchLead) {
  const rules = THEME_CATEGORY_RULES[lead.theme];
  if (!rules?.length) return true;
  const text = `${venueCategory(lead)} ${rawText(lead)}`;
  return rules.some((rule) => rule.test(text));
}

function traceFamilies(lead: ResearchLead) {
  return new Set((lead.evidenceTrace ?? []).map((item) => item.independentKey).filter(Boolean));
}

function evaluateCandidate(lead: ResearchLead): CandidateIntelligence {
  const positiveSignals: string[] = [];
  const negativeSignals: string[] = [];
  const unknowns: string[] = [];
  const text = rawText(lead);

  let identity = 0;
  if (hasResolvedIdentity(lead)) { identity += 55; positiveSignals.push("resolved Paris coordinates"); }
  else unknowns.push("resolved physical identity");
  if (hasStructuredIdentity(lead)) { identity += 25; positiveSignals.push("structured entity identity"); }
  if (hasOfficialSeed(lead)) { identity += 20; positiveSignals.push("official discovery seed"); }
  identity = Math.min(100, identity);

  let themeFit = 0;
  if (themeCompatible(lead)) { themeFit = 72; positiveSignals.push("category is compatible with active theme"); }
  else { themeFit = 10; negativeSignals.push("category/theme mismatch"); }
  if (venueCategory(lead)) themeFit = Math.min(100, themeFit + 12);

  const families = traceFamilies(lead);
  let evidencePotential = 20;
  if (lead.snippet && lead.snippet.length >= 45) evidencePotential += 15;
  if (lead.rawClaims.length >= 3) evidencePotential += 15;
  if (families.size >= 1) evidencePotential += 20;
  if (families.size >= 2) evidencePotential += 20;
  if (hasOfficialSeed(lead)) evidencePotential += 10;
  evidencePotential = Math.min(100, evidencePotential);

  let provenance = 15;
  if (lead.sourceType === "OFFICIAL") provenance += 45;
  if (lead.sourceType === "WIKIDATA" || lead.sourceType === "MAP") provenance += 25;
  if (hasStructuredIdentity(lead)) provenance += 20;
  if (families.size >= 1) provenance += 10;
  provenance = Math.min(100, provenance);

  let noveltyPotential = 52;
  if (/house museum|atelier[- ]mus[eé]e|maison[- ]mus[eé]e|specialist|collection|atelier|courtyard|cour|garden|jardin|passage/i.test(text)) {
    noveltyPotential += 16;
    positiveSignals.push("specific experiential or micro-place signal");
  }
  if (ICONIC_NAMES.some((pattern) => pattern.test(lead.name))) {
    noveltyPotential = 8;
    negativeSignals.push("iconic/high-exposure identity prior");
  } else {
    unknowns.push("exact-angle exposure");
  }
  noveltyPotential = Math.max(0, Math.min(100, noveltyPotential));

  let riskPenalty = 0;
  if (!hasResolvedIdentity(lead)) riskPenalty += 28;
  if (!themeCompatible(lead)) riskPenalty += 35;
  if (ICONIC_NAMES.some((pattern) => pattern.test(lead.name))) riskPenalty += 38;
  if (/VENUE_POOL_DISCOVERY_ONLY/i.test(text)) {
    positiveSignals.push("discovery-only seed correctly carries no intent credit");
  }
  riskPenalty = Math.min(100, riskPenalty);

  const score = Math.max(0, Math.min(100, Math.round(
    identity * 0.26 +
    themeFit * 0.24 +
    evidencePotential * 0.18 +
    provenance * 0.14 +
    noveltyPotential * 0.18 -
    riskPenalty * 0.35,
  )));

  let decision: CandidateDecision;
  let depth: CandidateDepth;
  if (!hasResolvedIdentity(lead) || !themeCompatible(lead)) {
    decision = score < 30 ? "REJECT" : "HOLD";
    depth = "0X";
  } else if (score >= 72 && !ICONIC_NAMES.some((pattern) => pattern.test(lead.name))) {
    decision = "DEEP_RESEARCH";
    depth = score >= 84 ? "6X" : "2X";
  } else if (score >= 50) {
    decision = "TEST";
    depth = "1X";
  } else if (score >= 32) {
    decision = "HOLD";
    depth = "0X";
  } else {
    decision = "REJECT";
    depth = "0X";
  }

  const confidence = identity >= 80 && provenance >= 60 ? "HIGH" : identity >= 55 ? "MEDIUM" : "LOW";

  return {
    lead,
    score,
    decision,
    depth,
    confidence,
    dimensions: { identity, themeFit, evidencePotential, provenance, noveltyPotential, riskPenalty },
    positiveSignals,
    negativeSignals,
    unknowns,
  };
}

export function applyCandidateIntelligenceLayer(leads: ResearchLead[], maxDeepCandidates = 12): CandidateIntelligenceBatch {
  const all = leads.map(evaluateCandidate).sort((a, b) => b.score - a.score);
  const deepResearch = all.filter((item) => item.decision === "DEEP_RESEARCH").slice(0, Math.max(1, maxDeepCandidates));
  const overflowDeep = all.filter((item) => item.decision === "DEEP_RESEARCH").slice(Math.max(1, maxDeepCandidates));
  const test = [...all.filter((item) => item.decision === "TEST"), ...overflowDeep.map((item) => ({ ...item, decision: "TEST" as const, depth: "1X" as const, positiveSignals: [...item.positiveSignals, "deep-research budget overflow: downgraded to test"] }))];
  const hold = all.filter((item) => item.decision === "HOLD");
  const rejected = all.filter((item) => item.decision === "REJECT");
  const selected = [...deepResearch, ...test].map((item) => item.lead);

  return {
    selected,
    deepResearch,
    test,
    hold,
    rejected,
    all,
    rule: "Candidate Intelligence is a budget-allocation layer, never a truth gate. It gives zero traveler-intent credit for mere venue existence, rejects obvious category mismatches and unresolved identities early, penalizes iconic/high-exposure priors, preserves uncertainty as HOLD/TEST, and reserves deep research for the strongest candidates. Intent, exposure, access, factual verification and publication remain downstream fail-closed gates.",
  };
}
