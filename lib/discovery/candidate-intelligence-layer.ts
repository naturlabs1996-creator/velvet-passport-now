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
    interestPotential: number;
    exposureOpportunity: number;
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

// Entity-level fame is only an exposure prior. Velvet doctrine evaluates exposure
// under the exact traveler angle, so a famous institution can still contain a strong
// underexposed layer (after-hours access, consultation procedure, private room, reserve, etc.).
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
  /atelier d['’]artiste|artist.?s studio|atelier[- ]mus[eé]e|working atelier|working workshop/i,
  /appartement conserv[eé]|preserved apartment|maison[- ]mus[eé]e|house museum/i,
  /courtyard|cour int[eé]rieure|seconde? cour|second courtyard|jardin int[eé]rieur|hidden garden|jardin cach[eé]/i,
  /crypte|souterrain|underground|[eé]gout|sewer|infrastructure/i,
  /cabinet de curiosit[eé]s|cabinet of curiosities|private collection/i,
  /passage couvert|covered passage|galerie couverte/i,
  /archives?|reserve?s?|storage|conservation/i,
];

// Signals that the candidate may contain an exact-angle "Uncovered layer" rather than
// merely being a less famous venue. These are research hypotheses, never proof of low exposure.
const EXACT_ANGLE_LAYER_TERMS = [
  /after closing|after[- ]hours|apr[eè]s la fermeture|hors horaires|nocturne/i,
  /by appointment|sur rendez[- ]vous|appointment required|advance booking/i,
  /consultation room|salle de consultation|request an original|demander.*original/i,
  /small salon|petit salon|private room|salon priv[eé]|sur demande|on request/i,
  /second courtyard|seconde? cour|deuxi[eè]me cour|behind the door|derri[eè]re.*porte/i,
  /rare opening|ouverture exceptionnelle|exceptional opening/i,
  /working atelier|working workshop|atelier.*travail|atelier en activit[eé]/i,
  /reserve?s?|storage|archives?|documentation centre|centre de documentation/i,
  /underground|souterrain|service street|galerie souterraine|infrastructure/i,
  /specialist visit|visite sp[eé]cialiste|small group|petit groupe/i,
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
  const exactAngleSignals = countMatchedPatterns(EXACT_ANGLE_LAYER_TERMS, text);
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
  if (exactAngleSignals > 0) {
    discriminatingSignals += Math.min(2, exactAngleSignals);
    positiveSignals.push(`exact-angle Uncovered-layer hypothesis (${exactAngleSignals} signal(s))`);
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
  if (exactAngleSignals > 0) evidencePotential += 10;
  evidencePotential = Math.min(100, evidencePotential);

  let provenance = 10;
  if (lead.sourceType === "OFFICIAL") provenance += 35;
  if (lead.sourceType === "WIKIDATA" || lead.sourceType === "MAP") provenance += 20;
  if (lead.sourceType === "EDITORIAL") provenance += 18;
  if (hasStructuredIdentity(lead)) provenance += 15;
  if (families.size >= 1) provenance += 10;
  provenance = Math.min(100, provenance);

  // Mother axis #1: intrinsic interest. Obscurity alone earns nothing.
  let interestPotential = 10;
  interestPotential += Math.min(34, themeHypotheses * 16);
  interestPotential += Math.min(26, microSignals * 16);
  interestPotential += Math.min(24, exactAngleSignals * 12);
  if (peer.sourceFamilies >= 2 && peer.focusedAppearances > 0) interestPotential += 8;
  if (peer.queryVariants >= 2 && peer.focusedAppearances >= 2) interestPotential += 6;
  interestPotential = Math.max(0, Math.min(100, interestPotential));

  // Mother axis #2: low-exposure opportunity under the exact angle.
  // This is deliberately a PRIOR used to allocate research budget, not an Exposure Degree.
  // The downstream Exposure engine must still verify the tourism ecosystem and fail closed.
  let exposureOpportunity = 35;
  exposureOpportunity += Math.min(36, exactAngleSignals * 18);
  exposureOpportunity += Math.min(14, microSignals * 7);
  if (themeHypotheses > 0) exposureOpportunity += Math.min(10, themeHypotheses * 5);
  if (iconic) {
    exposureOpportunity -= exactAngleSignals > 0 ? 18 : 38;
    negativeSignals.push("iconic entity exposure prior; exact-angle exposure must be independently verified");
  } else if (mainstreamPrior) {
    exposureOpportunity -= exactAngleSignals > 0 ? 10 : 22;
    negativeSignals.push("mainstream institution exposure prior; exact-angle exposure must be independently verified");
  }
  exposureOpportunity = Math.max(0, Math.min(100, exposureOpportunity));
  unknowns.push("verified exact-angle Exposure Degree");

  // Compatibility field retained for downstream diagnostics; now reflects the two Velvet mother axes
  // rather than treating entity fame as a synonym for novelty.
  const noveltyPotential = Math.max(0, Math.min(100, Math.round(
    interestPotential * 0.46 + exposureOpportunity * 0.54,
  )));

  let riskPenalty = 0;
  if (!hasResolvedIdentity(lead)) riskPenalty += 30;
  if (!themeCompatible(lead)) riskPenalty += 38;
  if (iconic) riskPenalty += exactAngleSignals > 0 ? 8 : 20;
  if (mainstreamPrior) riskPenalty += exactAngleSignals > 0 ? 4 : 12;
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

  // Exposure opportunity is the largest positive weight. It cannot prove low exposure; it decides
  // where to spend research budget. Verified Exposure Degree remains a downstream mandatory gate.
  const score = Math.max(0, Math.min(100, Math.round(
    identity * 0.10 +
    themeFit * 0.12 +
    evidencePotential * 0.13 +
    provenance * 0.07 +
    interestPotential * 0.23 +
    exposureOpportunity * 0.35 -
    riskPenalty * 0.38,
  )));

  let decision: CandidateDecision;
  let depth: CandidateDepth;
  if (shellLike || !hasResolvedIdentity(lead) || !themeCompatible(lead)) {
    decision = score < 28 || shellLike ? "REJECT" : "HOLD";
    depth = "0X";
  } else if (discriminatingSignals >= 4 && interestPotential >= 58 && exposureOpportunity >= 48 && score >= 68) {
    decision = "DEEP_RESEARCH";
    depth = discriminatingSignals >= 5 && score >= 78 ? "6X" : "2X";
  } else if (discriminatingSignals >= 2 && interestPotential >= 45 && exposureOpportunity >= 38 && score >= 52) {
    decision = "DEEP_RESEARCH";
    depth = "2X";
  } else if (discriminatingSignals >= 1 && interestPotential >= 34 && exposureOpportunity >= 28 && score >= 38) {
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
    dimensions: { identity, themeFit, evidencePotential, provenance, interestPotential, exposureOpportunity, noveltyPotential, riskPenalty },
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
    .sort((a, b) => b.score - a.score || b.dimensions.exposureOpportunity - a.dimensions.exposureOpportunity || b.discriminatingSignals - a.discriminatingSignals);

  // Deep budget is intentionally tighter than the downstream lookup ceiling. Valid identity alone
  // cannot fill the research queue. The queue must be won through intrinsic interest plus a credible
  // exact-angle low-exposure opportunity worth verifying.
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
    rule: "Velvet Candidate Intelligence allocates research budget around two mother axes: intrinsic Interest and exact-angle low-Exposure opportunity, with Exposure opportunity dominant. Entity fame is only a prior: an iconic or mainstream place may still deserve research when a precise underexposed layer is hypothesized (after-hours access, consultation procedure, private room, reserve, second courtyard, working infrastructure, etc.). Obscure alone is never good. This layer never declares Exposure truth and never LOCKs a candidate: verified exact-angle Exposure Degree remains a mandatory downstream fail-closed gate, normally targeting >=7/10 in Velvet's favor, with ~6.5 reserved for exceptional experiences with strong access. Intent, Access, Trust, micro-localization, factual verification and publication remain downstream gates.",
  };
}
