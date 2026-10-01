export type PredatorCandidateVerdict = "LOCK" | "HOLD" | "RESERVE" | "REJECT";
export type GateState = "PASS" | "FAIL" | "UNKNOWN";

export type PredatorCriterion =
  | "qualityExperience"
  | "access"
  | "trust"
  | "microLocalization"
  | "narrative"
  | "visualAudiovisualPayoff"
  | "exposureDegree";

export type PredatorCriterionScore = {
  score: number | null;
  justification: string;
};

export type PredatorCandidateRubricInput = {
  qualityExperience: PredatorCriterionScore;
  access: PredatorCriterionScore & { gate: GateState };
  trust: PredatorCriterionScore;
  microLocalization: PredatorCriterionScore;
  narrative: PredatorCriterionScore;
  visualAudiovisualPayoff: PredatorCriterionScore;
  exposureDegree: PredatorCriterionScore;
  singularity?: string;
  placeContinuity?: string;
  placeAnchorType?: "SURVIVING_BUILDING" | "POST_EVENT_BUILDING" | "CURRENT_CIVIC_ADDRESS" | "CURRENT_PARCEL" | "PUBLIC_PLACE" | "SQUARE" | "PARK" | "INTERSECTION" | "OTHER_EXISTING_ANCHOR" | "LOST_UNANCHORED";
  exposureSourceQuality?: string;
};

export type PredatorCandidateRubricResult = {
  scores: Record<PredatorCriterion, PredatorCriterionScore>;
  gates: {
    access: GateState;
    exposure: GateState;
  };
  exposureBand: "PASS_NORMAL" | "EXCEPTION_ONLY" | "FAIL" | "UNKNOWN";
  verdict: PredatorCandidateVerdict;
  averageKnownScore: number | null;
  lockEligible: boolean;
  reasons: string[];
  nonScored: {
    singularity?: string;
    placeContinuity?: string;
    placeAnchorType?: "SURVIVING_BUILDING" | "POST_EVENT_BUILDING" | "CURRENT_CIVIC_ADDRESS" | "CURRENT_PARCEL" | "PUBLIC_PLACE" | "SQUARE" | "PARK" | "INTERSECTION" | "OTHER_EXISTING_ANCHOR" | "LOST_UNANCHORED";
    exposureSourceQuality?: string;
  };
};

function normalizeScore(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}

function exposureBand(score: number | null) {
  if (score === null) return "UNKNOWN" as const;
  if (score >= 7) return "PASS_NORMAL" as const;
  if (score >= 6.5) return "EXCEPTION_ONLY" as const;
  return "FAIL" as const;
}

