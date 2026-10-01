import { NextResponse } from "next/server";
import { HISTORICAL_RECONSTRUCTION_BENCHMARK, benchmarkCoverage, HISTORICAL_BENCHMARK_RULE } from "@/lib/discovery/historical-reconstruction-benchmark";
import { extractHistoricalSpatialClues } from "@/lib/discovery/historical-spatial-clue-extractor";
import { buildHistoricalMicroLocationHypotheses } from "@/lib/discovery/historical-micro-location-hypotheses";
import { adapterCanAttemptExactMicroLocation } from "@/lib/discovery/historical-geo-adapter";
import { MONTREAL_HISTORICAL_GEO_ADAPTER } from "@/lib/discovery/historical-geo-adapters";
import type { ResearchLead } from "@/lib/discovery/research-collectors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function lead(id: string, text: string): ResearchLead {
  return {
    id,
    pageId: "historical-benchmark",
    theme: "historical-micro-location",
    query: "historical-benchmark",
    name: id,
    snippet: text,
    url: "https://example.invalid/historical-benchmark",
    sourceType: "EDITORIAL",
    publisher: "Historical benchmark fixture",
    independentKey: "benchmark.invalid",
    observedAt: new Date().toISOString(),
    rawClaims: [text],
  };
}

export async function GET() {
  const witnessCases = HISTORICAL_RECONSTRUCTION_BENCHMARK.filter((item) => item.domain === "WITNESS");
  const witnessLeads = witnessCases.map((item) => lead(item.id, item.input));
  const spatial = extractHistoricalSpatialClues(witnessLeads);
  const micro = buildHistoricalMicroLocationHypotheses(spatial.results);

  const witnessResults = witnessCases.map((item) => {
    const spatialItem = spatial.results.find((row) => row.lead.id === item.id);
    const microItem = micro.results.find((row) => row.lead.id === item.id);
    const relations = spatialItem?.clues.map((clue) => clue.relation) ?? [];
    const required = item.expectation.mustInclude ?? [];
    const excluded = item.expectation.mustExclude ?? [];
    const checks = {
      includesRequired: required.every((value) => relations.includes(value as never)),
      excludesForbidden: excluded.every((value) => !relations.includes(value as never)),
      fieldReadyMatches: typeof item.expectation.fieldReady !== "boolean" || microItem?.fieldReady === item.expectation.fieldReady,
    };
    return { id: item.id, relations, fieldReady: microItem?.fieldReady ?? false, checks, passed: Object.values(checks).every(Boolean) };
  });

  const montreal = adapterCanAttemptExactMicroLocation(MONTREAL_HISTORICAL_GEO_ADAPTER);
  const montrealCase = HISTORICAL_RECONSTRUCTION_BENCHMARK.find((item) => item.id === "montreal-missing-historical-parcel");
  const montrealChecks = {
    cannotAttemptExact: montreal.ok === false,
    missingHistoricalParcel: montreal.missing.includes("HISTORICAL_PARCEL"),
    expectationPresent: montrealCase?.expectation.cityCanAttemptExactMicroLocation === false,
  };

  const checks = {
    allWitnessCasesPass: witnessResults.every((item) => item.passed),
    montrealFailsClosed: Object.values(montrealChecks).every(Boolean),
    corpusCoversMultipleCities: benchmarkCoverage().cities.length >= 2,
    corpusContainsRealFailures: benchmarkCoverage().realFailures >= 2,
  };

  const ok = Object.values(checks).every(Boolean);

  return NextResponse.json({
    ok,
    generatedAt: new Date().toISOString(),
    checks,
    coverage: benchmarkCoverage(),
    witnessResults,
    montreal: { result: montreal, checks: montrealChecks },
    rule: HISTORICAL_BENCHMARK_RULE,
  }, {
    status: ok ? 200 : 500,
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
