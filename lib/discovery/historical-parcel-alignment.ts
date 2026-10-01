export type HistoricalParcelAlignmentEvidence = {
  historicalParcelId?: string;
  historicalSheet?: string;
  currentParcelId?: string;
  georeferencedHistoricalPlan: boolean;
  independentHistoricalSources: number;
  overlapRatio?: number;
  frontageOverlapRatio?: number;
  centroidDistanceMeters?: number;
  orientationDeltaDegrees?: number;
  historicalNumberContinuityEvidence?: "SUPPORTED" | "CONTRADICTED" | "UNKNOWN";
  entranceContinuityEvidence?: "SUPPORTED" | "CONTRADICTED" | "UNKNOWN";
  transformationEvidence?: Array<
    | "RENAMING_ONLY"
    | "RENUMBERING"
    | "STREET_WIDENING"
    | "PARCEL_MERGER"
    | "PARCEL_SPLIT"
    | "BUILDING_REBUILT"
    | "ENTRANCE_SHIFTED"
    | "DEMOLISHED"
  >;
};

export type HistoricalParcelAlignmentResult = {
  status:
    | "CONFIRMED_CONTINUITY"
    | "PROBABLE_CONTINUITY"
    | "POSSIBLE_CONTINUITY"
    | "CONTRADICTED"
    | "UNRESOLVED";
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  exactHistoricalParcelMatch: boolean;
  score: number;
  reasons: string[];
  blockers: string[];
  nextChecks: string[];
};

