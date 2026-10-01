export type HistoricalBenchmarkExpectation = {
  mustInclude?: string[];
  mustExclude?: string[];
  fieldReady?: boolean;
  exactHistoricalParcelMatch?: boolean;
  cityCanAttemptExactMicroLocation?: boolean;
};

export type HistoricalBenchmarkCase = {
  id: string;
  cityId: string;
  domain: "WITNESS" | "STREET_LINEAGE" | "NUMBER_CONTINUITY" | "PARCEL" | "ENTRANCE" | "CITY_ADAPTER";
  input: string;
  expectation: HistoricalBenchmarkExpectation;
  provenance: "REAL_FAILURE" | "CONTROLLED_FIXTURE" | "KNOWN_EDGE_CASE";
  lesson: string;
};

export const HISTORICAL_RECONSTRUCTION_BENCHMARK: HistoricalBenchmarkCase[] = [
  {
    id: "witness-second-door-not-second-floor",
    cityId: "paris-fr",
    domain: "WITNESS",
    input: "Le témoin indique la deuxième porte après l'angle, côté impair, en face de l'église.",
    expectation: {
      mustInclude: ["DOOR_SEQUENCE", "CORNER_OFFSET", "OPPOSITE_LANDMARK", "SIDE_OF_STREET"],
      mustExclude: ["FLOOR_LEVEL"],
      fieldReady: true,
    },
    provenance: "REAL_FAILURE",
    lesson: "Ordinal + porte must not be interpreted as a floor level.",
  },
  {
    id: "witness-courtyard-path",
    cityId: "paris-fr",
    domain: "WITNESS",
    input: "Il fallait entrer par la porte cochère puis gagner le fond de la cour, derrière la façade.",
    expectation: {
      mustInclude: ["ENTRANCE_RELATION", "INSIDE_COURTYARD", "BEHIND_FRONTAGE"],
      fieldReady: true,
    },
    provenance: "REAL_FAILURE",
    lesson: "Narrated movement through an entrance into a courtyard is usable spatial geometry.",
  },
  {
    id: "witness-vague-memory-fails-closed",
    cityId: "paris-fr",
    domain: "WITNESS",
    input: "Le témoin se souvenait seulement que la maison se trouvait quelque part dans cette rue.",
    expectation: {
      fieldReady: false,
    },
    provenance: "CONTROLLED_FIXTURE",
    lesson: "A vague street memory must not become door-level geometry.",
  },
  {
    id: "street-lineage-rue-perdue-maitre-albert",
    cityId: "paris-fr",
    domain: "STREET_LINEAGE",
    input: "23 rue Perdue",
    expectation: {
      mustInclude: ["CONFIRMED_NAME_LINEAGE", "rue Maître Albert"],
    },
    provenance: "KNOWN_EDGE_CASE",
    lesson: "Former and current street records should corroborate each other before lineage is high-confidence.",
  },
  {
    id: "same-number-is-not-continuity",
    cityId: "paris-fr",
    domain: "NUMBER_CONTINUITY",
    input: "23 rue Perdue -> 23 rue Maître Albert",
    expectation: {
      mustInclude: ["UNVERIFIED"],
      exactHistoricalParcelMatch: false,
    },
    provenance: "KNOWN_EDGE_CASE",
    lesson: "The same street number on a successor street is only a candidate until parcel continuity is independently established.",
  },
  {
    id: "current-door-is-not-historical-door",
    cityId: "paris-fr",
    domain: "ENTRANCE",
    input: "Current porte cochère within metres of a BAN candidate address",
    expectation: {
      mustInclude: ["CURRENT_DOOR_CANDIDATE_ONLY"],
      exactHistoricalParcelMatch: false,
    },
    provenance: "KNOWN_EDGE_CASE",
    lesson: "A current mapped entrance can guide field work but cannot become a historical entrance without parcel/building continuity.",
  },
  {
    id: "montreal-missing-historical-parcel",
    cityId: "montreal-ca",
    domain: "CITY_ADAPTER",
    input: "Montréal adapter with street lineage, current address/parcel and historical map but no historical parcel binding",
    expectation: {
      cityCanAttemptExactMicroLocation: false,
      mustInclude: ["HISTORICAL_PARCEL"],
    },
    provenance: "CONTROLLED_FIXTURE",
    lesson: "A city adapter must fail closed when a required capability for exact micro-location is missing.",
  },
];

export function benchmarkCoverage() {
  return {
    total: HISTORICAL_RECONSTRUCTION_BENCHMARK.length,
    cities: [...new Set(HISTORICAL_RECONSTRUCTION_BENCHMARK.map((item) => item.cityId))],
    domains: [...new Set(HISTORICAL_RECONSTRUCTION_BENCHMARK.map((item) => item.domain))],
    realFailures: HISTORICAL_RECONSTRUCTION_BENCHMARK.filter((item) => item.provenance === "REAL_FAILURE").length,
  };
}

export const HISTORICAL_BENCHMARK_RULE =
  "Every real reconstruction failure or corrected false inference should become a permanent regression case. A future improvement is not an improvement if it solves a new case by reopening an old error.";
