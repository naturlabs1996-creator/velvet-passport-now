export type IntegrityCheckInput = {
  claimId: string;
  claimText: string;
  claimedStatus: "HYPOTHESIS" | "PROBABLE" | "VERIFIED";
  claimedConfidence: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  sourceIds: string[];
  sourceUrls: string[];
  independentSourceFamilies: number;
  contradictionsKnown: string[];
  contradictionsDisclosed: string[];
  verifierStatus?: "HYPOTHESIS" | "PROBABLE" | "VERIFIED";
  verifierConfidence?: "NONE" | "LOW" | "MEDIUM" | "HIGH";
};

export type IntegrityVerdict = {
  claimId: string;
  verdict: "PASS" | "HOLD" | "KILL_SWITCH";
  reasons: string[];
  integrityViolationDetected: boolean;
};

const rank = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 } as const;
const statusRank = { HYPOTHESIS: 0, PROBABLE: 1, VERIFIED: 2 } as const;

export function verifyIntegrity(input: IntegrityCheckInput): IntegrityVerdict {
  const reasons: string[] = [];
  let kill = false;
  let hold = false;

  if (input.sourceIds.length === 0 || input.sourceUrls.length === 0) {
    reasons.push("Claim has no traceable evidence.");
    if (input.claimedStatus === "VERIFIED") kill = true;
    else hold = true;
  }

  if (input.claimedStatus === "VERIFIED" && input.independentSourceFamilies < 1) {
    reasons.push("Verification was claimed without an independent source family.");
    kill = true;
  }

  const undisclosed = input.contradictionsKnown.filter((item) => !input.contradictionsDisclosed.includes(item));
  if (undisclosed.length > 0) {
    reasons.push("Known contradictions were not disclosed.");
    kill = true;
  }

  if (input.verifierStatus && statusRank[input.claimedStatus] > statusRank[input.verifierStatus]) {
    reasons.push("Primary agent claimed a stronger factual status than the independent verifier.");
    hold = true;
  }

  if (input.verifierConfidence && rank[input.claimedConfidence] > rank[input.verifierConfidence]) {
    reasons.push("Primary agent claimed higher confidence than the independent verifier.");
    hold = true;
  }

  if (kill) {
    return { claimId: input.claimId, verdict: "KILL_SWITCH", reasons, integrityViolationDetected: true };
  }
  if (hold) {
    return { claimId: input.claimId, verdict: "HOLD", reasons, integrityViolationDetected: false };
  }
  return {
    claimId: input.claimId,
    verdict: "PASS",
    reasons: ["Independent verification found no integrity mismatch."],
    integrityViolationDetected: false,
  };
}

export const INDEPENDENT_INTEGRITY_RULE =
  "Predator cannot be the sole judge of its own factual status. An independent verifier compares evidence trace, source-family support, contradictions, factual status and confidence. Mismatch forces HOLD; missing or concealed evidence behind a VERIFIED claim triggers KILL_SWITCH.";
