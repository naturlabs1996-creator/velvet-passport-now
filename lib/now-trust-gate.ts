export type TrustRisk = "low" | "medium" | "high" | "unknown";
export type TrustVerificationStatus = "approved" | "review_required" | "rejected";
export type TrustSubject =
  | "restaurant"
  | "food-experience"
  | "museum-ticket"
  | "attraction-ticket"
  | "tour-activity"
  | "transport"
  | "other";

export type TrustEvidence = {
  source: string;
  kind: "official" | "local-editorial" | "independent-reviews" | "municipal" | "provider" | "other";
  independent: boolean;
  verifiedAt: string;
  positive?: boolean;
};

export type TrustAssessmentInput = {
  provider: string;
  subject?: TrustSubject;
  evidence?: TrustEvidence[];
  touristTrapRisk?: TrustRisk;
  massMarketRisk?: TrustRisk;
  editorialApproved?: boolean;
  lesserKnown?: boolean;
};

export type TrustAssessment = {
  status: TrustVerificationStatus;
  trustScore: number;
  independentEvidenceCount: number;
  touristTrapRisk: TrustRisk;
  massMarketRisk: TrustRisk;
  subject: TrustSubject;
  lesserKnown: boolean;
  requiredIndependentEvidence: number;
  reason: string;
};

const MAX_EVIDENCE_AGE_DAYS = 120;

function evidenceFresh(verifiedAt: string) {
  const ts = Date.parse(verifiedAt);
  if (!Number.isFinite(ts)) return false;
  const age = Date.now() - ts;
  return age >= 0 && age <= MAX_EVIDENCE_AGE_DAYS * 24 * 60 * 60 * 1000;
}

function requiredEvidence(subject: TrustSubject, lesserKnown: boolean) {
  if (subject === "restaurant" || subject === "food-experience") return 2;
  if (lesserKnown) return 2;
  if (subject === "museum-ticket" || subject === "attraction-ticket" || subject === "tour-activity") return 1;
  return 1;
}

function strictTouristRisk(subject: TrustSubject) {
  return subject === "restaurant" || subject === "food-experience";
}

export function assessNowTrust(input: TrustAssessmentInput): TrustAssessment {
  const subject = input.subject ?? "other";
  const lesserKnown = Boolean(input.lesserKnown);
  const requiredIndependentEvidence = requiredEvidence(subject, lesserKnown);
  const evidence = (input.evidence ?? []).filter((item) => evidenceFresh(item.verifiedAt));
  const independentEvidence = evidence.filter((item) => item.independent && item.kind !== "provider");
  const positiveIndependent = independentEvidence.filter((item) => item.positive !== false);
  const negativeIndependent = independentEvidence.filter((item) => item.positive === false);
  const touristTrapRisk = input.touristTrapRisk ?? "unknown";
  const massMarketRisk = input.massMarketRisk ?? "unknown";
  const strict = strictTouristRisk(subject);

  let score = strict ? 30 : lesserKnown ? 35 : 45;
  score += Math.min(40, positiveIndependent.length * 20);
  score -= Math.min(50, negativeIndependent.length * 25);
  if (input.editorialApproved) score += 15;
  if (touristTrapRisk === "medium") score -= strict ? 25 : 10;
  if (touristTrapRisk === "high") score -= 50;
  if (massMarketRisk === "medium") score -= strict ? 20 : 10;
  if (massMarketRisk === "high") score -= 40;
  score = Math.max(0, Math.min(100, score));

  if (touristTrapRisk === "high" || massMarketRisk === "high" || negativeIndependent.length >= 2) {
    return {
      status: "rejected",
      trustScore: score,
      independentEvidenceCount: independentEvidence.length,
      touristTrapRisk,
      massMarketRisk,
      subject,
      lesserKnown,
      requiredIndependentEvidence,
      reason: "Independent evidence indicates a material quality or tourist-mass-market risk.",
    };
  }

  const enoughIndependentEvidence = positiveIndependent.length >= requiredIndependentEvidence;
  // High-risk cases have already returned above. Food still requires explicitly low tourist-trap risk.
  const acceptableRisk = strict ? touristTrapRisk === "low" : true;
  const minimumScore = strict ? 70 : lesserKnown ? 70 : 55;

  if (enoughIndependentEvidence && acceptableRisk && score >= minimumScore) {
    return {
      status: "approved",
      trustScore: score,
      independentEvidenceCount: independentEvidence.length,
      touristTrapRisk,
      massMarketRisk,
      subject,
      lesserKnown,
      requiredIndependentEvidence,
      reason: strict
        ? "Food recommendation passed the strict NOW cross-check with at least two recent independent confirmations and low tourist-trap risk."
        : lesserKnown
          ? "Lesser-known recommendation passed an elevated NOW cross-check with at least two recent independent confirmations."
          : "Recommendation passed the risk-weighted NOW cross-check for this category.",
    };
  }

  return {
    status: "review_required",
    trustScore: score,
    independentEvidenceCount: independentEvidence.length,
    touristTrapRisk,
    massMarketRisk,
    subject,
    lesserKnown,
    requiredIndependentEvidence,
    reason: strict
      ? "Food recommendations require at least two recent independent confirmations and low tourist-trap risk before NOW recommends them."
      : lesserKnown
        ? "Lesser-known places require at least two recent independent confirmations before NOW recommends them."
        : `This category requires at least ${requiredIndependentEvidence} recent independent confirmation before NOW recommends it.`,
  };
}

export function passesNowTrustGate(input: TrustAssessmentInput) {
  return assessNowTrust(input).status === "approved";
}
