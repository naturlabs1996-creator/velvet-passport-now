import type { MergedCandidate } from "./evidence-normalizer";
import type { ResearchEvidence } from "./research-verification";
import { sourceSupportsDomain, type FactDomain } from "./source-reputation";
import { isInternalResearchClaim } from "./internal-claim-firewall";
import { claimTermsInText, equivalentClaimMatch } from "./claim-equivalence";

export type ClaimStatus = "VERIFIED" | "PARTIAL" | "UNVERIFIED" | "REJECTED" | "CONFLICTED" | "STALE";
export type ClaimRisk = "LOW" | "MEDIUM" | "HIGH";
export type ClaimType = "IDENTITY" | "LOCATION" | "HISTORY" | "ATMOSPHERE" | "ACCESS" | "HOURS" | "PRICE" | "POPULARITY" | "SECRECY" | "OTHER";
export type VerifiedClaim = { claim: string; type: ClaimType; status: ClaimStatus; risk: ClaimRisk; confidence: number; evidence: ResearchEvidence[]; independentSources: number; officialSourcePresent: boolean; currentEvidencePresent: boolean; preferredSourcePresent: boolean; conflictDetected: boolean; staleEvidenceOnly: boolean; publishable: boolean; reasons: string[]; };
export type ClaimVerificationResult = { candidateId: string; candidateName: string; claims: VerifiedClaim[]; publishableClaims: VerifiedClaim[]; excludedClaims: VerifiedClaim[]; minimumSafeClaimSet: string[]; candidateSafeForCopy: boolean; conflicts: number; staleClaims: number; };

