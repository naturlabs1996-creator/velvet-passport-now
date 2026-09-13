import type { ResearchEvidence } from "./research-verification";

export type SourceAuthority = "PRIMARY" | "STRONG" | "SUPPORTING" | "WEAK";
export type FactDomain = "IDENTITY" | "LOCATION" | "HISTORY" | "ACCESS" | "HOURS" | "PRICE" | "ATMOSPHERE" | "SECRECY" | "POPULARITY" | "OTHER";

export type SourceReputation = {
  authority: SourceAuthority;
  score: number;
  preferredFor: FactDomain[];
  cautions: string[];
};

function publisherHost(evidence: ResearchEvidence) {
  try {
    return new URL(evidence.url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return evidence.publisher.toLowerCase();
  }
}

export function reputationForEvidence(evidence: ResearchEvidence): SourceReputation {
  const host = publisherHost(evidence);
  const preferredFor: FactDomain[] = [];
  const cautions: string[] = [];
  let score = 45;
  let authority: SourceAuthority = "SUPPORTING";

  if (evidence.sourceType === "OFFICIAL") {
    authority = "PRIMARY";
    score = 92;
    preferredFor.push("IDENTITY", "LOCATION", "ACCESS", "HOURS", "PRICE", "HISTORY");
  } else if (evidence.sourceType === "MAP") {
    authority = "STRONG";
    score = 78;
    preferredFor.push("IDENTITY", "LOCATION");
    cautions.push("Map data is useful for identity/location but should not be sole authority for changing hours, prices or access rules.");
  } else if (/wikipedia\.org|wikimedia\.org/.test(host)) {
    authority = "SUPPORTING";
    score = 68;
    preferredFor.push("IDENTITY", "HISTORY", "OTHER");
    cautions.push("Encyclopedic data is supporting evidence, not primary authority for operational facts.");
  } else if (/parisjetaime\.com|france\.fr|culture\.gouv\.fr|paris\.fr/.test(host)) {
    authority = "STRONG";
    score = 84;
    preferredFor.push("IDENTITY", "LOCATION", "HISTORY", "ACCESS", "HOURS");
  } else if (evidence.sourceType === "EDITORIAL") {
    authority = "SUPPORTING";
    score = 58;
    preferredFor.push("HISTORY", "ATMOSPHERE", "POPULARITY", "OTHER");
    cautions.push("Editorial descriptions require corroboration for operational, secrecy or popularity claims.");
  }

  if (!evidence.publishedAt) cautions.push("Publication date unavailable; freshness relies on observation time.");
  return { authority, score, preferredFor, cautions };
}

export function sourceSupportsDomain(evidence: ResearchEvidence, domain: FactDomain) {
  const reputation = reputationForEvidence(evidence);
  return {
    ...reputation,
    domainPreferred: reputation.preferredFor.includes(domain),
  };
}
