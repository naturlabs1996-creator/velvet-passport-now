import type { MergedCandidate } from "./evidence-normalizer";
import type { ResearchEvidence } from "./research-verification";

export type ClaimStatus = "VERIFIED" | "PARTIAL" | "UNVERIFIED" | "REJECTED";
export type ClaimRisk = "LOW" | "MEDIUM" | "HIGH";
export type ClaimType = "IDENTITY" | "LOCATION" | "HISTORY" | "ATMOSPHERE" | "ACCESS" | "HOURS" | "PRICE" | "POPULARITY" | "SECRECY" | "OTHER";

export type VerifiedClaim = {
  claim: string;
  type: ClaimType;
  status: ClaimStatus;
  risk: ClaimRisk;
  confidence: number;
  evidence: ResearchEvidence[];
  independentSources: number;
  officialSourcePresent: boolean;
  currentEvidencePresent: boolean;
  publishable: boolean;
  reasons: string[];
};

export type ClaimVerificationResult = {
  candidateId: string;
  candidateName: string;
  claims: VerifiedClaim[];
  publishableClaims: VerifiedClaim[];
  excludedClaims: VerifiedClaim[];
  minimumSafeClaimSet: string[];
  candidateSafeForCopy: boolean;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  return new Set(normalize(value).split(" ").filter((token) => token.length >= 3));
}

function similarity(a: string, b: string) {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  const overlap = [...left].filter((token) => right.has(token)).length;
  return overlap / Math.max(left.size, right.size);
}

function typeFor(claim: string): ClaimType {
  const text = claim.toLowerCase();
  if (/address|located|street|avenue|boulevard|arrondissement|paris/.test(text)) return "LOCATION";
  if (/open|opening|hours|closed|closes|daily|monday|tuesday|wednesday|thursday|friday|saturday|sunday/.test(text)) return "HOURS";
  if (/price|ticket|€|eur|euro|free|admission/.test(text)) return "PRICE";
  if (/access|reservation|booking|entrance|entry|public|private/.test(text)) return "ACCESS";
  if (/historic|history|century|built|founded|created|architect|heritage/.test(text)) return "HISTORY";
  if (/quiet|calm|peaceful|atmospheric|romantic|intimate/.test(text)) return "ATMOSPHERE";
  if (/hidden|secret|unknown|locals only|undiscovered/.test(text)) return "SECRECY";
  if (/popular|famous|crowded|touristy|visited|best known/.test(text)) return "POPULARITY";
  if (/museum|garden|passage|bookshop|library|courtyard|church|chapel|atelier|workshop|restaurant|cafe|café/.test(text)) return "IDENTITY";
  return "OTHER";
}

function riskFor(type: ClaimType): ClaimRisk {
  if (["HOURS", "PRICE", "ACCESS", "SECRECY", "POPULARITY", "ATMOSPHERE"].includes(type)) return "HIGH";
  if (["HISTORY", "LOCATION"].includes(type)) return "MEDIUM";
  return "LOW";
}

function evidenceSupportsClaim(evidence: ResearchEvidence, claim: string) {
  return evidence.claims.some((sourceClaim) => similarity(sourceClaim, claim) >= 0.45 || normalize(sourceClaim).includes(normalize(claim)) || normalize(claim).includes(normalize(sourceClaim)));
}

function evidenceIsCurrent(evidence: ResearchEvidence, now: Date) {
  const date = evidence.publishedAt ?? evidence.observedAt;
  const time = new Date(date).getTime();
  if (!Number.isFinite(time)) return false;
  return (now.getTime() - time) / 86_400_000 <= 30;
}

export function verifyClaim(candidate: MergedCandidate, claim: string, now = new Date()): VerifiedClaim {
  const type = typeFor(claim);
  const risk = riskFor(type);
  const evidence = candidate.evidence.filter((item) => evidenceSupportsClaim(item, claim));
  const independentSources = new Set(evidence.map((item) => item.independentKey.toLowerCase())).size;
  const officialSourcePresent = evidence.some((item) => item.sourceType === "OFFICIAL");
  const currentEvidencePresent = evidence.some((item) => evidenceIsCurrent(item, now));
  const reasons: string[] = [];

  let status: ClaimStatus = "UNVERIFIED";
  if (!evidence.length) {
    reasons.push("No evidence source directly supports this claim.");
  } else if (risk === "HIGH") {
    if (independentSources >= 2 && (officialSourcePresent || currentEvidencePresent)) {
      status = "VERIFIED";
      reasons.push("High-risk claim has at least two independent supporting sources and current or official support.");
    } else if (independentSources >= 1) {
      status = "PARTIAL";
      reasons.push("High-risk claim has some support but not enough for publication.");
    }
  } else if (risk === "MEDIUM") {
    if (independentSources >= 2 || officialSourcePresent) {
      status = "VERIFIED";
      reasons.push("Medium-risk claim has corroborated or official support.");
    } else if (independentSources >= 1) {
      status = "PARTIAL";
      reasons.push("Medium-risk claim has only one independent source.");
    }
  } else {
    if (independentSources >= 1) {
      status = "VERIFIED";
      reasons.push("Low-risk factual claim has at least one supporting source.");
    }
  }

  if (type === "SECRECY" && status !== "VERIFIED") {
    reasons.push("Secret/hidden wording is excluded unless explicitly corroborated.");
  }

  let confidence = 0;
  confidence += Math.min(50, independentSources * 22);
  if (officialSourcePresent) confidence += 20;
  if (currentEvidencePresent) confidence += 15;
  if (candidate.mergeConfidence === "HIGH") confidence += 10;
  if (risk === "LOW") confidence += 5;
  confidence = Math.max(0, Math.min(100, Math.round(confidence)));

  const publishable = status === "VERIFIED";
  return {
    claim,
    type,
    status,
    risk,
    confidence,
    evidence,
    independentSources,
    officialSourcePresent,
    currentEvidencePresent,
    publishable,
    reasons,
  };
}

export function verifyCandidateClaims(candidate: MergedCandidate, now = new Date()): ClaimVerificationResult {
  const claims = candidate.factualClaims.map((claim) => verifyClaim(candidate, claim, now));
  const publishableClaims = claims.filter((claim) => claim.publishable);
  const excludedClaims = claims.filter((claim) => !claim.publishable);
  const minimumSafeClaimSet = publishableClaims
    .filter((claim) => ["IDENTITY", "LOCATION", "HISTORY", "OTHER"].includes(claim.type))
    .map((claim) => claim.claim)
    .slice(0, 6);

  return {
    candidateId: candidate.id,
    candidateName: candidate.name,
    claims,
    publishableClaims,
    excludedClaims,
    minimumSafeClaimSet,
    candidateSafeForCopy: minimumSafeClaimSet.length >= 1,
  };
}

export function buildClaimVerificationPortfolio(candidates: MergedCandidate[], now = new Date()) {
  return candidates.map((candidate) => verifyCandidateClaims(candidate, now));
}
