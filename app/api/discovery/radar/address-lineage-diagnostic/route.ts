import { NextResponse } from "next/server";
import type { HistoricalMicroLocationResult } from "@/lib/discovery/historical-micro-location-hypotheses";
import type { ResearchLead } from "@/lib/discovery/research-collectors";
import { resolveHistoricalAddressLineage } from "@/lib/discovery/historical-address-lineage";
import { resolveCurrentParcelDoorCandidates } from "@/lib/discovery/current-parcel-door-candidates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fixtureLead(): ResearchLead {
  return {
    id: "diagnostic:23-rue-perdue",
    pageId: "diagnostic",
    theme: "historical-micro-location",
    query: "diagnostic",
    name: "23 rue Perdue historical test",
    snippet: "Le témoignage situe la scène au 23 rue Perdue, à la deuxième porte après l'angle.",
    url: "https://example.invalid/diagnostic",
    sourceType: "EDITORIAL",
    publisher: "Diagnostic fixture",
    independentKey: "diagnostic.invalid",
    observedAt: new Date().toISOString(),
    rawClaims: ["La scène est située au 23 rue Perdue."],
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
    const lineage = await resolveHistoricalAddressLineage([microFixture()], 1);
    const parcelDoor = await resolveCurrentParcelDoorCandidates(lineage.results, 1);
    const lineageItem = lineage.results[0];
    const parcelItem = parcelDoor.results[0];

    const checks = {
      confirmedBidirectionalLineage: lineageItem?.status === "CONFIRMED_NAME_LINEAGE",
      historicalStreetIsRuePerdue: lineageItem?.historicalStreet === "rue Perdue",
      currentStreetIsMaitreAlbert: lineageItem?.currentStreet === "rue Maître Albert",
      historicalNumberExtracted: parcelItem?.historicalAddress?.number === 23,
      numberContinuityStillUnverified: parcelItem?.currentAddressCandidates.every((item) => item.numberContinuity === "UNVERIFIED") ?? true,
      noHistoricalParcelMatchClaimed: parcelItem?.exactHistoricalParcelMatch === false,
      noHistoricalDoorTruthClaimed: parcelItem?.currentDoorCandidates.every((item) => item.truthStatus === "CURRENT_DOOR_CANDIDATE_ONLY") ?? true,
      noLeadCoordinateMutated: typeof parcelItem?.lead.lat !== "number" && typeof parcelItem?.lead.lon !== "number",
    };

    const ok = Object.values(checks).every(Boolean);

    return NextResponse.json({
      ok,
      generatedAt: new Date().toISOString(),
      checks,
      lineage: lineageItem ? {
        status: lineageItem.status,
        confidence: lineageItem.confidence,
        historicalStreet: lineageItem.historicalStreet,
        currentStreet: lineageItem.currentStreet,
        parcelSheets: lineageItem.parcelSheets,
        alignmentReferences: lineageItem.alignmentReferences,
      } : null,
      currentParcelDoor: parcelItem ? {
        status: parcelItem.status,
        confidence: parcelItem.confidence,
        historicalAddress: parcelItem.historicalAddress,
        currentAddressCandidates: parcelItem.currentAddressCandidates,
        currentDoorCandidates: parcelItem.currentDoorCandidates,
        cadParcels: parcelItem.cadParcels,
        exactHistoricalParcelMatch: parcelItem.exactHistoricalParcelMatch,
        reasons: parcelItem.reasons,
      } : null,
      rules: {
        lineage: lineage.rule,
        parcelDoor: parcelDoor.rule,
      },
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
