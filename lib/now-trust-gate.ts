export type TrustRisk = "low" | "medium" | "high" | "unknown";
export type TrustVerificationStatus = "approved" | "review_required" | "rejected";

export type TrustEvidence = {
  source: string;
  kind: "official" | "local-editorial" | "independent-reviews" | "municipal" | "provider" | "other";
  independent: boolean;
  verifiedAt: string;
  positive?: boolean;
};

export type TrustAssessmentInput = {
  provider: string;
  evidence?: TrustEvidence[];
  touristTrapRisk?: TrustRisk;
  massMarketRisk?: TrustRisk;
  editorialApproved?: boolean;
};

export type TrustAssessment = {
  status: TrustVerificationStatus;
  trustScore: number;
  independentEvidenceCount: number;
  touristTrapRisk: TrustRisk;
  massMarketRisk: TrustRisk;
  reason: string;
};

const MAX_EVIDENCE_AGE_DAYS = 120;

function evidenceFresh(verifiedAt: string) {
  const ts = Date.parse(verifiedAt);
  if (!Number.isFinite(ts)) return false;
  const age = Date.now() - ts;
  return age >= 0 && age <= MAX_EVIDENCE_AGE_DAYS * 24 * 60 * 60 * 1000;
}

export function assessNowTrust(input: TrustAssessmentInput): TrustAssessment {
  const evidence = (input.evidence ?? []).filter((item) => evidenceFresh(item.verifiedAt));
  const independentEvidence = evidence.filter((item) => item.independent && item.kind !== "provider");
  const positiveIndependent = independentEvidence.filter((item) => item.positive !== false);
  const negativeIndependent = independentEvidence.filter((item) => item.positive === false);
  const touristTrapRisk = input.touristTrapRisk ?? "unknown";
  const massMarketRisk = input.massMarketRisk ?? "unknown";

  let score = 35;
  score += Math.min(40, positiveIndependent.length * 20);
  score -= Math.min(50, negativeIndependent.length * 25);
  if (input.editorialApproved) score += 15;
  if (touristTrapRisk === "medium") score -= 20;
  if (touristTrapRisk === "high") score -= 50;
  if (massMarketRisk === "medium") score -= 15;
  if (massMarketRisk === "high") score -= 40;
  score = Math.max(0, Math.min(100, score));

  if (touristTrapRisk === "high" || massMarketRisk === "high" || negativeIndependent.length >= 2) {
    return {
      status: "rejected",
      trustScore: score,
      independentEvidenceCount: independentEvidence.length,
      touristTrapRisk,
      massMarketRisk,
      reason: "Independent evidence indicates a material quality or tourist-mass-market risk.",
    };
  }

  const enoughIndependentEvidence = positiveIndependent.length >= 2;
  const acceptableRisk = touristTrapRisk !== "medium" && massMarketRisk !== "medium";
  if (enoughIndependentEvidence && acceptableRisk && score >= 70) {
    return {
      status: "approved",
      trustScore: score,
      independentEvidenceCount: independentEvidence.length,
      touristTrapRisk,
      massMarketRisk,
      reason: "Cross-checked by at least two recent independent sources and passed NOW risk thresholds.",
    };
  }

  return {
    status: "review_required",
    trustScore: score,
    independentEvidenceCount: independentEvidence.length,
    touristTrapRisk,
    massMarketRisk,
    reason: "Not enough recent independent evidence to carry a NOW recommendation.",
  };
}

export function passesNowTrustGate(input: TrustAssessmentInput) {
  return assessNowTrust(input).status === "approved";
}