function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[-–—]+/g, " ").replace(/[^a-z0-9€$]+/g, " ").replace(/\s+/g, " ").trim(); }
function tokens(value: string) { return new Set(normalize(value).split(" ").filter((token) => token.length >= 3)); }
function similarity(a: string, b: string) { const left = tokens(a); const right = tokens(b); if (!left.size || !right.size) return 0; const overlap = [...left].filter((token) => right.has(token)).length; return overlap / Math.max(left.size, right.size); }
function typeFor(claim: string): ClaimType {
  const text = claim.toLowerCase();
  if (/late-opening|night-visit|open|opening|hours|closed|closes|daily|monday|tuesday|wednesday|thursday|friday|saturday|sunday/.test(text)) return "HOURS";
  if (/price|ticket|€|eur|euro|free|admission/.test(text)) return "PRICE";
  if (/access|reservation|booking|entrance|entry|public|private/.test(text)) return "ACCESS";
  if (/historic|history|century|built|founded|created|architect|heritage|opened in \d{4}/.test(text)) return "HISTORY";
  if (/quiet|calm|peaceful|atmospheric|romantic|intimate/.test(text)) return "ATMOSPHERE";
  if (/hidden|secret|unknown|locals only|undiscovered|under-the-radar|less known/.test(text)) return "SECRECY";
  if (/popular|famous|crowded|touristy|visited|best known/.test(text)) return "POPULARITY";
  if (/address|located|street|avenue|boulevard|arrondissement|\bin paris\b|paris, france/.test(text)) return "LOCATION";
  if (/museum|garden|passage|bookshop|library|courtyard|church|chapel|atelier|workshop|restaurant|cafe|café/.test(text)) return "IDENTITY";
  return "OTHER";
}
function riskFor(type: ClaimType): ClaimRisk { if (["HOURS", "PRICE", "ACCESS", "SECRECY", "POPULARITY", "ATMOSPHERE"].includes(type)) return "HIGH"; if (["HISTORY", "LOCATION"].includes(type)) return "MEDIUM"; return "LOW"; }
function numbers(value: string): string[] { return normalize(value).match(/\b\d+(?:[.,]\d+)?\b/g) ?? []; }
function evidenceSupportsClaim(evidence: ResearchEvidence, claim: string, type: ClaimType, theme: string) {
  const targetTerms = claimTermsInText(theme, claim);
  return evidence.claims.some((sourceClaim) => {
    if (isInternalResearchClaim(sourceClaim)) return false;
    const combinedSource = `${evidence.title ?? ""} ${sourceClaim}`;
    const score = similarity(combinedSource, claim); const source = normalize(combinedSource); const target = normalize(claim);
    if (["HOURS", "ATMOSPHERE", "SECRECY", "POPULARITY"].includes(type) && targetTerms.length) {
      const sourceTerms = claimTermsInText(theme, combinedSource);
      const equivalent = equivalentClaimMatch(theme, targetTerms, sourceTerms).matched;
      const identityScore = similarity(evidence.title ?? "", claim);
      if (equivalent && identityScore >= 0.18) return true;
    }
    if (["HOURS", "PRICE", "ACCESS", "LOCATION", "HISTORY"].includes(type)) {
      const targetNumbers = numbers(claim); const sourceNumbers = numbers(combinedSource);
      const numericCompatible = !targetNumbers.length || targetNumbers.some((value) => sourceNumbers.includes(value));
      return numericCompatible && (score >= 0.48 || source.includes(target) || target.includes(source));
    }
    return score >= 0.42 || source.includes(target) || target.includes(source);
  });
}
function ageDays(evidence: ResearchEvidence, now: Date) { const date = evidence.publishedAt ?? evidence.observedAt; const time = new Date(date).getTime(); if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY; return (now.getTime() - time) / 86_400_000; }
function evidenceIsCurrent(evidence: ResearchEvidence, now: Date) { return ageDays(evidence, now) <= 30; }
function evidenceIsStale(evidence: ResearchEvidence, now: Date, type: ClaimType) { const age = ageDays(evidence, now); if (["HOURS", "PRICE", "ACCESS"].includes(type)) return age > 45; if (["LOCATION", "POPULARITY", "ATMOSPHERE", "SECRECY"].includes(type)) return age > 180; return age > 730; }
function polarity(text: string, type: ClaimType) { const value = normalize(text); if (type === "HOURS") { if (/\bclosed\b|permanently closed|temporarily closed/.test(value)) return "CLOSED"; if (/\bopen\b|opening|daily|late opening|nocturne/.test(value)) return "OPEN"; } if (type === "PRICE") { if (/\bfree\b|free admission|no charge/.test(value)) return "FREE"; if (/€|eur|euro|ticket|admission|price/.test(value) && numbers(value).length) return `PAID:${numbers(value).join(",")}`; } if (type === "ACCESS") { if (/\bprivate\b|members only|not open to public|closed to public/.test(value)) return "PRIVATE"; if (/\bpublic\b|open to public|free access/.test(value)) return "PUBLIC"; if (/reservation required|booking required|must reserve/.test(value)) return "RESERVATION_REQUIRED"; if (/no reservation|without reservation|walk in/.test(value)) return "NO_RESERVATION"; } return undefined; }
function conflictingEvidence(evidence: ResearchEvidence[], type: ClaimType) { if (!["HOURS", "PRICE", "ACCESS"].includes(type)) return false; const values = evidence.flatMap((item) => item.claims.filter((claim) => !isInternalResearchClaim(claim)).map((claim) => polarity(claim, type)).filter((value): value is string => Boolean(value))); const unique = [...new Set(values)]; if (type === "HOURS") return unique.includes("OPEN") && unique.includes("CLOSED"); if (type === "ACCESS") return (unique.includes("PUBLIC") && unique.includes("PRIVATE")) || (unique.includes("RESERVATION_REQUIRED") && unique.includes("NO_RESERVATION")); if (type === "PRICE") { const hasFree = unique.includes("FREE"); const paid = unique.filter((value) => value.startsWith("PAID:")); return (hasFree && paid.length > 0) || new Set(paid).size > 1; } return false; }

