import type { AnswerPageSpec } from "./page-factory";
import { isInternalResearchClaim } from "./internal-claim-firewall";
import { canonicalSourceFamily } from "./source-family";

export type VerificationStatus = "VERIFIED" | "PARTIAL" | "UNVERIFIED" | "REJECTED";
export type PublishStatus = "PUBLISHABLE" | "RESEARCH_REQUIRED" | "HOLD";
export type EvidenceFreshness = "CURRENT" | "AGING" | "STALE" | "UNDATED";
export type ExposurePublishVerdict = "PASS" | "EXCEPTION_REVIEW" | "FAIL" | "HOLD_UNKNOWN";
export type ResearchEvidence = { sourceId: string; sourceType: "OFFICIAL" | "EDITORIAL" | "MAP" | "WIKIDATA" | "COMMUNITY" | "MARKETPLACE"; publisher: string; url: string; title?: string; observedAt: string; publishedAt?: string; claims: string[]; independentKey: string; };
export type CandidateDiscovery = { id: string; name: string; city: string; theme: string; address?: string; neighborhood?: string; factualClaims: string[]; timeSensitiveClaims: string[]; evidence: ResearchEvidence[]; velvetFit?: number; exposureDegree?: number | null; exposureVerdict?: ExposurePublishVerdict; };
export type VerifiedDiscovery = CandidateDiscovery & { verificationStatus: VerificationStatus; confidence: number; independentSources: number; officialSourcePresent: boolean; freshness: EvidenceFreshness; rejectedReasons: string[]; };
export type ResearchPacket = { pageId: string; theme: string; route: string; query: string; requiredDiscoveries: { min: number; target: number; max: number }; requiredEvidence: { independentSourcesPerDiscovery: number; officialPreferred: boolean; timeSensitiveMaxAgeDays: number }; tasks: string[]; };
export type PageVerificationResult = { pageId: string; theme: string; status: PublishStatus; verifiedDiscoveries: VerifiedDiscovery[]; usableDiscoveries: VerifiedDiscovery[]; rejectedDiscoveries: VerifiedDiscovery[]; unresolvedRequirements: string[]; robots: "index,follow" | "noindex,nofollow"; publishReasons: string[]; };

function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[-–—]+/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }
function tokens(value: string) { return new Set(normalize(value).split(" ").filter((token) => token.length >= 3)); }
function overlap(a: string, b: string) { const left = tokens(a); const right = tokens(b); if (!left.size || !right.size) return 0; const common = [...left].filter((token) => right.has(token)).length; return common / Math.max(left.size, right.size); }
function evidenceSupportsAnyHumanClaim(evidence: ResearchEvidence, claims: string[]) {
  const sourceClaims = evidence.claims.filter((claim) => !isInternalResearchClaim(claim));
  return claims.some((claim) => sourceClaims.some((sourceClaim) => {
    const combined = `${evidence.title ?? ""} ${sourceClaim}`;
    return overlap(combined, claim) >= 0.42 || normalize(combined).includes(normalize(claim)) || normalize(claim).includes(normalize(combined));
  }));
}
function daysBetween(iso: string, now: Date) { const then = new Date(iso).getTime(); if (!Number.isFinite(then)) return Number.POSITIVE_INFINITY; return Math.max(0, (now.getTime() - then) / 86_400_000); }
function evidenceFreshness(evidence: ResearchEvidence[], now: Date): EvidenceFreshness { if (!evidence.length) return "UNDATED"; const dated = evidence.map((item) => item.publishedAt ?? item.observedAt).filter(Boolean); if (!dated.length) return "UNDATED"; const newest = Math.min(...dated.map((date) => daysBetween(date, now))); if (newest <= 30) return "CURRENT"; if (newest <= 180) return "AGING"; return "STALE"; }
function independentSourceCount(evidence: ResearchEvidence[]) { return new Set(evidence.map((item) => canonicalSourceFamily(item.independentKey || item.url)).filter(Boolean)).size; }
function hasOfficialSource(evidence: ResearchEvidence[]) { return evidence.some((item) => item.sourceType === "OFFICIAL"); }

export function verifyDiscovery(candidate: CandidateDiscovery, now = new Date()): VerifiedDiscovery {
  const humanClaims = candidate.factualClaims.filter((claim) => claim.trim() && !isInternalResearchClaim(claim));
  const supportingEvidence = candidate.evidence.filter((item) => evidenceSupportsAnyHumanClaim(item, humanClaims));
  const independentSources = independentSourceCount(supportingEvidence); const officialSourcePresent = hasOfficialSource(supportingEvidence); const freshness = evidenceFreshness(supportingEvidence, now); const rejectedReasons: string[] = [];
  if (!candidate.name.trim()) rejectedReasons.push("MISSING_NAME"); if (!humanClaims.length) rejectedReasons.push("NO_HUMAN_FACTUAL_CLAIMS"); if (independentSources < 1) rejectedReasons.push("NO_CLAIM_SUPPORTING_EVIDENCE"); if ((candidate.velvetFit ?? 0) > 0 && (candidate.velvetFit ?? 0) < 55) rejectedReasons.push("LOW_VELVET_FIT");
  const staleTimeSensitive = candidate.timeSensitiveClaims.length > 0 && freshness === "STALE"; if (staleTimeSensitive) rejectedReasons.push("STALE_TIME_SENSITIVE_EVIDENCE");
  let verificationStatus: VerificationStatus = "UNVERIFIED"; if (rejectedReasons.length) verificationStatus = "REJECTED"; else if (independentSources >= 2 && (officialSourcePresent || independentSources >= 3)) verificationStatus = "VERIFIED"; else if (independentSources >= 1) verificationStatus = "PARTIAL";
  let confidence = Math.min(45, independentSources * 18) + (officialSourcePresent ? 20 : 0) + (freshness === "CURRENT" ? 20 : freshness === "AGING" ? 10 : 0) + ((candidate.velvetFit ?? 0) >= 80 ? 15 : 0); confidence = Math.max(0, Math.min(100, Math.round(confidence))); if (verificationStatus === "REJECTED") confidence = Math.min(confidence, 25);
  return { ...candidate, verificationStatus, confidence, independentSources, officialSourcePresent, freshness, rejectedReasons };
}

