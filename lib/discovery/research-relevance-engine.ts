import type { ResearchLead } from "./research-collectors";
import { scoreExposure } from "./exposure-intelligence";

export type RelevanceDecision = "ACCEPT" | "REJECT";
export type RelevanceScore = { leadId: string; decision: RelevanceDecision; total: number; geography: number; intent: number; velvetUtility: number; exposureLevel: string; exposureScore: number; exposureDegree: number | null; exposureVerdict: string; entityExposureScore: number; reasons: string[]; };

const THEME_TERMS: Record<string, string[]> = {
  "beyond-the-classics": ["hidden", "unusual", "less known", "off the beaten", "courtyard", "passage", "garden", "small museum", "bookshop", "atelier", "covered passage", "discreet"],
  "quiet-paris": ["quiet", "calm", "peaceful", "garden", "courtyard", "library", "bookshop", "passage", "square", "cloister"],
  "secret-gardens": ["garden", "jardin", "courtyard", "cour", "square", "green", "park"],
  "forgotten-passages": ["covered passage", "passage couvert", "galerie couverte", "covered arcade", "hidden passage", "secret passage", "forgotten passage", "passage méconnu"],
  "hidden-bookshops": ["bookshop", "bookstore", "librairie", "books", "literary"],
  "unusual-museums": ["unusual museum", "musée insolite", "insolite", "atypical", "atypique", "quirky", "weird museum", "offbeat museum", "cabinet of curiosities", "small unusual museum", "house museum"],
  "paris-after-dark": ["night", "evening", "late opening", "open late", "after dark", "nocturne"],
  "rainy-day-paris": ["indoor", "covered", "inside", "covered passage", "arcade"],
};
const ICONIC_ENTITY_TERMS = ["eiffel tower", "louvre museum", "musée du louvre", "arc de triomphe", "disneyland paris", "champs-élysées", "notre-dame", "sacré-coeur", "musée d'orsay"];
const VELVET_TERMS = ["courtyard", "passage", "garden", "bookshop", "small museum", "atelier", "historic", "literary", "discreet", "discrète", "discrete", "insolite", "dissimul", "unusual", "hidden", "local", "quiet", "independent", "underground", "crypte", "souterrain"];
const EXACT_ANGLE_TERMS = ["after closing", "after-hours", "après la fermeture", "nocturne", "sur rendez-vous", "by appointment", "salle de consultation", "consultation room", "petit salon", "private room", "sur demande", "on request", "seconde cour", "second courtyard", "ouverture exceptionnelle", "rare opening", "réserve", "reserve", "archives", "working workshop", "atelier en activité", "underground", "souterrain", "entrée discrète", "entree discrete", "dissimul"];
const FOCUSED_INTENT_REQUIRED = new Set(Object.keys(THEME_TERMS));
function normalize(value: string) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function textOf(lead: ResearchLead) { return normalize([lead.name, lead.snippet, lead.address, lead.url, lead.publisher, ...lead.rawClaims].filter(Boolean).join(" ")); }
function lexicalTextOf(lead: ResearchLead) { return normalize([lead.name, lead.snippet, lead.address, ...lead.rawClaims.filter((claim) => !claim.startsWith("INTENT_EVIDENCE ") && !claim.startsWith("HISTORY_EVIDENCE:") && !claim.startsWith("EXPOSURE_EVIDENCE"))].filter(Boolean).join(" ")); }
function hasAny(text: string, terms: string[]) { return terms.some((term) => text.includes(normalize(term))); }
function geographyScore(lead: ResearchLead, text: string) { let score = 0; if (typeof lead.lat === "number" && typeof lead.lon === "number") score += 45; if (lead.address && /paris|75\d{3}|arrondissement/i.test(lead.address)) score += 35; if (/paris, france|paris france|\b\d{1,2}(?:st|nd|rd|th)? arrondissement\b|montmartre|marais|saint-germain|latin quarter|rive gauche|rive droite|opera|opéra/i.test(text)) score += 30; return Math.min(100, score); }
type IntentEvidenceState = "NONE" | "CONFIRMED" | "PARTIAL" | "UNCONFIRMED";
function intentEvidenceState(lead: ResearchLead): IntentEvidenceState { const claims = lead.rawClaims.filter((claim) => claim.startsWith(`INTENT_EVIDENCE ${lead.theme}:`)); if (!claims.length) return "NONE"; if (claims.some((claim) => /status=CONFIRMED/.test(claim))) return "CONFIRMED"; if (claims.some((claim) => /status=PARTIAL/.test(claim))) return "PARTIAL"; return "UNCONFIRMED"; }
function intentScore(lead: ResearchLead) {
  const evidenceState = intentEvidenceState(lead);
  if (evidenceState === "CONFIRMED") return 75;
  if (evidenceState === "PARTIAL") return 30;
  if (evidenceState === "UNCONFIRMED") return 0;
  if (FOCUSED_INTENT_REQUIRED.has(lead.theme)) return 0;
  const terms = THEME_TERMS[lead.theme] ?? [];
  if (!terms.length) return 50;
  const text = lexicalTextOf(lead);
  const matches = terms.filter((term) => text.includes(normalize(term))).length;
  return matches === 0 ? 0 : Math.min(100, 35 + matches * 20);
}
function velvetUtilityScore(text: string, exactAngleExposureScore: number, exposureVerdict: string) {
  let score = 25;
  const matches = VELVET_TERMS.filter((term) => text.includes(normalize(term))).length;
  score += Math.min(60, matches * 12);
  score -= Math.round(exactAngleExposureScore * 0.45);
  if (exposureVerdict === "PASS") score += 8;
  return Math.max(0, Math.min(100, score));
}

