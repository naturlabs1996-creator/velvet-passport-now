import { NextResponse } from "next/server";
import { evaluatePredatorCandidateRubric, PREDATOR_CANONICAL_CANDIDATE_RUBRIC } from "@/lib/discovery/predator-candidate-rubric";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const strong = evaluatePredatorCandidateRubric({
    qualityExperience: { score: 8.8, justification: "Strong singular on-site experience." },
    access: { score: 8.1, gate: "PASS", justification: "Reliably visible and understandable on site." },
    trust: { score: 9, justification: "Primary/institutional corroboration." },
    microLocalization: { score: 8.4, justification: "Address and frontage constrained." },
    narrative: { score: 8.7, justification: "Memorable causal story with reveal." },
    visualAudiovisualPayoff: { score: 8.2, justification: "Authentic visual and physical look-for." },
    exposureDegree: { score: 8.3, justification: "Exact angle absent from major tourism channels." },
    singularity: "High",
    placeContinuity: "Good",
    exposureSourceQuality: "Official tourism + marketplace + travel editorial checked",
  });

  const unknownExposure = evaluatePredatorCandidateRubric({
    qualityExperience: { score: 9.2, justification: "Exceptional." },
    access: { score: 9, gate: "PASS", justification: "Excellent access." },
    trust: { score: 9, justification: "Strong documentation." },
    microLocalization: { score: 8.8, justification: "Very precise." },
    narrative: { score: 9.3, justification: "Excellent." },
    visualAudiovisualPayoff: { score: 8.9, justification: "Excellent." },
    exposureDegree: { score: null, justification: "Exposure audit not yet complete." },
  });

  const overexposed = evaluatePredatorCandidateRubric({
    qualityExperience: { score: 9.6, justification: "Spectacular history." },
    access: { score: 8.8, gate: "PASS", justification: "Good access." },
    trust: { score: 9.4, justification: "Excellent documentation." },
    microLocalization: { score: 9, justification: "Exact." },
    narrative: { score: 9.8, justification: "Outstanding narrative." },
    visualAudiovisualPayoff: { score: 9.1, justification: "Excellent payoff." },
    exposureDegree: { score: 5.9, justification: "Same angle already packaged for tourists." },
  });

  const accessUnknown = evaluatePredatorCandidateRubric({
    qualityExperience: { score: 8, justification: "Strong." },
    access: { score: 7.5, gate: "UNKNOWN", justification: "Current traveler access not verified." },
    trust: { score: 8, justification: "Good." },
    microLocalization: { score: 8, justification: "Good." },
    narrative: { score: 8, justification: "Good." },
    visualAudiovisualPayoff: { score: 8, justification: "Good." },
    exposureDegree: { score: 8, justification: "Low tourist exposure." },
  });

  const checks = {
    strongCanLock: strong.verdict === "LOCK" && strong.lockEligible,
    unknownExposureHolds: unknownExposure.verdict === "HOLD" && !unknownExposure.lockEligible,
    overexposureRejectsDespiteHighOtherScores: overexposed.verdict === "REJECT" && !overexposed.lockEligible,
    unknownAccessHolds: accessUnknown.verdict === "HOLD" && !accessUnknown.lockEligible,
  };

  const ok = Object.values(checks).every(Boolean);

  return NextResponse.json({
    ok,
    checks,
    rubric: PREDATOR_CANONICAL_CANDIDATE_RUBRIC,
    cases: { strong, unknownExposure, overexposed, accessUnknown },
  }, { status: ok ? 200 : 500, headers: { "cache-control": "no-store, max-age=0" } });
}
