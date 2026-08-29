import type { MergedCandidate } from "./evidence-normalizer";
import type { ClaimVerificationResult, VerifiedClaim } from "./claim-verifier";

export type SafeCopyStatus = "READY" | "PARTIAL" | "HOLD";

export type SafeCopySentence = {
  text: string;
  claimTypes: string[];
  sourceIds: string[];
  sourceUrls: string[];
};

export type SafeDiscoveryCopy = {
  candidateId: string;
  name: string;
  status: SafeCopyStatus;
  title: string;
  summary: SafeCopySentence[];
  facts: SafeCopySentence[];
  omittedClaims: string[];
  sourceCount: number;
  qualityNotes: string[];
};

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function sentenceFromClaim(claim: VerifiedClaim): SafeCopySentence {
  const sourceIds = [...new Set(claim.evidence.map((item) => item.sourceId))];
  const sourceUrls = [...new Set(claim.evidence.map((item) => item.url))];
  const raw = clean(claim.claim).replace(/[.!?]+$/, "");
  return {
    text: `${raw}.`,
    claimTypes: [claim.type],
    sourceIds,
    sourceUrls,
  };
}

function selectClaims(result: ClaimVerificationResult) {
  // Strict whitelist: only claims marked publishable by the Claim-Level Verifier.
  // No excluded claim may be paraphrased or reconstructed here.
  return result.publishableClaims.filter((claim) => claim.status === "VERIFIED" && claim.publishable);
}

function rankClaim(claim: VerifiedClaim) {
  const typeRank: Record<string, number> = {
    IDENTITY: 100,
    LOCATION: 95,
    HISTORY: 80,
    ACCESS: 75,
    HOURS: 70,
    PRICE: 65,
    ATMOSPHERE: 55,
    SECRECY: 50,
    POPULARITY: 45,
    OTHER: 40,
  };
  return (typeRank[claim.type] ?? 0) + claim.confidence / 10;
}

export function composeSafeDiscoveryCopy(candidate: MergedCandidate, verification: ClaimVerificationResult): SafeDiscoveryCopy {
  if (candidate.id !== verification.candidateId) {
    return {
      candidateId: candidate.id,
      name: candidate.name,
      status: "HOLD",
      title: candidate.name,
      summary: [],
      facts: [],
      omittedClaims: candidate.factualClaims,
      sourceCount: 0,
      qualityNotes: ["Candidate and claim verification IDs do not match."],
    };
  }

  const allowed = selectClaims(verification).sort((a, b) => rankClaim(b) - rankClaim(a));
  const core = allowed.filter((claim) => ["IDENTITY", "LOCATION", "HISTORY", "OTHER"].includes(claim.type));
  const contextual = allowed.filter((claim) => !["IDENTITY", "LOCATION", "HISTORY", "OTHER"].includes(claim.type));
  const summaryClaims = [...core.slice(0, 2), ...contextual.slice(0, 1)].slice(0, 3);
  const factsClaims = allowed.filter((claim) => !summaryClaims.includes(claim)).slice(0, 6);
  const sourceCount = new Set(allowed.flatMap((claim) => claim.evidence.map((item) => item.independentKey))).size;
  const omittedClaims = verification.excludedClaims.map((claim) => claim.claim);
  const qualityNotes: string[] = [
    "Copy is composed only from Claim-Level Verifier whitelist entries.",
    "Excluded claims are never paraphrased, softened or reintroduced.",
    "Every factual sentence retains source IDs and URLs for auditability.",
  ];

  let status: SafeCopyStatus = "HOLD";
  if (core.length >= 1 && allowed.length >= 2) status = "READY";
  else if (allowed.length >= 1) status = "PARTIAL";
  else qualityNotes.push("No verified claim is available for safe copy.");

  return {
    candidateId: candidate.id,
    name: candidate.name,
    status,
    title: candidate.name,
    summary: summaryClaims.map(sentenceFromClaim),
    facts: factsClaims.map(sentenceFromClaim),
    omittedClaims,
    sourceCount,
    qualityNotes,
  };
}

export function buildSafeCopyPortfolio(
  candidates: MergedCandidate[],
  verifications: ClaimVerificationResult[],
) {
  return candidates.map((candidate) => {
    const verification = verifications.find((item) => item.candidateId === candidate.id);
    if (!verification) {
      return {
        candidateId: candidate.id,
        name: candidate.name,
        status: "HOLD" as const,
        title: candidate.name,
        summary: [],
        facts: [],
        omittedClaims: candidate.factualClaims,
        sourceCount: 0,
        qualityNotes: ["No Claim-Level Verification result exists for this candidate."],
      };
    }
    return composeSafeDiscoveryCopy(candidate, verification);
  });
}