function validRatio(value?: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function validDistance(value?: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function alignHistoricalParcel(
  evidence: HistoricalParcelAlignmentEvidence,
): HistoricalParcelAlignmentResult {
  const reasons: string[] = [];
  const blockers: string[] = [];
  const nextChecks: string[] = [];

  if (!evidence.historicalParcelId || !evidence.currentParcelId) {
    blockers.push("Historical and current parcel identifiers are both required.");
  }
  if (!evidence.georeferencedHistoricalPlan) {
    blockers.push("Historical plan geometry has not been georeferenced or otherwise aligned to the current coordinate fabric.");
  }
  if (evidence.independentHistoricalSources < 1) {
    blockers.push("No independent historical source supports the historical parcel candidate.");
  }

  if (blockers.length) {
    return {
      status: "UNRESOLVED",
      confidence: "NONE",
      exactHistoricalParcelMatch: false,
      score: 0,
      reasons: ["Fail-closed: parcel continuity cannot be inferred from same-number address or current parcel data alone."],
      blockers,
      nextChecks: [
        "Acquire or inspect an authoritative historical parcel plan.",
        "Georeference the historical sheet or derive defensible control points.",
        "Identify the historical parcel polygon/frontage before comparing it with the current parcel fabric.",
      ],
    };
  }

  let score = 0;

  if (validRatio(evidence.overlapRatio)) {
    if (evidence.overlapRatio! >= 0.8) { score += 35; reasons.push("Historical/current parcel overlap is very strong."); }
    else if (evidence.overlapRatio! >= 0.55) { score += 24; reasons.push("Historical/current parcel overlap is substantial."); }
    else if (evidence.overlapRatio! >= 0.3) { score += 12; reasons.push("Historical/current parcel overlap is partial."); }
    else reasons.push("Historical/current parcel overlap is weak.");
  } else {
    nextChecks.push("Measure parcel polygon overlap.");
  }

  if (validRatio(evidence.frontageOverlapRatio)) {
    if (evidence.frontageOverlapRatio! >= 0.8) { score += 25; reasons.push("Street frontage continuity is very strong."); }
    else if (evidence.frontageOverlapRatio! >= 0.5) { score += 16; reasons.push("Street frontage continuity is substantial."); }
    else if (evidence.frontageOverlapRatio! >= 0.25) { score += 7; reasons.push("Street frontage continuity is limited."); }
    else reasons.push("Street frontage continuity is weak.");
  } else {
    nextChecks.push("Measure historical/current frontage overlap.");
  }

  if (validDistance(evidence.centroidDistanceMeters)) {
    if (evidence.centroidDistanceMeters! <= 5) { score += 15; reasons.push("Parcel centroids are closely aligned."); }
    else if (evidence.centroidDistanceMeters! <= 15) { score += 10; reasons.push("Parcel centroids remain nearby."); }
    else if (evidence.centroidDistanceMeters! <= 30) { score += 4; reasons.push("Parcel centroid shift is material but still locally plausible."); }
    else reasons.push("Parcel centroid shift is large.");
  } else {
    nextChecks.push("Measure centroid displacement.");
  }

  if (typeof evidence.orientationDeltaDegrees === "number" && Number.isFinite(evidence.orientationDeltaDegrees)) {
    const d = Math.abs(evidence.orientationDeltaDegrees);
    if (d <= 5) { score += 10; reasons.push("Parcel orientation is nearly unchanged."); }
    else if (d <= 15) { score += 6; reasons.push("Parcel orientation is broadly compatible."); }
    else if (d <= 30) { score += 2; reasons.push("Parcel orientation changed materially."); }
    else reasons.push("Parcel orientation is poorly compatible.");
  }

  if (evidence.historicalNumberContinuityEvidence === "SUPPORTED") {
    score += 10;
    reasons.push("Independent evidence supports number continuity.");
  } else if (evidence.historicalNumberContinuityEvidence === "CONTRADICTED") {
    score -= 20;
    reasons.push("Independent evidence contradicts number continuity.");
  }

  if (evidence.entranceContinuityEvidence === "SUPPORTED") {
    score += 5;
    reasons.push("Entrance continuity has independent support.");
  } else if (evidence.entranceContinuityEvidence === "CONTRADICTED") {
    score -= 10;
    reasons.push("Entrance continuity is contradicted.");
  }

  const destructive = new Set(["STREET_WIDENING", "PARCEL_MERGER", "PARCEL_SPLIT", "BUILDING_REBUILT", "ENTRANCE_SHIFTED", "DEMOLISHED"]);
  const transformations = evidence.transformationEvidence ?? [];
  if (transformations.some((item) => destructive.has(item))) {
    reasons.push("Transformation evidence requires continuity to be interpreted cautiously.");
    score -= Math.min(20, transformations.filter((item) => destructive.has(item)).length * 5);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const geometricCore =
    validRatio(evidence.overlapRatio) &&
    validRatio(evidence.frontageOverlapRatio) &&
    evidence.overlapRatio! >= 0.8 &&
    evidence.frontageOverlapRatio! >= 0.7;

  if (evidence.historicalNumberContinuityEvidence === "CONTRADICTED" && (evidence.overlapRatio ?? 0) < 0.3) {
    return {
      status: "CONTRADICTED",
      confidence: "HIGH",
      exactHistoricalParcelMatch: false,
      score,
      reasons,
      blockers: ["Number continuity is contradicted and geometric overlap is weak."],
      nextChecks,
    };
  }

  if (geometricCore && evidence.independentHistoricalSources >= 2 && score >= 80) {
    return {
      status: "CONFIRMED_CONTINUITY",
      confidence: "HIGH",
      exactHistoricalParcelMatch: true,
      score,
      reasons,
      blockers: [],
      nextChecks,
    };
  }

  if ((evidence.overlapRatio ?? 0) >= 0.55 && (evidence.frontageOverlapRatio ?? 0) >= 0.5 && score >= 55) {
    return {
      status: "PROBABLE_CONTINUITY",
      confidence: "MEDIUM",
      exactHistoricalParcelMatch: false,
      score,
      reasons,
      blockers: ["Evidence is strong but does not meet the exact-match gate."],
      nextChecks,
    };
  }

  return {
    status: "POSSIBLE_CONTINUITY",
    confidence: "LOW",
    exactHistoricalParcelMatch: false,
    score,
    reasons,
    blockers: ["Available evidence supports only a possible continuity hypothesis."],
    nextChecks,
  };
}

export const HISTORICAL_PARCEL_ALIGNMENT_RULE =
  "Historical parcel continuity is geometry-led and fail-closed. Same street number, current cadastral parcel, street centroid or nearby current entrance can never establish exact historical continuity. Exact match requires georeferenced historical geometry, strong polygon/frontage agreement and at least two independent historical sources.";
