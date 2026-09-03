export function canonicalSourceFamily(value: string) {
  const raw = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  if (!raw) return "unknown";
  if (raw === "wikipedia.org" || raw.endsWith(".wikipedia.org")) return "wikipedia.org";
  if (raw === "wikimedia.org" || raw.endsWith(".wikimedia.org")) return "wikimedia.org";
  if (raw === "wikidata.org" || raw.endsWith(".wikidata.org")) return "wikidata.org";
  if (raw === "openstreetmap.org" || raw.endsWith(".openstreetmap.org")) return "openstreetmap.org";
  return raw;
}

export function sameSourceFamily(a: string, b: string) {
  return canonicalSourceFamily(a) === canonicalSourceFamily(b);
}

export const SOURCE_FAMILY_RULE =
  "Language editions and subdomains of the same publisher are one editorial family for independence counting. Multiple URLs from one family never create a second independent source.";
