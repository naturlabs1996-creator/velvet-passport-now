import type { ForeuseTarget } from "./foreuse-core";

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const GENERIC = new Set([
  "quebec","canada","saint","roch","rue","ville","maison","manoir","historique","historical",
  "archive","archives","plan","carte","lot","cadastre","adresse","proprietaire","propriétaire",
  "location","localisation","present","current","site","street","house","building","workshop",
  "brewery","tavern","scene","episode","soldiers","soldat","hanged","pendu","after","apres",
]);

export function strongIdentityTokens(target: ForeuseTarget) {
  const subject = normalize(target.subject);
  const location = normalize(target.location ?? "");
  const subjectTokens = subject.split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !GENERIC.has(t) && !/^\d+$/.test(t));
  const locationTokens = location.split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !GENERIC.has(t) && !/^\d+$/.test(t));
  const years = [...new Set([...(target.dateRange?.from ? [String(target.dateRange.from)] : []), ...(target.dateRange?.to ? [String(target.dateRange.to)] : [])])];
  return {
    subject: [...new Set(subjectTokens)],
    location: [...new Set(locationTokens)],
    years,
  };
}

export function evaluateStrongIdentity(target: ForeuseTarget, text: string) {
  const n = normalize(text);
  const tokens = strongIdentityTokens(target);
  const matchedSubject = tokens.subject.filter((t) => n.includes(t));
  const matchedLocation = tokens.location.filter((t) => n.includes(t));
  const matchedYears = tokens.years.filter((y) => n.includes(y));

  // Named-person/entity cases: one distinctive subject token plus a spatial/date corroborator,
  // or two distinctive subject tokens. Generic archive vocabulary never satisfies identity.
  const strong = matchedSubject.length >= 2 ||
    (matchedSubject.length >= 1 && (matchedLocation.length >= 1 || matchedYears.length >= 1));

  // Address-centric targets may pass with an exact civic number + street token even when the person name is absent.
  const addressNumber = (target.location ?? "").match(/\b\d{1,5}\b/)?.[0];
  const addressStrong = Boolean(addressNumber && n.includes(addressNumber) && matchedLocation.length >= 1);

  return {
    pass: strong || addressStrong,
    matchedSubject,
    matchedLocation,
    matchedYears,
    addressStrong,
    reason: strong || addressStrong
      ? "STRONG_IDENTITY"
      : "REJECT_WEAK_IDENTITY",
  } as const;
}
