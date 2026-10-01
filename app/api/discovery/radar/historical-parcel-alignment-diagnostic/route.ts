import { NextResponse } from "next/server";
import { alignHistoricalParcel, HISTORICAL_PARCEL_ALIGNMENT_RULE } from "@/lib/discovery/historical-parcel-alignment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const sameNumberOnly = alignHistoricalParcel({
    historicalParcelId: "historical-23",
    currentParcelId: "75105000AB0037",
    georeferencedHistoricalPlan: false,
    independentHistoricalSources: 0,
    historicalNumberContinuityEvidence: "UNKNOWN",
  });

  const strongButSingleSource = alignHistoricalParcel({
    historicalParcelId: "historical-fixture-a",
    currentParcelId: "current-fixture-a",
    georeferencedHistoricalPlan: true,
    independentHistoricalSources: 1,
    overlapRatio: 0.88,
    frontageOverlapRatio: 0.82,
    centroidDistanceMeters: 3,
    orientationDeltaDegrees: 3,
    historicalNumberContinuityEvidence: "SUPPORTED",
    entranceContinuityEvidence: "UNKNOWN",
  });

  const confirmed = alignHistoricalParcel({
    historicalParcelId: "historical-fixture-b",
    currentParcelId: "current-fixture-b",
    georeferencedHistoricalPlan: true,
    independentHistoricalSources: 2,
    overlapRatio: 0.91,
    frontageOverlapRatio: 0.86,
    centroidDistanceMeters: 2.5,
    orientationDeltaDegrees: 2,
    historicalNumberContinuityEvidence: "SUPPORTED",
    entranceContinuityEvidence: "SUPPORTED",
    transformationEvidence: ["RENAMING_ONLY"],
  });

  const contradicted = alignHistoricalParcel({
    historicalParcelId: "historical-fixture-c",
    currentParcelId: "current-fixture-c",
    georeferencedHistoricalPlan: true,
    independentHistoricalSources: 2,
    overlapRatio: 0.12,
    frontageOverlapRatio: 0.1,
    centroidDistanceMeters: 44,
    orientationDeltaDegrees: 40,
    historicalNumberContinuityEvidence: "CONTRADICTED",
    entranceContinuityEvidence: "CONTRADICTED",
    transformationEvidence: ["STREET_WIDENING", "PARCEL_MERGER"],
  });

  const checks = {
    sameNumberFailsClosed:
      sameNumberOnly.status === "UNRESOLVED" &&
      sameNumberOnly.exactHistoricalParcelMatch === false,
    singleSourceCannotExactMatch:
      strongButSingleSource.exactHistoricalParcelMatch === false,
    doubleSourceStrongGeometryCanConfirm:
      confirmed.status === "CONFIRMED_CONTINUITY" &&
      confirmed.exactHistoricalParcelMatch === true,
    contradictionRejected:
      contradicted.status === "CONTRADICTED" &&
      contradicted.exactHistoricalParcelMatch === false,
  };

  const ok = Object.values(checks).every(Boolean);

  return NextResponse.json({
    ok,
    generatedAt: new Date().toISOString(),
    checks,
    cases: { sameNumberOnly, strongButSingleSource, confirmed, contradicted },
    rule: HISTORICAL_PARCEL_ALIGNMENT_RULE,
  }, {
    status: ok ? 200 : 500,
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