export function evaluatePredatorCandidateRubric(
  input: PredatorCandidateRubricInput,
): PredatorCandidateRubricResult {
  const scores = {
    qualityExperience: { ...input.qualityExperience, score: normalizeScore(input.qualityExperience.score) },
    access: { ...input.access, score: normalizeScore(input.access.score) },
    trust: { ...input.trust, score: normalizeScore(input.trust.score) },
    microLocalization: { ...input.microLocalization, score: normalizeScore(input.microLocalization.score) },
    narrative: { ...input.narrative, score: normalizeScore(input.narrative.score) },
    visualAudiovisualPayoff: { ...input.visualAudiovisualPayoff, score: normalizeScore(input.visualAudiovisualPayoff.score) },
    exposureDegree: { ...input.exposureDegree, score: normalizeScore(input.exposureDegree.score) },
  };

  const exposure = exposureBand(scores.exposureDegree.score);
  const exposureGate: GateState =
    exposure === "UNKNOWN" ? "UNKNOWN" :
    exposure === "FAIL" ? "FAIL" :
    "PASS";

  const known = Object.values(scores)
    .map((item) => item.score)
    .filter((value): value is number => typeof value === "number");
  const averageKnownScore = known.length
    ? Math.round((known.reduce((sum, value) => sum + value, 0) / known.length) * 10) / 10
    : null;

  const reasons: string[] = [];

  // Absolute gates: neither can be compensated by other high scores.
  if (input.access.gate === "FAIL") reasons.push("Access is an absolute gate and failed.");
  if (input.access.gate === "UNKNOWN") reasons.push("Access is an absolute gate and remains unknown.");
  if (exposureGate === "FAIL") reasons.push("Exposure Degree is below 6.5/10 and cannot be compensated by historical strength.");
  if (exposureGate === "UNKNOWN") reasons.push("Exposure is unknown; candidate must HOLD and can never LOCK.");
  if (exposure === "EXCEPTION_ONLY") reasons.push("Exposure 6.5–6.9/10 is exception-only and requires an exceptional experience with strong access.");

  const anyUnknownCore = [
    scores.qualityExperience.score,
    scores.trust.score,
    scores.microLocalization.score,
    scores.narrative.score,
    scores.visualAudiovisualPayoff.score,
  ].some((value) => value === null);

  if (anyUnknownCore) reasons.push("At least one non-gate criterion is still unscored.");

  const placeAnchorUnresolved = input.placeAnchorType === "LOST_UNANCHORED";
  if (placeAnchorUnresolved) {
    reasons.push("The historical building may be gone, which is acceptable, but the event is not yet defensibly anchored to a current civic address, parcel, public place, square, park, intersection or other existing physical reference.");
  }

  let verdict: PredatorCandidateVerdict;
  let lockEligible = false;

  if (input.access.gate === "FAIL" || exposureGate === "FAIL") {
    verdict = "REJECT";
  } else if (input.access.gate === "UNKNOWN" || exposureGate === "UNKNOWN" || anyUnknownCore || placeAnchorUnresolved) {
    verdict = "HOLD";
  } else if (exposure === "EXCEPTION_ONLY") {
    verdict = "RESERVE";
  } else {
    verdict = "LOCK";
    lockEligible = true;
    reasons.push("All seven criteria are scored, Access passed its absolute gate, and Exposure is at least 7/10 in Velvet's favor.");
  }

  return {
    scores,
    gates: { access: input.access.gate, exposure: exposureGate },
    exposureBand: exposure,
    verdict,
    averageKnownScore,
    lockEligible,
    reasons,
    nonScored: {
      singularity: input.singularity,
      placeContinuity: input.placeContinuity,
      placeAnchorType: input.placeAnchorType,
      exposureSourceQuality: input.exposureSourceQuality,
    },
  };
}

export const PREDATOR_CANONICAL_CANDIDATE_RUBRIC = {
  criteria: [
    "Quality / Experience",
    "Access",
    "Trust",
    "Micro-localisation",
    "Narrative",
    "Visual / Audiovisual Payoff",
    "Exposure Degree",
  ],
  exposureThresholds: {
    normalPass: ">= 7.0/10 in Velvet's favor",
    exceptionOnly: "6.5–6.9/10",
    reserveOrReject: "< 6.5/10",
    unknown: "HOLD — never LOCK",
  },
  absoluteGates: ["Access", "Exposure Degree"],
  nonScoredReportFields: [
    "Singularity / Uniqueness",
    "Continuity of place/building",
    "Existing-place anchor type when the historical building has disappeared",
    "Quality of exact sources used for Exposure",
  ],
  placeContinuityDoctrine:
    "Survival of the historical building is not required. A demolished or transformed building remains eligible when the historical event can be defensibly tied to a current civic address, current parcel, public place, square, park, intersection or another existing physical anchor. A building erected after the historical event is POST_EVENT_BUILDING: it may anchor the present-day location but must never be described as a material witness to the event. Demolition or later construction by itself never causes REJECT. What fails is an unanchored or materially vague historical location.",
  doctrine:
    "A spectacular historical story can still be rejected. Access and Exposure are absolute gates and cannot be averaged away by stronger scores elsewhere. Building survival is not an absolute gate; defensible continuity of place is what matters. A LOST_UNANCHORED site cannot LOCK and remains HOLD until a current physical anchor is established.",
} as const;
