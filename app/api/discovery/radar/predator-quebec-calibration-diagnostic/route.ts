import { NextResponse } from "next/server";
import { evaluatePredatorCandidateRubric } from "@/lib/discovery/predator-candidate-rubric";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function base(overrides: Record<string, any> = {}) {
  return {
    qualityExperience: { score: 8.7, justification: "Strong on-site historical experience." },
    access: { score: 8.2, gate: "PASS" as const, justification: "Traveler can reliably reach and understand the present-day anchor." },
    trust: { score: 8.8, justification: "Institutional/archival evidence is coherent." },
    microLocalization: { score: 8.3, justification: "Historical event is tightly constrained to the present-day anchor." },
    narrative: { score: 8.9, justification: "Strong causal story with a memorable reveal." },
    visualAudiovisualPayoff: { score: 8.0, justification: "Authentic visual or physical look-for exists." },
    exposureDegree: { score: 8.1, justification: "Exact angle remains weakly exposed in tourism-facing sources." },
    singularity: "High",
    exposureSourceQuality: "Official tourism + Tripadvisor/Viator/GetYourGuide/Google/Maps + travel editorial checked.",
    ...overrides,
  };
}

export async function GET() {
  const survivingBuilding = evaluatePredatorCandidateRubric(base({
    placeAnchorType: "SURVIVING_BUILDING",
    placeContinuity: "Historical building survives substantially in place.",
  }));

  const postEventBuilding = evaluatePredatorCandidateRubric(base({
    placeAnchorType: "POST_EVENT_BUILDING",
    placeContinuity: "Current building is old but was erected after the historical event; it is a spatial anchor only, not a material witness.",
    microLocalization: { score: 8.1, justification: "Historical location is well tied to the present address/footprint, but material continuity is absent." },
    visualAudiovisualPayoff: { score: 7.4, justification: "Current building helps orient the traveler, while archival imagery must carry the historical material truth." },
  }));

  const transformedBuilding = evaluatePredatorCandidateRubric(base({
    placeAnchorType: "CURRENT_CIVIC_ADDRESS",
    placeContinuity: "Building transformed, but the historical location is defensibly tied to the current civic address.",
    microLocalization: { score: 7.8, justification: "Current address is strong; historical fabric continuity is partial." },
  }));

  const demolishedCurrentParcel = evaluatePredatorCandidateRubric(base({
    placeAnchorType: "CURRENT_PARCEL",
    placeContinuity: "Historical building demolished; archival/cadastral chain ties the event to a current parcel.",
    microLocalization: { score: 8.5, justification: "Historical parcel-to-current parcel continuity is defensible." },
    visualAudiovisualPayoff: { score: 7.1, justification: "Building is gone, but map/plan imagery and present parcel context support the experience." },
  }));

  const demolishedNowPark = evaluatePredatorCandidateRubric(base({
    placeAnchorType: "PARK",
    placeContinuity: "Historical building/site disappeared; the footprint is now a named public park with defensible spatial continuity.",
    microLocalization: { score: 8.2, justification: "Historical footprint can be placed within the current park." },
    visualAudiovisualPayoff: { score: 7.6, justification: "Historic plan/photo can be overlaid narratively against the current park." },
  }));

  const competingParcels = evaluatePredatorCandidateRubric(base({
    placeAnchorType: "CURRENT_PARCEL",
    placeContinuity: "Two current parcels remain plausible; no final geometric reconciliation yet.",
    microLocalization: { score: null, justification: "Competing parcel hypotheses remain unresolved." },
  }));

  const vanishedUnanchored = evaluatePredatorCandidateRubric(base({
    placeAnchorType: "LOST_UNANCHORED",
    placeContinuity: "Building and street fabric disappeared; only neighborhood-level placement is currently defensible.",
    microLocalization: { score: 4.2, justification: "Only a broad zone is known; no present physical anchor is defensible yet." },
    narrative: { score: 9.6, justification: "Exceptional story, but narrative strength cannot substitute for location continuity." },
  }));

  const spectacularButOverexposed = evaluatePredatorCandidateRubric(base({
    placeAnchorType: "SQUARE",
    placeContinuity: "Historical event is precisely tied to the current square.",
    qualityExperience: { score: 9.7, justification: "Exceptional experience." },
    narrative: { score: 9.8, justification: "Exceptional story." },
    exposureDegree: { score: 5.8, justification: "Destination tourism and mainstream traveler sources already package the exact angle." },
  }));

  const checks = {
    survivingBuildingCanLock: survivingBuilding.verdict === "LOCK",
    postEventBuildingCanLockAsSpatialAnchor: postEventBuilding.verdict === "LOCK",
    transformedBuildingCanLock: transformedBuilding.verdict === "LOCK",
    demolishedParcelCanStillLock: demolishedCurrentParcel.verdict === "LOCK",
    demolishedParkCanStillLock: demolishedNowPark.verdict === "LOCK",
    competingParcelsHold: competingParcels.verdict === "HOLD",
    vanishedUnanchoredHoldsDespiteStory: vanishedUnanchored.verdict === "HOLD",
    overexposedRejectsEvenWithPerfectAnchor: spectacularButOverexposed.verdict === "REJECT",
  };

  const ok = Object.values(checks).every(Boolean);

  return NextResponse.json({
    ok,
    generatedAt: new Date().toISOString(),
    checks,
    cases: {
      survivingBuilding,
      postEventBuilding,
      transformedBuilding,
      demolishedCurrentParcel,
      demolishedNowPark,
      competingParcels,
      vanishedUnanchored,
      spectacularButOverexposed,
    },
    doctrine:
      "Quebec calibration: building survival is a bonus, not a requirement. A later building may serve as a spatial anchor but can never be described as a material witness to an earlier event. A demolished site may LOCK when the historical event is defensibly anchored to a current parcel, civic address, public place, square, park, intersection or equivalent physical reference. Ambiguous or unanchored geography remains HOLD; overexposure can still REJECT.",
  }, {
    status: ok ? 200 : 500,
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
