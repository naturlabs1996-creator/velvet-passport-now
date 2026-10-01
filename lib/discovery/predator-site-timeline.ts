export type SiteEpisodeMaterialRelation =
  | "SAME_BUILDING_SURVIVES"
  | "BUILDING_TRANSFORMED"
  | "POST_EVENT_BUILDING"
  | "BUILDING_GONE_CURRENT_PARCEL"
  | "BUILDING_GONE_PUBLIC_PLACE"
  | "LOCATION_UNANCHORED";

export type PredatorSiteEpisode = {
  id: string;
  periodLabel: string;
  storyLabel: string;
  eventYear?: number;
  materialRelation: SiteEpisodeMaterialRelation;
  currentAnchorLabel?: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  notes: string[];
};

export type PredatorSiteTimelineDecision =
  | "CHAIN_AS_ONE_STOP"
  | "KEEP_AS_TWO_CANDIDATES"
  | "HOLD_RELATIONSHIP_UNRESOLVED";

export type PredatorSiteTimelineResult = {
  decision: PredatorSiteTimelineDecision;
  episodes: PredatorSiteEpisode[];
  reasons: string[];
  materialTruthRules: string[];
};

export function evaluatePredatorSiteTimeline(
  episodes: PredatorSiteEpisode[],
): PredatorSiteTimelineResult {
  const reasons: string[] = [];
  const materialTruthRules = [
    "Each episode keeps its own material-continuity status.",
    "A later building may anchor an earlier episode spatially but never becomes a material witness to that earlier episode.",
    "Two strong stories at the same current place are not automatically duplicates.",
    "Episodes may be chained only when the geographic anchor is defensibly the same and the combined story improves the traveler experience without blurring chronology.",
    "If the shared-location relationship is unresolved, HOLD the chain instead of forcing a combined stop.",
  ];

  if (episodes.length < 2) {
    return {
      decision: "KEEP_AS_TWO_CANDIDATES",
      episodes,
      reasons: ["Multi-epoch chaining requires at least two distinct historical episodes."],
      materialTruthRules,
    };
  }

  const unanchored = episodes.some(
    (episode) =>
      episode.materialRelation === "LOCATION_UNANCHORED" ||
      episode.confidence === "NONE",
  );
  if (unanchored) {
    return {
      decision: "HOLD_RELATIONSHIP_UNRESOLVED",
      episodes,
      reasons: [
        "At least one episode is not defensibly anchored to the present-day site.",
      ],
      materialTruthRules,
    };
  }

  const anchors = new Set(
    episodes.map((episode) => episode.currentAnchorLabel?.trim()).filter(Boolean),
  );

  if (anchors.size > 1) {
    return {
      decision: "KEEP_AS_TWO_CANDIDATES",
      episodes,
      reasons: [
        "Episodes are interesting but do not resolve to the same present-day anchor.",
      ],
      materialTruthRules,
    };
  }

  const strongEnough = episodes.every(
    (episode) => episode.confidence === "HIGH" || episode.confidence === "MEDIUM",
  );

  if (!strongEnough) {
    return {
      decision: "HOLD_RELATIONSHIP_UNRESOLVED",
      episodes,
      reasons: [
        "The shared-site hypothesis is plausible but one or more episodes remain low-confidence.",
      ],
      materialTruthRules,
    };
  }

  return {
    decision: "CHAIN_AS_ONE_STOP",
    episodes,
    reasons: [
      "Multiple independently supported episodes resolve to the same present-day anchor.",
      "The site may carry layered history across different buildings or built phases.",
      "Narrative chaining is allowed only if chronology and material truth stay explicit.",
    ],
    materialTruthRules,
  };
}

export const PREDATOR_MULTI_EPOCH_SITE_DOCTRINE =
  "A single place may support multiple strong stories from different periods, even when the building fabric changed between them. Predator must preserve episode-level chronology and material truth, then decide whether to chain them as one layered stop or keep them as separate candidates. Shared geography never permits false material continuity.";