export function buildResearchPacket(page: AnswerPageSpec): ResearchPacket {
  return { pageId: page.id, theme: page.theme, route: page.route, query: page.seo.primaryKeyword, requiredDiscoveries: { min: 5, target: 7, max: 9 }, requiredEvidence: { independentSourcesPerDiscovery: 2, officialPreferred: true, timeSensitiveMaxAgeDays: 30 }, tasks: [
    `Find 7 candidate discoveries in ${page.city} that directly satisfy “${page.seo.primaryKeyword}”.`,
    "Capture the exact source URL and publisher for every factual claim.", "Prefer an official place/municipal/museum source plus one independent editorial or map source.", "Verify address/location separately from atmosphere or editorial-fit claims.", "Measure tourism exposure under the exact traveler angle; entity fame alone is context, not an Exposure verdict.", "Require Exposure Degree >=7/10 in Velvet's favor for automatic publication eligibility. Treat 6.5-6.9 as human exception review only and unknown exposure as HOLD.", "Treat opening hours, prices, reservation rules and access restrictions as time-sensitive and re-check before publication.", "Reject generic tourist attractions unless the specific angle genuinely answers the search intent.", "Never infer that a place is hidden, secret, local-only or uncrowded without evidence supporting that characterization."
  ] };
}

export function verifyPageResearch(page: AnswerPageSpec, candidates: CandidateDiscovery[], now = new Date()): PageVerificationResult {
  if (page.status === "HOLD") return { pageId: page.id, theme: page.theme, status: "HOLD", verifiedDiscoveries: [], usableDiscoveries: [], rejectedDiscoveries: [], unresolvedRequirements: ["PAGE_FACTORY_HOLD"], robots: "noindex,nofollow", publishReasons: ["Page Factory marked this page HOLD."] };
  const verifiedDiscoveries = candidates.filter((candidate) => candidate.theme === page.theme && candidate.city.toLowerCase() === page.city.toLowerCase()).map((candidate) => verifyDiscovery(candidate, now));
  const usableDiscoveries = verifiedDiscoveries.filter((item) => item.verificationStatus === "VERIFIED" && item.exposureVerdict === "PASS"); const rejectedDiscoveries = verifiedDiscoveries.filter((item) => item.verificationStatus === "REJECTED"); const unresolvedRequirements: string[] = [];
  if (usableDiscoveries.length < 5) unresolvedRequirements.push("MINIMUM_5_VERIFIED_EXPOSURE_PASSED_DISCOVERIES"); if (verifiedDiscoveries.some((item) => item.verificationStatus === "VERIFIED" && item.exposureVerdict !== "PASS")) unresolvedRequirements.push("EXACT_ANGLE_EXPOSURE_PASS_REQUIRED"); if (usableDiscoveries.some((item) => item.independentSources < 2)) unresolvedRequirements.push("TWO_CLAIM_SUPPORTING_INDEPENDENT_SOURCES_PER_DISCOVERY"); if (usableDiscoveries.some((item) => item.timeSensitiveClaims.length > 0 && item.freshness !== "CURRENT")) unresolvedRequirements.push("REFRESH_TIME_SENSITIVE_FACTS");
  const status: PublishStatus = unresolvedRequirements.length ? "RESEARCH_REQUIRED" : "PUBLISHABLE"; const publishReasons = status === "PUBLISHABLE" ? [`${usableDiscoveries.length} discoveries passed factual verification and exact-angle Exposure Degree.`, "Each usable discovery has at least two canonical independent publisher families supporting human-facing claims.", "Each usable discovery has automatic Exposure verdict PASS (normally >=7/10 in Velvet's favor).", "Time-sensitive claims are current or absent."] : ["Verification gate remains closed until factual evidence and exact-angle Exposure requirements are satisfied."];
  return { pageId: page.id, theme: page.theme, status, verifiedDiscoveries, usableDiscoveries, rejectedDiscoveries, unresolvedRequirements, robots: status === "PUBLISHABLE" ? "index,follow" : "noindex,nofollow", publishReasons };
}

export function buildResearchVerificationQueue(pages: AnswerPageSpec[]) {
  const unique = new Map<string, AnswerPageSpec>();
  for (const page of pages) {
    if (page.status === "HOLD") continue;
    const key = `${page.id}|${page.theme}`;
    if (!unique.has(key)) unique.set(key, page);
  }
  return [...unique.values()].map((page) => ({ packet: buildResearchPacket(page), verification: verifyPageResearch(page, []) }));
}