export function scoreResearchLeadRelevance(lead: ResearchLead): RelevanceScore {
  const exposure = scoreExposure(lead); const scoredLead = exposure.lead; const text = textOf(scoredLead); const geography = geographyScore(scoredLead, text); const intent = intentScore(scoredLead); const velvetUtility = velvetUtilityScore(text, exposure.score, exposure.verdict); const total = Math.round(geography * 0.35 + intent * 0.45 + velvetUtility * 0.2); const reasons: string[] = []; const evidenceState = intentEvidenceState(scoredLead);
  const iconicEntity = hasAny(normalize(scoredLead.name), ICONIC_ENTITY_TERMS);
  const exactAnglePresent = hasAny(text, EXACT_ANGLE_TERMS);
  if (geography < 45) reasons.push("Paris-France anchor is too weak for a research candidate.");
  if (intent < 35) reasons.push("Candidate does not match the active traveler intent strongly enough.");
  if (velvetUtility < 25) reasons.push("Candidate is too generic or the exact Velvet angle is too exposed for the discovery layer.");
  if (iconicEntity && !exactAnglePresent) reasons.push("Iconic entity has no precise Uncovered layer. Generic fame plus a theme label is not enough for Velvet relevance.");
  if (exposure.entityExposureScore > 0) reasons.push(`Entity exposure context: ${exposure.entityExposureScore}/100. This is context only and cannot reject a verified exact angle by itself.`);
  if (exposure.verdict === "FAIL") reasons.push("Exact-angle Exposure Degree failed the Velvet threshold. Candidate exits the relevance pipeline immediately; further factual verification cannot rescue excessive exposure.");
  else if (exposure.verdict === "HOLD_UNKNOWN") reasons.push("Exact-angle Exposure Degree is still unknown. Research may continue, but this is not an Exposure PASS and cannot support LOCK/publication.");
  else reasons.push(`Exact-angle Exposure: ${exposure.level}, degree=${exposure.exposureDegree}/10, verdict=${exposure.verdict}, families=${exposure.sourceFamilies.join(", ") || "none"}.`);
  if (evidenceState === "CONFIRMED") reasons.push("Focused Intent Evidence explicitly confirms the theme-place relationship.");
  else if (evidenceState === "PARTIAL") reasons.push("Focused Intent Evidence is only partial, so it cannot satisfy the relevance acceptance threshold yet.");
  else if (evidenceState === "UNCONFIRMED") reasons.push("Focused Intent Evidence explicitly failed to confirm this theme-place relationship; lexical matches are ignored.");
  else if (FOCUSED_INTENT_REQUIRED.has(scoredLead.theme)) reasons.push("No Focused Intent Evidence verdict exists for this research theme, so lexical similarity alone cannot satisfy relevance.");
  const exposureFailed = exposure.verdict === "FAIL";
  const decision: RelevanceDecision = geography >= 45 && intent >= 35 && velvetUtility >= 25 && total >= 50 && !(iconicEntity && !exactAnglePresent) && !exposureFailed ? "ACCEPT" : "REJECT";
  if (decision === "ACCEPT") reasons.push("Candidate is geographically anchored, intent-relevant and useful enough for deeper verification. Exposure PASS remains a separate downstream requirement for Velvet selection.");
  return { leadId: lead.id, decision, total, geography, intent, velvetUtility, exposureLevel: exposure.level, exposureScore: exposure.score, exposureDegree: exposure.exposureDegree, exposureVerdict: exposure.verdict, entityExposureScore: exposure.entityExposureScore, reasons };
}
export function applyResearchRelevanceEngine(leads: ResearchLead[]) { const accepted: ResearchLead[] = []; const rejected: Array<{ lead: ResearchLead; score: RelevanceScore }> = []; for (const lead of leads) { const exposure = scoreExposure(lead); const score = scoreResearchLeadRelevance(exposure.lead); if (score.decision === "ACCEPT") accepted.push(exposure.lead); else rejected.push({ lead: exposure.lead, score }); } accepted.sort((a, b) => scoreResearchLeadRelevance(b).total - scoreResearchLeadRelevance(a).total); return { accepted, rejected }; }
