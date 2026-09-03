import type { ResearchLead } from "./research-collectors";
import type { CandidateDiscovery, ResearchEvidence } from "./research-verification";
import { extractHumanFacingClaims } from "./human-facing-claim-extractor";

export type MergeConfidence = "HIGH" | "MEDIUM" | "LOW";

export type MergedCandidate = CandidateDiscovery & {
  aliases: string[];
  sourceLeadIds: string[];
  mergeConfidence: MergeConfidence;
  mergeReasons: string[];
};

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\b(paris|france|the|le|la|les|de|du|des|d'|l')\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function tokens(value: string) { return new Set(normalizeText(value).split(" ").filter((token) => token.length >= 3)); }
function tokenSimilarity(a: string, b: string) {
  const left = tokens(a); const right = tokens(b); if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size; return union ? intersection / union : 0;
}
function haversineMeters(a: ResearchLead, b: ResearchLead) {
  if (![a.lat, a.lon, b.lat, b.lon].every((value) => typeof value === "number" && Number.isFinite(value))) return Number.POSITIVE_INFINITY;
  const earth = 6_371_000; const toRad = (value: number) => value * Math.PI / 180;
  const lat1 = toRad(a.lat as number); const lat2 = toRad(b.lat as number);
  const dLat = toRad((b.lat as number) - (a.lat as number)); const dLon = toRad((b.lon as number) - (a.lon as number));
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function sameAddress(a?: string, b?: string) {
  if (!a || !b) return false; const left = normalizeText(a); const right = normalizeText(b);
  return left.length >= 8 && right.length >= 8 && (left.includes(right) || right.includes(left) || tokenSimilarity(left, right) >= 0.72);
}
function matchScore(a: ResearchLead, b: ResearchLead) {
  const nameScore = tokenSimilarity(a.name, b.name); const addressMatch = sameAddress(a.address, b.address); const distance = haversineMeters(a, b);
  const geoMatch = distance <= 120; const strongGeo = distance <= 40; let score = nameScore * 60;
  if (addressMatch) score += 30; if (geoMatch) score += 20; if (strongGeo) score += 10; if (normalizeText(a.name) === normalizeText(b.name)) score += 25;
  return { score: Math.min(100, Math.round(score)), nameScore, addressMatch, distance, geoMatch };
}
function shouldMerge(a: ResearchLead, b: ResearchLead) {
  if (a.pageId !== b.pageId || a.theme !== b.theme) return false; const match = matchScore(a, b);
  if (normalizeText(a.name) === normalizeText(b.name) && normalizeText(a.name).length >= 5) return true;
  if (match.addressMatch && match.nameScore >= 0.35) return true; if (match.geoMatch && match.nameScore >= 0.45) return true; if (match.nameScore >= 0.82) return true; return false;
}
function leadEvidence(lead: ResearchLead): ResearchEvidence {
  return {
    sourceId: lead.id, sourceType: lead.sourceType, publisher: lead.publisher, url: lead.url, title: lead.name, observedAt: lead.observedAt,
    claims: [...lead.rawClaims, ...(lead.address ? [lead.address] : [])], independentKey: lead.independentKey,
  };
}
function chooseCanonicalName(leads: ResearchLead[]) {
  const official = leads.find((lead) => lead.sourceType === "OFFICIAL"); if (official) return official.name;
  const map = leads.find((lead) => lead.sourceType === "MAP" && lead.name.length <= 90); if (map) return map.name;
  return [...leads].sort((a, b) => a.name.length - b.name.length)[0]?.name ?? "Unknown place";
}
function mergeConfidence(leads: ResearchLead[]): { confidence: MergeConfidence; reasons: string[] } {
  const reasons: string[] = [];
  const sources = new Set(leads.flatMap((lead) => [lead.independentKey, ...(lead.evidenceTrace ?? []).map((item) => item.independentKey)]));
  const names = leads.map((lead) => lead.name); const hasGeo = leads.some((lead) => typeof lead.lat === "number" && typeof lead.lon === "number");
  const hasAddress = leads.some((lead) => Boolean(lead.address)); const nameAgreement = names.length <= 1 ? 1 : Math.min(...names.slice(1).map((name) => tokenSimilarity(names[0], name)));
  if (sources.size >= 2) reasons.push(`${sources.size} independent sources merged or carried as evidence traces.`);
  if (hasGeo) reasons.push("At least one geocoded observation supports entity identity."); if (hasAddress) reasons.push("At least one address observation is available.");
  if (nameAgreement >= 0.7) reasons.push("Source names show strong lexical agreement.");
  if (sources.size >= 2 && (hasGeo || hasAddress) && nameAgreement >= 0.45) return { confidence: "HIGH", reasons };
  if (sources.size >= 2 || (hasGeo && hasAddress)) return { confidence: "MEDIUM", reasons }; return { confidence: "LOW", reasons };
}
function mergeGroup(group: ResearchLead[]): MergedCandidate {
  const canonicalName = chooseCanonicalName(group);
  const evidence = [...group.map(leadEvidence), ...group.flatMap((lead) => lead.evidenceTrace ?? [])];
  const dedupedEvidence = [...new Map(evidence.map((item) => [`${item.independentKey}|${item.url}|${item.sourceId}`, item])).values()];
  const aliases = [...new Set(group.map((lead) => lead.name).filter((name) => name !== canonicalName))];
  const address = group.find((lead) => lead.address)?.address; const merge = mergeConfidence(group);
  const humanClaims = extractHumanFacingClaims({ name: canonicalName, theme: group[0].theme, city: "Paris", address, evidence: dedupedEvidence });

  return {
    id: `candidate:${group[0].pageId}:${normalizeText(canonicalName).replace(/\s+/g, "-").slice(0, 64)}`,
    name: canonicalName, aliases, city: "Paris", theme: group[0].theme, address,
    factualClaims: humanClaims,
    timeSensitiveClaims: humanClaims.filter((claim) => /late-opening|night-visit|open|opening|hours|price|ticket|reservation|closed|access/i.test(claim)),
    evidence: dedupedEvidence, velvetFit: undefined, sourceLeadIds: group.map((lead) => lead.id), mergeConfidence: merge.confidence,
    mergeReasons: [...merge.reasons,
      `Human-facing extractor produced ${humanClaims.length} conservative traveler-facing claim(s) from preserved evidence.`,
      "Internal research metadata remains evidence provenance only and is never promoted into traveler-facing claims.",
      "Downstream intent/history/hunter evidence traces remain preserved for claim-level verification."],
  };
}
export function normalizeAndMergeLeads(leads: ResearchLead[]): MergedCandidate[] {
  const groups: ResearchLead[][] = [];
  for (const lead of leads) {
    let target = groups.find((group) => group.some((existing) => shouldMerge(existing, lead)));
    if (!target) { target = []; groups.push(target); } target.push(lead);
  }
  return groups.map(mergeGroup).sort((a, b) => {
    const rank: Record<MergeConfidence, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const sourceDelta = new Set(b.evidence.map((item) => item.independentKey)).size - new Set(a.evidence.map((item) => item.independentKey)).size;
    return rank[b.mergeConfidence] - rank[a.mergeConfidence] || sourceDelta;
  });
}
export function buildCandidatePortfolio(collections: Array<{ leads: ResearchLead[] }>) {
  return collections.map((collection) => ({ candidates: normalizeAndMergeLeads(collection.leads) }));
}
