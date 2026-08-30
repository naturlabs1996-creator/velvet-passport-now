import type { ResearchLead } from "./research-collectors";

export type DestinationEntityDecision = {
  accepted: boolean;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reasons: string[];
};

const PARIS_BOUNDS = {
  minLat: 48.815,
  maxLat: 48.902,
  minLon: 2.224,
  maxLon: 2.469,
};

const OFFICIAL_PARIS_HOSTS = new Set([
  "paris.fr",
  "parisjetaime.com",
]);

const PARIS_GEO_ANCHOR = /\b(?:paris,?\s+france|parisian|île[- ]de[- ]france|ile[- ]de[- ]france|seine|rive gauche|rive droite|montmartre|marais|saint[- ]germain|latin quarter|quartier latin|op[eé]ra|bastille|montparnasse|pigalle|belleville|m[eé]nilmontant|canal saint[- ]martin|batignolles|trocad[eé]ro|champs[- ]e[eé]lys[eé]es|luxembourg|louvre|750(?:0[1-9]|1[0-9]|20)|\d{1,2}(?:st|nd|rd|th)? arrondissement|\d{1,2}(?:er|e|ème) arrondissement)\b/i;

const NON_DESTINATION_ENTITY = /\b(?:film|movie|war drama|television|tv series|episode|album|song|singer|musician|actress|actor|rapper|model|media personality|socialite|football club|soccer club|cycling|cyclist|race|racing|tour de france|soap opera|born\s+\d{4}|discography|recording artist|novel|book by|fictional|character|surname)\b/i;

const KNOWN_NON_PARIS_DESTINATION_PATTERNS = [
  /\bparis\s*,\s*texas\b/i,
  /\bparis[-–— ]roubaix\b/i,
  /^paris fc\b/i,
  /^paris hilton\b/i,
];

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function insideParis(lat?: number, lon?: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return lat! >= PARIS_BOUNDS.minLat && lat! <= PARIS_BOUNDS.maxLat && lon! >= PARIS_BOUNDS.minLon && lon! <= PARIS_BOUNDS.maxLon;
}

function hasExplicitParisFranceAddress(address?: string) {
  if (!address) return false;
  return /\bparis\b/i.test(address) && /\bfrance\b/i.test(address);
}

export function evaluateParisDestinationEntity(lead: ResearchLead): DestinationEntityDecision {
  const combined = [lead.name, lead.snippet, lead.address, ...lead.rawClaims].filter(Boolean).join(" ");
  const reasons: string[] = [];

  if (KNOWN_NON_PARIS_DESTINATION_PATTERNS.some((pattern) => pattern.test(combined))) {
    return { accepted: false, confidence: "HIGH", reasons: ["Known non-Paris-destination entity pattern detected."] };
  }

  if (NON_DESTINATION_ENTITY.test(combined) && !PARIS_GEO_ANCHOR.test(combined) && !hasExplicitParisFranceAddress(lead.address)) {
    return { accepted: false, confidence: "HIGH", reasons: ["Result is classified as a person, media, sport or other non-destination entity without a Paris-France geographic anchor."] };
  }

  if (insideParis(lead.lat, lead.lon)) {
    reasons.push("Coordinates fall inside the Paris city bounding box.");
    return { accepted: true, confidence: "HIGH", reasons };
  }

  if (hasExplicitParisFranceAddress(lead.address)) {
    reasons.push("Address explicitly anchors the entity to Paris, France.");
    return { accepted: true, confidence: "HIGH", reasons };
  }

  const host = hostOf(lead.url);
  if (OFFICIAL_PARIS_HOSTS.has(host)) {
    reasons.push("Source is an approved official Paris destination domain.");
    return { accepted: true, confidence: "HIGH", reasons };
  }

  if (PARIS_GEO_ANCHOR.test(combined)) {
    reasons.push("Text contains a Paris-France geographic anchor stronger than the bare token Paris.");
    return { accepted: true, confidence: "MEDIUM", reasons };
  }

  return {
    accepted: false,
    confidence: "HIGH",
    reasons: ["Bare use of the token Paris is insufficient to prove that the result belongs to Paris, France."],
  };
}

export function applyParisDestinationEntityLock(leads: ResearchLead[]) {
  const accepted: ResearchLead[] = [];
  const rejected: Array<{ lead: ResearchLead; decision: DestinationEntityDecision }> = [];

  for (const lead of leads) {
    const decision = evaluateParisDestinationEntity(lead);
    if (decision.accepted) accepted.push(lead);
    else rejected.push({ lead, decision });
  }

  return { accepted, rejected };
}
