const INTERNAL_PREFIXES = [
  "PLACE_ENTITY_EXTRACTED_FROM",
  "PLACE_ENTITY_CONFIDENCE",
  "PLACE_ENTITY_METHOD",
  "SOURCE_CONTEXT",
  "WIKIDATA_",
  "INTENT_EVIDENCE",
  "HISTORY_EVIDENCE",
  "EXPOSURE_EVIDENCE",
  "RESEARCH_",
  "PREDATOR_",
];

const INTERNAL_EXACT = new Set([
  "tourism",
]);

export function isInternalResearchClaim(value: string) {
  const claim = value.trim();
  const upper = claim.toUpperCase();
  if (INTERNAL_PREFIXES.some((prefix) => upper.startsWith(prefix))) return true;
  if (INTERNAL_EXACT.has(claim.toLowerCase())) return true;
  return false;
}

export function isHumanFacingClaim(value: string) {
  const claim = value.trim();
  if (!claim || isInternalResearchClaim(claim)) return false;
  if (/^[A-Z0-9_]+(?:\s+[A-Z0-9_]+)*$/.test(claim) && claim.includes("_")) return false;
  return true;
}

export const INTERNAL_CLAIM_FIREWALL_RULE =
  "Internal research metadata, telemetry, resolver labels, Wikidata machine provenance, evidence bridge markers and machine-only provenance tokens are never traveler-facing factual claims and can never enter Safe Copy.";
