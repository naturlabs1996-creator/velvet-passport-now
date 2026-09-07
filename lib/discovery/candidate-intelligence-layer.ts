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
  discriminatingSignals: number;
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

type PeerContext = {
  appearances: number;
  sourceFamilies: number;
  queryVariants: number;
  focusedAppearances: number;
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

// These are not automatic rejects. They are exposure priors that force the candidate
// to earn research budget through entity-specific discriminating signals.
const MAINSTREAM_INSTITUTION_PRIORS = [
  /petit palais/i,
  /mus[eé]e carnavalet|carnavalet/i,
  /mus[eé]e d['’]art moderne de paris/i,
  /palais galliera/i,
  /th[eé][aâ]tre du ch[aâ]telet/i,
];

const SHELL_OR_NON_EXPERIENCE = [
  /^\s*(site internet|website|accueil|home|contact|billetterie|tickets?)\b/i,
  /^\s*(librairie[- ]boutique|boutique|shop)\s*:?[\s]*$/i,
  /^\s*(programme|agenda|actualit[eé]s?|news)\b/i,
  /^\s*[eé]v[eé]nement\b/i,
  /\b(communiqu[eé] de presse|press release)\b/i,
  /:\s*$/,
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

const THEME_HYPOTHESIS_TERMS: Record<string, RegExp[]> = {
  "unusual-museums": [
    /insolite|unusual|atypical|atypique|offbeat|quirky|curiosit[eé]|cabinet de curiosit[eé]s/i,
    /atelier[- ]mus[eé]e|house museum|maison[- ]mus[eé]e|artist.?s studio|atelier d['’]artiste/i,
    /souterrain|underground|[eé]gout|sewer|crypte|arch[eé]olog/i,
    /sp[eé]cialiste|specialist|collection singuli[eè]re|collection unique/i,
  ],
  "beyond-the-classics": [
    /m[eé]connu|less[- ]known|little[- ]known|overlooked|under[- ]the[- ]radar/i,
    /hors des sentiers battus|off the beaten|hidden gem|insolite|unusual|atypique/i,
    /atelier d['’]artiste|atelier[- ]mus[eé]e|house museum|maison[- ]mus[eé]e/i,
    /cour cach[eé]e|courtyard|passage couvert|crypte|souterrain/i,
  ],
  "quiet-paris": [
    /calme|quiet|peaceful|paisible|tranquil|uncrowded|away from crowds|loin de la foule/i,
    /jardin|garden|courtyard|cour int[eé]rieure|clo[iî]tre/i,
  ],
  "secret-gardens": [
    /jardin secret|hidden garden|jardin cach[eé]|cour cach[eé]e|hidden courtyard/i,
    /confidentiel|discret|m[eé]connu|secluded/i,
  ],
  "forgotten-passages": [
    /passage couvert|covered passage|galerie couverte|covered arcade/i,
    /oubli[eé]|forgotten|m[eé]connu|hidden passage|passage secret/i,
  ],
  "hidden-bookshops": [
    /librairie cach[eé]e|hidden bookshop|independent bookshop|librairie ind[eé]pendante/i,
    /rare books|livres rares|antiquarian|bouquiniste/i,
  ],
  "paris-after-dark": [
    /nocturne|late opening|open late|night opening|ouvert.*soir|evening opening/i,
    /soir[eé]e|after dark|night visit|visite de nuit/i,
  ],
  "rainy-day-paris": [
    /indoor|int[eé]rieur|covered|couvert|abrit[eé]/i,
    /passage couvert|galerie couverte|arcade/i,
  ],
};

const MICRO_EXPERIENCE_TERMS = [
  /atelier d['’]artiste|artist.?s studio|atelier[- ]mus[eé]e/i,
  /appartement conserv[eé]|preserved apartment|maison[- ]mus[eé]e|house museum/i,
  /courtyard|cour int[eé]rieure|jardin int[eé]rieur|hidden garden|jardin cach[eé]/i,
  /crypte|souterrain|underground|[eé]gout|sewer/i,
  /cabinet de curiosit[eé]s|cabinet of curiosities/i,
  /passage couvert|covered passage|galerie couverte/i,
];

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function rawText(lead: ResearchLead) {
  return [lead.name, lead.snippet ?? "", ...lead.rawClaims.filter((claim) => !/^(?:VENUE_POOL_CATEGORY|VENUE_POOL_DISCOVERY_ONLY|WIKIDATA_COORDINATES|WIKIDATA_ENTITY|PARIS_DATA_)/i.test(claim))].join(" | ");
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
  const category = venueCategory(lead);
  const text = category || `${lead.name} ${lead.snippet ?? ""}`;
  return rules.some((rule) => rule.test(text));
}

function traceFamilies(lead: ResearchLead) {
  return new Set((lead.evidenceTrace ?? []).map((item) => item.independentKey).filter(Boolean));
}

function canonicalEntity(value: string) {
  return normalize(value)
    .replace(/\b(musee|museum|theatre|bibliotheque|paris|ville|official|site)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPeerContexts(leads: ResearchLead[]) {
  const groups = new Map<string, ResearchLead[]>();
  for (const lead of leads) {
    const key = canonicalEntity(lead.name) || normalize(lead.name);
    const group = groups.get(key) ?? [];
    group.push(lead);
    groups.set(key, group);
  }
  const contexts = new Map<string, PeerContext>();
  for (const [key, group] of groups) {
    const sourceFamilies = new Set(group.map((lead) => lead.independentKey).filter(Boolean)).size;
    const queryVariants = new Set(group.map((lead) => normalize(lead.query)).filter(Boolean)).size;
    const focusedAppearances = group.filter((lead) => !/physical venue pool/i.test(lead.query)).length;
    contexts.set(key, { appearances: group.length, sourceFamilies, queryVariants, focusedAppearances });
  }
  return contexts;
}

function countMatchedPatterns(patterns: RegExp[], text: string) {
  return patterns.filter((pattern) => pattern.test(text)).length;
}

function evaluateCandidate(lead: ResearchLead, peer: PeerContext): CandidateIntelligence {
  const positiveSignals: string[] = [];
  const negativeSignals: string[] = [];
  const unknowns: string[] = [];
  const text = rawText(lead);
  const themePatterns = THEME_HYPOTHESIS_TERMS[lead.theme] ?? [];
  const themeHypotheses = countMatchedPatterns(themePatterns, text);
  const microSignals = countMatchedPatterns(MICRO_EXPERIENCE_TERMS, text);
  const shellLike = SHELL_OR_NON_EXPERIENCE.some((pattern) => pattern.test(lead.name.trim()));
  const iconic = ICONIC_NAMES.some((pattern) => pattern.test(lead.name));
  const mainstreamPrior = MAINSTREAM_INSTITUTION_PRIORS.some((pattern) => pattern.test(lead.name));

  let discriminatingSignals = 0;
  if (themeHypotheses > 0) {
    discriminatingSignals += Math.min(2, themeHypotheses);
    positiveSignals.push(`entity text carries ${themeHypotheses} theme-specific hypothesis signal(s)`);
  }
  if (microSignals > 0) {
    discriminatingSignals += 1;
    positiveSignals.push("specific micro-experience/physical-feature hypothesis");
  }
  if (peer.sourceFamilies >= 2 && peer.focusedAppearances >= 1) {
    discriminatingSignals += 1;
    positiveSignals.push("entity recurs across independent source families");
  }
  if (peer.queryVariants >= 2 && peer.focusedAppearances >= 2) {
    discriminatingSignals += 1;
    positiveSignals.push("entity recurs across focused query variants");
  }

  let identity = 0;
  if (hasResolvedIdentity(lead)) { identity += 55; positiveSignals.push("resolved Paris coordinates"); }
  else unknowns.push("resolved physical identity");
  if (hasStructuredIdentity(lead)) { identity += 25; positiveSignals.push("structured entity identity"); }
  if (hasOfficialSeed(lead)) { identity += 20; positiveSignals.push("official discovery seed"); }
  identity = Math.min(100, identity);

  let themeFit = 0;
  if (themeCompatible(lead)) { themeFit = 55; positiveSignals.push("category is compatible with active theme"); }
  else { themeFit = 5; negativeSignals.push("category/theme mismatch"); }
  if (themeHypotheses > 0) themeFit += Math.min(35, themeHypotheses * 18);
  themeFit = Math.min(100, themeFit);

  const families = traceFamilies(lead);
  let evidencePotential = 12;
  if (lead.snippet && lead.snippet.length >= 45) evidencePotential += 8;
  if (families.size >= 1) evidencePotential += 12;
  if (families.size >= 2) evidencePotential += 18;
  if (peer.sourceFamilies >= 2) evidencePotential += 20;
  if (peer.queryVariants >= 2) evidencePotential += 14;
  if (themeHypotheses > 0) evidencePotential += 12;
  evidencePotential = Math.min(100, evidencePotential);

  let provenance = 10;
  if (lead.sourceType === "OFFICIAL") provenance += 35;
  if (lead.sourceType === "WIKIDATA" || lead.sourceType === "MAP") provenance += 20;
  if (lead.sourceType === "EDITORIAL") provenance += 18;
  if (hasStructuredIdentity(lead)) provenance += 15;
  if (families.size >= 1) provenance += 10;
  provenance = Math.min(100, provenance);

  // Start low: novelty must be earned. A valid official venue is not inherently Velvet.
  let noveltyPotential = 12;
  noveltyPotential += Math.min(42, themeHypotheses * 18);
  noveltyPotential += Math.min(22, microSignals * 16);
  if (peer.sourceFamilies >= 2 && peer.focusedAppearances > 0) noveltyPotential += 12;
  if (peer.queryVariants >= 2 && peer.focusedAppearances >= 2) noveltyPotential += 10;
  if (iconic) {
    noveltyPotential = Math.min(noveltyPotential, 5);
    negativeSignals.push("iconic/high-exposure identity prior");
  } else if (mainstreamPrior) {
    noveltyPotential = Math.max(0, noveltyPotential - 18);
    negativeSignals.push("mainstream-institution exposure prior; must earn intent budget");
  } else {
    unknowns.push("exact-angle exposure");
  }
  noveltyPotential = Math.max(0, Math.min(100, noveltyPotential));

  let riskPenalty = 0;
  if (!hasResolvedIdentity(lead)) riskPenalty += 30;
  if (!themeCompatible(lead)) riskPenalty += 38;
  if (iconic) riskPenalty += 52;
  if (mainstreamPrior) riskPenalty += 18;
  if (shellLike) {
    riskPenalty += 70;
    negativeSignals.push("navigation/event/shop shell rather than a stable traveler experience");
  }
  if (hasOfficialSeed(lead) && discriminatingSignals === 0) {
    riskPenalty += 18;
    negativeSignals.push("official identity without any discriminating Velvet hypothesis");
  }
  if (/VENUE_POOL_DISCOVERY_ONLY/i.test(lead.rawClaims.join(" | "))) {
    positiveSignals.push("discovery-only seed carries zero intent truth credit");
  }
  riskPenalty = Math.min(100, riskPenalty);

  const score = Math.max(0, Math.min(100, Math.round(
    identity * 0.16 +
    themeFit * 0.20 +
    evidencePotential * 0.18 +
    provenance * 0.10 +
    noveltyPotential * 0.36 -
    riskPenalty * 0.42,
  )));

  let decision: CandidateDecision;
  let depth: CandidateDepth;
  if (shellLike || !hasResolvedIdentity(lead) || !themeCompatible(lead)) {
    decision = score < 28 || shellLike ? "REJECT" : "HOLD";
    depth = "0X";
  } else if (discriminatingSignals >= 3 && score >= 74 && !iconic) {
    decision = "DEEP_RESEARCH";
    depth = discriminatingSignals >= 4 && score >= 84 ? "6X" : "2X";
  } else if (discriminatingSignals >= 2 && score >= 60 && !iconic) {
    decision = "DEEP_RESEARCH";
    depth = "2X";
  } else if (discriminatingSignals >= 1 && score >= 42 && !iconic) {
    decision = "TEST";
    depth = "1X";
  } else if (score >= 24) {
    decision = "HOLD";
    depth = "0X";
  } else {
    decision = "REJECT";
    depth = "0X";
  }

  const confidence = discriminatingSignals >= 2 && identity >= 80 ? "HIGH" : identity >= 55 || discriminatingSignals >= 1 ? "MEDIUM" : "LOW";

  return {
    lead,
    score,
    decision,
    depth,
    confidence,
    dimensions: { identity, themeFit, evidencePotential, provenance, noveltyPotential, riskPenalty },
    discriminatingSignals,
    positiveSignals,
    negativeSignals,
    unknowns,
  };
}

export function applyCandidateIntelligenceLayer(leads: ResearchLead[], maxDeepCandidates = 12): CandidateIntelligenceBatch {
  const peers = buildPeerContexts(leads);
  const all = leads
    .map((lead) => evaluateCandidate(lead, peers.get(canonicalEntity(lead.name) || normalize(lead.name)) ?? { appearances: 1, sourceFamilies: 1, queryVariants: 1, focusedAppearances: 0 }))
    .sort((a, b) => b.score - a.score || b.discriminatingSignals - a.discriminatingSignals);

  // Deep budget is intentionally tighter than the downstream lookup ceiling. Valid identity alone
  // cannot fill the research queue. The queue must be won through discriminating signals.
  const deepCap = Math.max(2, Math.min(maxDeepCandidates, 8));
  const testCap = Math.max(2, Math.min(Math.ceil(maxDeepCandidates / 2), 6));
  const deepResearch = all.filter((item) => item.decision === "DEEP_RESEARCH").slice(0, deepCap);
  const overflowDeep = all.filter((item) => item.decision === "DEEP_RESEARCH").slice(deepCap);
  const nativeTest = all.filter((item) => item.decision === "TEST");
  const test = [...nativeTest, ...overflowDeep.map((item) => ({ ...item, decision: "TEST" as const, depth: "1X" as const, positiveSignals: [...item.positiveSignals, "deep-research budget overflow: downgraded to test"] }))].slice(0, testCap);
  const selectedIds = new Set([...deepResearch, ...test].map((item) => item.lead.id));
  const hold = all.filter((item) => item.decision === "HOLD" || ((item.decision === "TEST" || item.decision === "DEEP_RESEARCH") && !selectedIds.has(item.lead.id)));
  const rejected = all.filter((item) => item.decision === "REJECT");
  const selected = [...deepResearch, ...test].map((item) => item.lead);

  return {
    selected,
    deepResearch,
    test,
    hold,
    rejected,
    all,
    rule: "Candidate Intelligence is a budget-allocation layer, never a truth gate. Identity/provenance establish that an entity is researchable but cannot by themselves earn deep research. A candidate must show discriminating theme/micro-experience or independent recurrence signals to receive 1X/2X/6X budget. Obvious navigation/event/shop shells are rejected early; mainstream/iconic identities are penalized; uncertain valid venues remain HOLD. Intent, exposure, access, factual verification and publication remain downstream fail-closed gates.",
  };
}
