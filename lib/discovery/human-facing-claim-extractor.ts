import type { ResearchEvidence } from "./research-verification";
import { isInternalResearchClaim } from "./internal-claim-firewall";
import { claimEquivalenceFamilies } from "./claim-equivalence";

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-–—]+/g, " ").replace(/\s+/g, " ").trim();
}

function usableClaims(evidence: ResearchEvidence[]) {
  return evidence.flatMap((item) => item.claims.map((claim) => ({ evidence: item, claim })))
    .filter((item) => item.claim.trim() && !isInternalResearchClaim(item.claim));
}

function years(text: string) {
  return [...text.matchAll(/\b(1[5-9]\d{2}|20\d{2})\b/g)].map((match) => match[1]);
}

function addUnique(target: string[], claim: string) {
  const value = claim.replace(/\s+/g, " ").trim();
  if (value && !target.some((existing) => normalize(existing) === normalize(value))) target.push(value);
}

export function extractHumanFacingClaims(input: {
  name: string;
  theme: string;
  city: string;
  address?: string;
  evidence: ResearchEvidence[];
}) {
  const claims: string[] = [];
  const observations = usableClaims(input.evidence);
  const joined = observations.map((item) => item.claim).join(" ");
  const normalized = normalize(joined);
  const name = input.name.trim();

  if (input.address && /\bparis\b/i.test(input.address)) {
    addUnique(claims, `${name} is in Paris, France.`);
    if (/\bmus[eé]e\b|\bmuseum\b/i.test(name)) addUnique(claims, `${name} is a museum in Paris.`);
    else if (/\bjardin\b|\bgarden\b/i.test(name)) addUnique(claims, `${name} is a garden in Paris.`);
    else if (/\bpassage\b/i.test(name)) addUnique(claims, `${name} is a passage in Paris.`);
  }

  const observedTerms = [
    "late opening", "open late", "open in the evening", "evening opening", "evening hours", "late hours", "late night", "late-night",
    "nocturne", "ouverture nocturne", "ouvert le soir", "ouvert en soirée",
    "night visit", "night visits", "night tour", "night tours", "night opening", "after dark",
    "visite nocturne", "visites nocturnes", "visite de nuit", "soirée",
    "quiet", "calm", "peaceful", "tranquil", "paisible",
    "away from crowds", "uncrowded", "less crowded", "loin de la foule", "peu fréquenté",
    "less known", "little known", "under-the-radar", "off the beaten", "méconnu", "peu connu",
    "unusual", "atypical", "insolite", "singulier",
  ].filter((term) => normalized.includes(normalize(term)));
  const families = new Set(claimEquivalenceFamilies(input.theme, observedTerms).map((family) => family.id));

  if (families.has("LATE_OPENING")) addUnique(claims, `${name} has documented late-opening activity.`);
  if (families.has("NIGHT_VISIT")) addUnique(claims, `${name} has documented evening or night-visit activity.`);
  if (families.has("QUIET_ATMOSPHERE")) addUnique(claims, `${name} is described as quiet, calm or peaceful.`);
  if (families.has("LOW_CROWD_FRAMING")) addUnique(claims, `${name} is described as being away from crowds or less crowded.`);
  if (families.has("LESS_KNOWN")) addUnique(claims, `${name} is described as less known or under-the-radar.`);
  if (families.has("UNUSUAL")) addUnique(claims, `${name} is described as unusual or atypical.`);

  for (const { claim } of observations) {
    const text = normalize(claim);
    const foundYears = years(claim);
    if (!foundYears.length) continue;
    const year = foundYears[0];
    if (/\b(opened|inaugurated|opened to the public|ouvre|ouvert|inaugure)\b/.test(text)) addUnique(claims, `${name} opened in ${year}.`);
    if (/\b(built|constructed|erected|construit|edifie|batie|bati)\b/.test(text)) addUnique(claims, `${name} was built in ${year}.`);
  }

  return claims.slice(0, 10);
}

export const HUMAN_FACING_CLAIM_EXTRACTION_RULE =
  "Human-facing claims are generated only from resolved identity/location data, explicit closed claim-equivalence families, or narrow year+history patterns found in source evidence. Internal Predator metadata is never converted into traveler-facing copy.";
