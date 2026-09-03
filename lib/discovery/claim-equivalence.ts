export type ClaimEquivalenceFamily = {
  id: string;
  themes: string[];
  terms: string[];
};

const FAMILIES: ClaimEquivalenceFamily[] = [
  {
    id: "LATE_OPENING",
    themes: ["paris-after-dark"],
    terms: [
      "late opening",
      "open late",
      "open in the evening",
      "evening opening",
      "evening hours",
      "late hours",
      "nocturne",
      "ouverture nocturne",
      "ouvert le soir",
      "ouvert en soirée",
    ],
  },
  {
    id: "NIGHT_VISIT",
    themes: ["paris-after-dark"],
    terms: [
      "night visit",
      "night visits",
      "night tour",
      "night tours",
      "night opening",
      "after dark",
      "visite nocturne",
      "visites nocturnes",
      "visite de nuit",
      "soirée",
    ],
  },
  {
    id: "QUIET_ATMOSPHERE",
    themes: ["quiet-paris"],
    terms: ["quiet", "calm", "peaceful", "tranquil", "paisible"],
  },
  {
    id: "LOW_CROWD_FRAMING",
    themes: ["quiet-paris", "beyond-the-classics"],
    terms: ["away from crowds", "uncrowded", "less crowded", "loin de la foule", "peu fréquenté"],
  },
  {
    id: "LESS_KNOWN",
    themes: ["beyond-the-classics", "unusual-museums"],
    terms: ["less known", "little known", "under-the-radar", "off the beaten", "méconnu", "peu connu"],
  },
  {
    id: "UNUSUAL",
    themes: ["beyond-the-classics", "unusual-museums"],
    terms: ["unusual", "atypical", "insolite", "singulier"],
  },
];

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function claimEquivalenceFamilies(theme: string | undefined, observedTerms: string[]) {
  const observed = new Set(observedTerms.map(normalize));
  return FAMILIES.filter((family) => {
    if (theme && !family.themes.includes(theme)) return false;
    return family.terms.some((term) => observed.has(normalize(term)));
  });
}

export function expandEquivalentClaimTerms(theme: string | undefined, observedTerms: string[]) {
  const families = claimEquivalenceFamilies(theme, observedTerms);
  const expanded = new Set(observedTerms.map((term) => term.trim()).filter(Boolean));
  for (const family of families) for (const term of family.terms) expanded.add(term);
  return {
    terms: [...expanded],
    families: families.map((family) => family.id),
  };
}

export function equivalentClaimMatch(theme: string | undefined, observedTerms: string[], candidateTerms: string[]) {
  const observedFamilies = new Set(claimEquivalenceFamilies(theme, observedTerms).map((family) => family.id));
  const candidateFamilies = claimEquivalenceFamilies(theme, candidateTerms).map((family) => family.id);
  const sharedFamilies = candidateFamilies.filter((id) => observedFamilies.has(id));
  const exact = candidateTerms.filter((candidate) => observedTerms.some((observed) => normalize(observed) === normalize(candidate)));
  return {
    matched: exact.length > 0 || sharedFamilies.length > 0,
    exactTerms: exact,
    sharedFamilies,
  };
}

export const CLAIM_EQUIVALENCE_RULE = "Claim equivalence is allowlist-only. A synonym can corroborate an observed claim only when both expressions belong to the same predefined claim family for the active theme. Free semantic similarity, embeddings and broad topical resemblance never count as corroboration.";