export function verifyClaim(candidate: MergedCandidate, claim: string, now = new Date()): VerifiedClaim {
  const type = typeFor(claim); const risk = riskFor(type);
  if (isInternalResearchClaim(claim)) return { claim, type, status: "REJECTED", risk, confidence: 0, evidence: [], independentSources: 0, officialSourcePresent: false, currentEvidencePresent: false, preferredSourcePresent: false, conflictDetected: false, staleEvidenceOnly: false, publishable: false, reasons: ["Internal Predator research metadata is machine-only and is permanently blocked from traveler-facing claim verification."] };
  const evidence = candidate.evidence.filter((item) => evidenceSupportsClaim(item, claim, type, candidate.theme));
  const independentSources = new Set(evidence.map((item) => item.independentKey.toLowerCase())).size;
  const officialSourcePresent = evidence.some((item) => item.sourceType === "OFFICIAL"); const currentEvidencePresent = evidence.some((item) => evidenceIsCurrent(item, now));
  const preferredSourcePresent = evidence.some((item) => sourceSupportsDomain(item, type as FactDomain).domainPreferred);
  const staleEvidenceOnly = evidence.length > 0 && evidence.every((item) => evidenceIsStale(item, now, type)); const conflictDetected = conflictingEvidence(evidence, type); const reasons: string[] = [];
  let status: ClaimStatus = "UNVERIFIED";
  if (!evidence.length) reasons.push("No evidence source directly supports this human-facing claim.");
  else if (conflictDetected) { status = "CONFLICTED"; reasons.push("Independent evidence contains contradictory operational values; publication is blocked until resolved."); }
  else if (staleEvidenceOnly) { status = "STALE"; reasons.push("All supporting evidence is beyond the freshness window for this claim type."); }
  else if (risk === "HIGH") { if (independentSources >= 2 && preferredSourcePresent && currentEvidencePresent) { status = "VERIFIED"; reasons.push("High-risk human-facing claim has two independent sources, current evidence and a source preferred for this fact domain."); } else if (independentSources >= 1) { status = "PARTIAL"; reasons.push("High-risk human-facing claim has support but lacks full independence, freshness or source authority."); } }
  else if (risk === "MEDIUM") { if ((independentSources >= 2 && currentEvidencePresent) || (officialSourcePresent && !staleEvidenceOnly)) { status = "VERIFIED"; reasons.push("Medium-risk human-facing claim has corroborated current support or non-stale official support."); } else if (independentSources >= 1) { status = "PARTIAL"; reasons.push("Medium-risk human-facing claim has only limited corroboration."); } }
  else if (independentSources >= 1 && !staleEvidenceOnly) { status = "VERIFIED"; reasons.push("Low-risk human-facing claim has at least one usable supporting source."); }
  if (type === "SECRECY" && status !== "VERIFIED") reasons.push("Secret/hidden wording is excluded unless explicitly corroborated.");
  let confidence = Math.min(44, independentSources * 20) + (officialSourcePresent ? 18 : 0) + (preferredSourcePresent ? 12 : 0) + (currentEvidencePresent ? 12 : 0) + (candidate.mergeConfidence === "HIGH" ? 9 : 0) + (risk === "LOW" ? 5 : 0) - (conflictDetected ? 45 : 0) - (staleEvidenceOnly ? 35 : 0);
  confidence = Math.max(0, Math.min(100, Math.round(confidence))); const publishable = status === "VERIFIED" && !conflictDetected && !staleEvidenceOnly;
  return { claim, type, status, risk, confidence, evidence, independentSources, officialSourcePresent, currentEvidencePresent, preferredSourcePresent, conflictDetected, staleEvidenceOnly, publishable, reasons };
}
export function verifyCandidateClaims(candidate: MergedCandidate, now = new Date()): ClaimVerificationResult {
  const claims = candidate.factualClaims.map((claim) => verifyClaim(candidate, claim, now)); const publishableClaims = claims.filter((claim) => claim.publishable && !isInternalResearchClaim(claim.claim)); const excludedClaims = claims.filter((claim) => !claim.publishable || isInternalResearchClaim(claim.claim));
  const minimumSafeClaimSet = publishableClaims.filter((claim) => ["IDENTITY", "LOCATION", "HISTORY", "OTHER"].includes(claim.type)).map((claim) => claim.claim).slice(0, 6);
  return { candidateId: candidate.id, candidateName: candidate.name, claims, publishableClaims, excludedClaims, minimumSafeClaimSet, candidateSafeForCopy: minimumSafeClaimSet.length >= 1 && publishableClaims.length >= 1, conflicts: claims.filter((claim) => claim.status === "CONFLICTED").length, staleClaims: claims.filter((claim) => claim.status === "STALE").length };
}
export function buildClaimVerificationPortfolio(candidates: MergedCandidate[], now = new Date()) { return candidates.map((candidate) => verifyCandidateClaims(candidate, now)); }
