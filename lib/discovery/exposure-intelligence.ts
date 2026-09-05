import type { ResearchLead } from "./research-collectors";

export type ExposureLevel = "LOW" | "MODERATE" | "HIGH" | "MASS_TOURISM" | "UNKNOWN";

export type ExposureResult = {
  lead: ResearchLead;
  level: ExposureLevel;
  score: number;
  signals: string[];
};

const MASS_TERMS = ["eiffel tower", "louvre museum", "musée du louvre", "arc de triomphe", "champs-élysées", "disneyland paris"];
const HIGH_EXPOSURE_HOSTS = ["parisjetaime.com", "tripadvisor.com", "getyourguide.com", "viator.com", "lonelyplanet.com"];

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "unknown"; }
}

export function scoreExposure(lead: ResearchLead): ExposureResult {
  const text = normalize([lead.name, lead.snippet, lead.url, lead.publisher, ...lead.rawClaims].filter(Boolean).join(" "));
  const signals: string[] = [];
  let score = 10;

  if (MASS_TERMS.some((term) => text.includes(normalize(term)))) {
    score += 80;
    signals.push("Mass-tourism landmark pattern detected.");
  }

  const host = hostOf(lead.url);
  if (host === "parisjetaime.com" || /paris je t'aime|paris tourist office|office du tourisme/i.test(text)) {
    score += 35;
    signals.push("Paris tourism-office exposure detected.");
  }

  const matchedHosts = HIGH_EXPOSURE_HOSTS.filter((item) => text.includes(item));
  if (matchedHosts.length) {
    score += Math.min(35, matchedHosts.length * 12);
    signals.push(`High-exposure travel platforms observed: ${matchedHosts.join(", ")}.`);
  }

  if (/top 10|top 15|must-see|must see|most visited|iconic|world-famous|world famous/i.test(text)) {
    score += 20;
    signals.push("Generic high-exposure listicle/landmark language detected.");
  }

  score = Math.max(0, Math.min(100, score));
  const level: ExposureLevel = score >= 80 ? "MASS_TOURISM" : score >= 55 ? "HIGH" : score >= 30 ? "MODERATE" : signals.length ? "LOW" : "UNKNOWN";
  const claim = `EXPOSURE_EVIDENCE level=${level} score=${score} signals=${signals.length}`;
  return { lead: { ...lead, rawClaims: [...lead.rawClaims, claim] }, level, score, signals };
}

export function applyExposureIntelligence(leads: ResearchLead[]) {
  const results = leads.map(scoreExposure);
  return {
    results,
    leads: results.map((item) => item.lead),
    low: results.filter((item) => item.level === "LOW").length,
    moderate: results.filter((item) => item.level === "MODERATE").length,
    high: results.filter((item) => item.level === "HIGH").length,
    massTourism: results.filter((item) => item.level === "MASS_TOURISM").length,
    unknown: results.filter((item) => item.level === "UNKNOWN").length,
    rule: "Exposure is a negative Velvet-selection signal, not a factual rejection by itself. Tourism-office, major marketplace, listicle and mass-landmark signals can reduce Velvet priority but never replace intent or factual verification.",
  };
}
