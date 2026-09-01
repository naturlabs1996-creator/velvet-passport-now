import type { ResearchLead } from "./research-collectors";

export type RelevanceDecision = "ACCEPT" | "REJECT";

export type RelevanceScore = {
  leadId: string;
  decision: RelevanceDecision;
  total: number;
  geography: number;
  intent: number;
  velvetUtility: number;
  reasons: string[];
};

const THEME_TERMS: Record<string, string[]> = {
  "beyond-the-classics": ["hidden", "unusual", "less known", "off the beaten", "courtyard", "passage", "garden", "small museum", "bookshop", "atelier", "covered passage", "discreet"],
  "quiet-paris": ["quiet", "calm", "peaceful", "garden", "courtyard", "library", "bookshop", "passage", "square", "cloister"],
  "secret-gardens": ["garden", "jardin", "courtyard", "cour", "square", "green", "park"],
  "forgotten-passages": ["passage", "covered passage", "galerie", "arcade", "courtyard"],
  "hidden-bookshops": ["bookshop", "bookstore", "librairie", "books", "literary"],
  "unusual-museums": ["museum", "musée", "collection", "cabinet", "house museum"],
  "paris-after-dark": ["night", "evening", "late", "after dark", "nocturne", "nightlife", "illuminated"],
  "rainy-day-paris": ["indoor", "museum", "gallery", "bookshop", "covered passage", "arcade", "tea room", "café"],
};

const TOURIST_TRAP_TERMS = ["eiffel tower", "louvre museum", "arc de triomphe", "disneyland paris", "champs-élysées"];
const VELVET_TERMS = ["courtyard", "passage", "garden", "bookshop", "small museum", "atelier", "historic", "literary", "discreet", "unusual", "hidden", "local", "quiet", "independent"];
const HIGH_EXPOSURE_SOURCES = ["parisjetaime.com"];

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function textOf(lead: ResearchLead) {
  return normalize([lead.name, lead.snippet, lead.address, ...lead.rawClaims].filter(Boolean).join(" "));
}

function lexicalTextOf(lead: ResearchLead) {
  return normalize([lead.name, lead.snippet, lead.address, ...lead.rawClaims.filter((claim) => !claim.startsWith("INTENT_EVIDENCE ") && !claim.startsWith("HISTORY_EVIDENCE:"))].filter(Boolean).join(" "));
}

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(normalize(term)));
}

function sourceHost(lead: ResearchLead) {
  try { return new URL(lead.url).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return lead.publisher.toLowerCase().replace(/^www\./, ""); }
}

function isHighExposureSource(lead: ResearchLead) {
  const host = sourceHost(lead);
  return HIGH_EXPOSURE_SOURCES.some((source) => host === source || host.endsWith(`.${source}`) || lead.publisher.toLowerCase().includes(source));
}

function geographyScore(lead: ResearchLead, text: string) {
  let score = 0;
  if (typeof lead.lat === "number" && typeof lead.lon === "number") score += 45;
  if (lead.address && /paris|75\d{3}|arrondissement/i.test(lead.address)) score += 35;
  if (/paris, france|paris france|\b\d{1,2}(?:st|nd|rd|th)? arrondissement\b|montmartre|marais|saint-germain|latin quarter|rive gauche|rive droite|opera|opéra/i.test(text)) score += 30;
  return Math.min(100, score);
}

type IntentEvidenceState = "NONE" | "CONFIRMED" | "PARTIAL" | "UNCONFIRMED";

function intentEvidenceState(lead: ResearchLead): IntentEvidenceState {
  const claims = lead.rawClaims.filter((claim) => claim.startsWith(`INTENT_EVIDENCE ${lead.theme}:`));
  if (!claims.length) return "NONE";
  if (claims.some((claim) => /status=CONFIRMED/.test(claim))) return "CONFIRMED";
  if (claims.some((claim) => /status=PARTIAL/.test(claim))) return "PARTIAL";
  return "UNCONFIRMED";
}

function intentScore(lead: ResearchLead) {
  const evidenceState = intentEvidenceState(lead);
  if (evidenceState === "CONFIRMED") return 75;
  if (evidenceState === "PARTIAL") return 30;
  if (evidenceState === "UNCONFIRMED") return 0;

  const terms = THEME_TERMS[lead.theme] ?? [];
  if (!terms.length) return 50;
  const text = lexicalTextOf(lead);
  const matches = terms.filter((term) => text.includes(normalize(term))).length;
  return matches === 0 ? 0 : Math.min(100, 35 + matches * 20);
}

function velvetUtilityScore(lead: ResearchLead, text: string) {
  let score = 25;
  const matches = VELVET_TERMS.filter((term) => text.includes(normalize(term))).length;
  score += Math.min(60, matches * 12);
  if (hasAny(text, TOURIST_TRAP_TERMS)) score -= 45;
  // Paris je t'aime is useful for factual corroboration, but a place surfaced there is
  // usually already in a highly exposed official-tourism discovery channel. Treat that
  // as a strong negative Velvet-scarcity signal, not an absolute factual-source ban.
  if (isHighExposureSource(lead)) score -= 35;
  return Math.max(0, Math.min(100, score));
}

export function scoreResearchLeadRelevance(lead: ResearchLead): RelevanceScore {
  const text = textOf(lead);
  const geography = geographyScore(lead, text);
  const intent = intentScore(lead);
  const velvetUtility = velvetUtilityScore(lead, text);
  const total = Math.round(geography * 0.35 + intent * 0.45 + velvetUtility * 0.2);
  const reasons: string[] = [];
  const evidenceState = intentEvidenceState(lead);

  if (geography < 45) reasons.push("Paris-France anchor is too weak for a research candidate.");
  if (intent < 35) reasons.push("Candidate does not match the active traveler intent strongly enough.");
  if (velvetUtility < 25) reasons.push("Candidate is too generic, too exposed or tourist-dominant for the Velvet discovery layer.");
  if (isHighExposureSource(lead)) reasons.push("Paris je t'aime / official tourism exposure is a strong negative Velvet-scarcity signal; retain only if independent evidence shows a genuinely distinctive angle.");
  if (evidenceState === "CONFIRMED") reasons.push("Focused Intent Evidence explicitly confirms the theme-place relationship.");
  else if (evidenceState === "PARTIAL") reasons.push("Focused Intent Evidence is only partial, so it cannot satisfy the relevance acceptance threshold yet.");
  else if (evidenceState === "UNCONFIRMED") reasons.push("Focused Intent Evidence explicitly failed to confirm this theme-place relationship; lexical matches are ignored.");

  const decision: RelevanceDecision = geography >= 45 && intent >= 35 && velvetUtility >= 25 && total >= 50 ? "ACCEPT" : "REJECT";
  if (decision === "ACCEPT") reasons.push("Candidate is geographically anchored, intent-relevant and useful enough for deeper verification.");

  return { leadId: lead.id, decision, total, geography, intent, velvetUtility, reasons };
}

export function applyResearchRelevanceEngine(leads: ResearchLead[]) {
  const accepted: ResearchLead[] = [];
  const rejected: Array<{ lead: ResearchLead; score: RelevanceScore }> = [];

  for (const lead of leads) {
    const score = scoreResearchLeadRelevance(lead);
    if (score.decision === "ACCEPT") accepted.push(lead);
    else rejected.push({ lead, score });
  }

  accepted.sort((a, b) => scoreResearchLeadRelevance(b).total - scoreResearchLeadRelevance(a).total);
  return { accepted, rejected };
}
