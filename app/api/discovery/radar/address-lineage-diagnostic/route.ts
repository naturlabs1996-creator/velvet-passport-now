import { NextResponse } from "next/server";
import type { HistoricalMicroLocationResult } from "@/lib/discovery/historical-micro-location-hypotheses";
import type { ResearchLead } from "@/lib/discovery/research-collectors";
import { resolveHistoricalAddressLineage } from "@/lib/discovery/historical-address-lineage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fixtureLead(): ResearchLead {
  return {
    id: "diagnostic:rue-perdue",
    pageId: "diagnostic",
    theme: "historical-micro-location",
    query: "diagnostic",
    name: "Rue Perdue historical test",
    snippet: "Le témoignage situe la scène rue Perdue, à la deuxième porte après l'angle.",
    url: "https://example.invalid/diagnostic",
    sourceType: "EDITORIAL",
    publisher: "Diagnostic fixture",
    independentKey: "diagnostic.invalid",
    observedAt: new Date().toISOString(),
    rawClaims: ["La scène est située rue Perdue."],
  };
}

function microFixture(): HistoricalMicroLocationResult {
  const lead = fixtureLead();
  return {
    lead,
    fieldReady: true,
    bestConfidence: "MEDIUM",
    hypotheses: [{
      rank: 1,
      model: "CORNER_SEGMENT",
      score: 90,
      confidence: "MEDIUM",
      supportingRelations: ["CORNER_OFFSET", "DOOR_SEQUENCE"],
      hypothesis: "Historical frontage sequence measured from a known corner.",
      nextChecks: ["Verify numbering and parcel order."],
      blockers: ["No present-day coordinate may be asserted from witness testimony alone."],
      truthStatus: "HYPOTHESIS_ONLY",
    }],
    reasons: ["Diagnostic field-ready fixture."],
  };
}

export async function GET() {
  try {
    const result = await resolveHistoricalAddressLineage([microFixture()], 1);
    const item = result.results[0];

    const checks = {
      confirmedBidirectionalLineage: item?.status === "CONFIRMED_NAME_LINEAGE",
      historicalStreetIsRuePerdue: item?.historicalStreet === "rue Perdue",
      currentStreetIsMaitreAlbert: item?.currentStreet === "rue Maître Albert",
      parcelSheetsRecovered: Boolean(item?.parcelSheets.includes("91D1") || item?.parcelSheets.includes("91D3")),
      currentPointIsStreetReferenceOnly: item?.currentStreetReferencePoint?.truthStatus === "STREET_REFERENCE_ONLY",
      parcelReconstructionStillRequired: item?.requiresParcelReconstruction === true,
      noDoorCoordinateCreated: typeof item?.lead.lat !== "number" && typeof item?.lead.lon !== "number",
    };

    const ok = Object.values(checks).every(Boolean);

    return NextResponse.json({
      ok,
      generatedAt: new Date().toISOString(),
      checks,
      result: item ? {
        status: item.status,
        confidence: item.confidence,
        historicalStreet: item.historicalStreet,
        currentStreet: item.currentStreet,
        parcelSheets: item.parcelSheets,
        numberingReferences: item.numberingReferences,
        alignmentReferences: item.alignmentReferences,
        currentStreetReferencePoint: item.currentStreetReferencePoint,
        requiresParcelReconstruction: item.requiresParcelReconstruction,
        reasons: item.reasons,
      } : null,
      rule: result.rule,
    }, {
      status: ok ? 200 : 500,
      headers: { "cache-control": "no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      generatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "address_lineage_diagnostic_failed",
    }, {
      status: 500,
      headers: { "cache-control": "no-store, max-age=0" },
    });
  }
}
