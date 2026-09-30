import type { ResearchLead } from "./research-collectors";
import type { HistoricalSpatialRelation, HistoricalSpatialResult } from "./historical-spatial-clue-extractor";

export type MicroLocationModel =
  | "STREET_FRONTAGE"
  | "CORNER_SEGMENT"
  | "OPPOSITE_LANDMARK_FRONTAGE"
  | "COURTYARD_OR_REAR"
  | "ENTRANCE_PATH"
  | "VERTICAL_LOCATION"
  | "INSUFFICIENT_GEOMETRY";

export type MicroLocationHypothesis = {
  rank: 1 | 2 | 3;
  model: MicroLocationModel;
  score: number;
  confidence: "MEDIUM" | "LOW" | "NONE";
  supportingRelations: HistoricalSpatialRelation[];
  hypothesis: string;
  nextChecks: string[];
  blockers: string[];
  truthStatus: "HYPOTHESIS_ONLY";
};

export type HistoricalMicroLocationResult = {
  lead: ResearchLead;
  hypotheses: MicroLocationHypothesis[];
  fieldReady: boolean;
  bestConfidence: "MEDIUM" | "LOW" | "NONE";
  reasons: string[];
};

function has(relations: Set<HistoricalSpatialRelation>, relation: HistoricalSpatialRelation) {
  return relations.has(relation);
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function support(relations: Set<HistoricalSpatialRelation>, wanted: HistoricalSpatialRelation[]) {
  return wanted.filter((relation) => relations.has(relation));
}

function checksFor(model: MicroLocationModel) {
  switch (model) {
    case "CORNER_SEGMENT":
      return [
        "Reconstruct historical street numbering and parcel order from the named corner.",
        "Compare cadastral/parcel frontage widths across the relevant period and today.",
        "On current imagery, count surviving door/frontage sequence from the same corner.",
      ];
    case "OPPOSITE_LANDMARK_FRONTAGE":
      return [
        "Verify that the referenced landmark occupied the same footprint at the event date.",
        "Project the landmark-facing frontage onto a historical plan before comparing current fabric.",
        "Check whether street widening or alignment changes displaced the opposite frontage.",
      ];
    case "COURTYARD_OR_REAR":
      return [
        "Find a plan showing passage, porte cochère, courtyard sequence and rear buildings.",
        "Check whether courtyard geometry survived parcel merger, demolition or reconstruction.",
        "Use current aerial/street imagery only after historical access geometry is established.",
      ];
    case "ENTRANCE_PATH":
      return [
        "Identify the historical entrance or porte cochère independently.",
        "Reconstruct the described movement after entry using plans or building records.",
        "Check whether the entrance migrated within the same parcel after rebuilding.",
      ];
    case "VERTICAL_LOCATION":
      return [
        "Confirm historical floor numbering conventions for the source period.",
        "Establish whether the building shell survived or was rebuilt.",
        "Use façade bay/window alignment only after building continuity is confirmed.",
      ];
    case "STREET_FRONTAGE":
      return [
        "Reconstruct historical numbering and parcel frontage before using the modern address.",
        "Check street alignment, renumbering, parcel fusion and demolition history.",
        "Compare surviving doors, bays and frontage widths on current imagery.",
      ];
    default:
      return [
        "Acquire at least one stronger spatial anchor such as corner offset, door sequence, opposite landmark or courtyard relation.",
      ];
  }
}

function blockersFor(model: MicroLocationModel, relations: Set<HistoricalSpatialRelation>) {
  const blockers = [
    "No present-day coordinate may be asserted from witness testimony alone.",
    "Historical and current street numbering continuity is not yet proven.",
  ];
  if (!has(relations, "SIDE_OF_STREET")) blockers.push("Street side is not independently constrained.");
  if (model === "COURTYARD_OR_REAR" && !has(relations, "ENTRANCE_RELATION")) blockers.push("Access path from street to courtyard/rear space is not independently constrained.");
  if (model === "VERTICAL_LOCATION") blockers.push("Vertical location is useless for present-day identification unless building continuity is established.");
  return blockers;
}

function makeHypothesis(
  rank: 1 | 2 | 3,
  model: MicroLocationModel,
  score: number,
  relations: Set<HistoricalSpatialRelation>,
  supporting: HistoricalSpatialRelation[],
  hypothesis: string,
): MicroLocationHypothesis {
  const supportingRelations = support(relations, supporting);
  const confidence: MicroLocationHypothesis["confidence"] =
    score >= 70 && supportingRelations.length >= 2 ? "MEDIUM" :
    score >= 40 ? "LOW" : "NONE";
  return {
    rank,
    model,
    score,
    confidence,
    supportingRelations,
    hypothesis,
    nextChecks: checksFor(model),
    blockers: blockersFor(model, relations),
    truthStatus: "HYPOTHESIS_ONLY",
  };
}

function buildCandidateModels(result: HistoricalSpatialResult) {
  const relations = new Set(result.clues.map((clue) => clue.relation));
  const candidates: Omit<MicroLocationHypothesis, "rank">[] = [];

  if (has(relations, "CORNER_OFFSET") || has(relations, "DOOR_SEQUENCE")) {
    let score = 58;
    if (has(relations, "CORNER_OFFSET")) score += 14;
    if (has(relations, "DOOR_SEQUENCE")) score += 16;
    if (has(relations, "SIDE_OF_STREET")) score += 8;
    if (has(relations, "DISTANCE_RELATIVE")) score += 5;
    const built = makeHypothesis(
      1,
      "CORNER_SEGMENT",
      Math.min(95, score),
      relations,
      ["CORNER_OFFSET", "DOOR_SEQUENCE", "SIDE_OF_STREET", "DISTANCE_RELATIVE"],
      "The historical point may be recoverable as a frontage/door sequence measured from a known street corner.",
    );
    candidates.push({ ...built, rank: undefined as never });
  }

  if (has(relations, "OPPOSITE_LANDMARK")) {
    let score = 64;
    if (has(relations, "SIDE_OF_STREET")) score += 9;
    if (has(relations, "ADJACENT")) score += 5;
    const built = makeHypothesis(
      1,
      "OPPOSITE_LANDMARK_FRONTAGE",
      Math.min(90, score),
      relations,
      ["OPPOSITE_LANDMARK", "SIDE_OF_STREET", "ADJACENT"],
      "The historical point may lie on the frontage geometrically opposite a named landmark, subject to historical footprint and street-alignment continuity.",
    );
    candidates.push({ ...built, rank: undefined as never });
  }

  if (has(relations, "INSIDE_COURTYARD") || has(relations, "BEHIND_FRONTAGE")) {
    let score = 57;
    if (has(relations, "INSIDE_COURTYARD")) score += 13;
    if (has(relations, "BEHIND_FRONTAGE")) score += 10;
    if (has(relations, "ENTRANCE_RELATION")) score += 10;
    const built = makeHypothesis(
      1,
      "COURTYARD_OR_REAR",
      Math.min(92, score),
      relations,
      ["INSIDE_COURTYARD", "BEHIND_FRONTAGE", "ENTRANCE_RELATION"],
      "The historical point may be internal to the parcel rather than on the street frontage; courtyard and access geometry must be reconstructed first.",
    );
    candidates.push({ ...built, rank: undefined as never });
  }

  if (has(relations, "ENTRANCE_RELATION")) {
    let score = 52;
    if (has(relations, "DOOR_SEQUENCE")) score += 12;
    if (has(relations, "INSIDE_COURTYARD")) score += 9;
    const built = makeHypothesis(
      1,
      "ENTRANCE_PATH",
      Math.min(85, score),
      relations,
      ["ENTRANCE_RELATION", "DOOR_SEQUENCE", "INSIDE_COURTYARD"],
      "The witness account may encode a path from a specific entrance into the parcel; reconstruct the entrance before projecting the interior destination.",
    );
    candidates.push({ ...built, rank: undefined as never });
  }

  if (has(relations, "FLOOR_LEVEL")) {
    let score = 35;
    if (has(relations, "ENTRANCE_RELATION")) score += 8;
    if (has(relations, "DOOR_SEQUENCE")) score += 8;
    const built = makeHypothesis(
      1,
      "VERTICAL_LOCATION",
      Math.min(70, score),
      relations,
      ["FLOOR_LEVEL", "ENTRANCE_RELATION", "DOOR_SEQUENCE"],
      "A vertical location is described, but it is useful only after the correct historical building and entrance are independently established.",
    );
    candidates.push({ ...built, rank: undefined as never });
  }

  if (!candidates.length && result.clues.length) {
    const built = makeHypothesis(
      1,
      "STREET_FRONTAGE",
      34,
      relations,
      [...relations],
      "The testimony narrows the general frontage but does not yet contain enough geometry to identify a modern door or parcel.",
    );
    candidates.push({ ...built, rank: undefined as never });
  }

  if (!candidates.length) {
    const built = makeHypothesis(
      1,
      "INSUFFICIENT_GEOMETRY",
      0,
      relations,
      [],
      "No defensible micro-location hypothesis can be generated from the current evidence.",
    );
    candidates.push({ ...built, rank: undefined as never });
  }

  return candidates
    .sort((a, b) => b.score - a.score || b.supportingRelations.length - a.supportingRelations.length)
    .slice(0, 3)
    .map((item, index) => ({ ...item, rank: (index + 1) as 1 | 2 | 3 }));
}

function claimsFor(hypotheses: MicroLocationHypothesis[]) {
  return hypotheses.flatMap((item) => [
    `HISTORICAL_MICROLOCATION_HYPOTHESIS rank=${item.rank} model=${item.model} score=${item.score} confidence=${item.confidence} truth=HYPOTHESIS_ONLY support=${item.supportingRelations.join(",") || "NONE"}`,
    ...item.nextChecks.map((check) => `HISTORICAL_MICROLOCATION_NEXT_CHECK rank=${item.rank} check=${JSON.stringify(check)}`),
  ]);
}

export function buildHistoricalMicroLocationHypotheses(results: HistoricalSpatialResult[]) {
  const mapped: HistoricalMicroLocationResult[] = results.map((result) => {
    const hypotheses = buildCandidateModels(result);
    const best = hypotheses[0];
    const fieldReady =
      best.model !== "INSUFFICIENT_GEOMETRY" &&
      best.score >= 55 &&
      best.supportingRelations.some((relation) => ["CORNER_OFFSET", "DOOR_SEQUENCE", "OPPOSITE_LANDMARK", "INSIDE_COURTYARD", "ENTRANCE_RELATION"].includes(relation));

    const reasons = fieldReady
      ? [
          "The witness geometry is specific enough to prepare a targeted plan/cadastre/current-imagery check.",
          "Field-ready means ready to verify, never historically or presently localized.",
        ]
      : [
          "The current spatial clues are not specific enough for a targeted present-day micro-location check.",
          "Acquire stronger historical geometry before attempting door-level identification.",
        ];

    return {
      lead: { ...result.lead, rawClaims: [...result.lead.rawClaims, ...claimsFor(hypotheses)] },
      hypotheses,
      fieldReady,
      bestConfidence: best.confidence,
      reasons,
    };
  });

  return {
    results: mapped,
    leads: mapped.map((item) => item.lead),
    fieldReady: mapped.filter((item) => item.fieldReady),
    rule: "Micro-location hypotheses rank witness-derived geometric models without creating coordinates or location truth. They exist to tell the researcher what to verify next against independent historical plans, cadastral parcels, numbering changes, demolition/rebuilding evidence and present-day fabric. No hypothesis can grant Trust, Access, Exposure, factual verification or LOCK.",
  };
}
