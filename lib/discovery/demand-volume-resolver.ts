import type { KeywordDemand, KeywordUniverse } from "./search-demand";
import { aggregateThemeDemand } from "./search-demand";

export type DemandVolumeAvailability = "MEASURED" | "PARTIAL" | "UNAVAILABLE";

export function resolveDemandVolume(universe: KeywordUniverse, rows: KeywordDemand[]) {
  const themes = universe.themes.map(({ theme }) => aggregateThemeDemand(theme, rows));
  const measuredThemes = themes.filter((item) => item.status === "MEASURED" && typeof item.monthlySearches === "number").length;
  const estimatedThemes = themes.filter((item) => item.status === "ESTIMATED").length;

  const availability: DemandVolumeAvailability = measuredThemes === themes.length && themes.length > 0
    ? "MEASURED"
    : measuredThemes > 0 || estimatedThemes > 0
      ? "PARTIAL"
      : "UNAVAILABLE";

  return {
    availability,
    measuredThemes,
    estimatedThemes,
    totalThemes: themes.length,
    themes,
    rules: [
      "Absolute monthly search volume is accepted only from a source that supplies numeric volume for the target geography/language.",
      "Search suggestions, SERP result counts, Reddit mentions and editorial recurrence may support relative demand but never manufacture monthly-search volume.",
      "Unknown volume remains UNKNOWN and blocks PRIORITY_GEM graduation.",
      "When multiple measured keywords belong to one theme, numeric volume is aggregated only through the existing demand aggregation contract.",
    ],
  };
}
