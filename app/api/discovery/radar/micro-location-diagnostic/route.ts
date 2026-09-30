import { NextResponse } from "next/server";
import type { ResearchLead } from "@/lib/discovery/research-collectors";
import { extractHistoricalSpatialClues } from "@/lib/discovery/historical-spatial-clue-extractor";
import { buildHistoricalMicroLocationHypotheses } from "@/lib/discovery/historical-micro-location-hypotheses";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function lead(name: string, snippet: string): ResearchLead {
  return {
    id: `diagnostic:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    pageId: "diagnostic",
    theme: "historical-micro-location",
    query: "diagnostic",
    name,
    snippet,
    url: "https://example.invalid/diagnostic",
    sourceType: "EDITORIAL",
    publisher: "Diagnostic fixture",
    independentKey: "diagnostic.invalid",
    observedAt: new Date().toISOString(),
    rawClaims: [snippet],
  };
}

export async function GET() {
  const fixtures = [
    lead(
      "Door after corner",
      "Le témoin indique la deuxième porte après l'angle, côté impair, en face de l'église."
    ),
    lead(
      "Rear courtyard",
      "Il fallait entrer par la porte cochère puis gagner le fond de la cour, derrière la façade."
    ),
    lead(
      "Vague memory",
      "Le témoin se souvenait seulement que la maison se trouvait quelque part dans cette rue."
    ),
  ];

  const spatial = extractHistoricalSpatialClues(fixtures);
  const micro = buildHistoricalMicroLocationHypotheses(spatial.results);

  const cases = micro.results.map((item) => ({
    name: item.lead.name,
    fieldReady: item.fieldReady,
    bestConfidence: item.bestConfidence,
    clues: spatial.results.find((spatialItem) => spatialItem.lead.id === item.lead.id)?.clues ?? [],
    hypotheses: item.hypotheses,
  }));

  const door = cases.find((item) => item.name === "Door after corner");
  const courtyard = cases.find((item) => item.name === "Rear courtyard");
  const vague = cases.find((item) => item.name === "Vague memory");

  const checks = {
    doorHasCornerOrSequence:
      Boolean(door?.clues.some((clue) => clue.relation === "CORNER_OFFSET" || clue.relation === "DOOR_SEQUENCE")),
    doorIsFieldReady: door?.fieldReady === true,
    courtyardRecognized:
      Boolean(courtyard?.clues.some((clue) => clue.relation === "INSIDE_COURTYARD")),
    vagueNotFieldReady: vague?.fieldReady === false,
    noLocationTruthCreated:
      cases.every((item) => item.hypotheses.every((hypothesis) => hypothesis.truthStatus === "HYPOTHESIS_ONLY")),
  };

  const ok = Object.values(checks).every(Boolean);

  return NextResponse.json({
    ok,
    generatedAt: new Date().toISOString(),
    checks,
    cases,
    rules: {
      spatial: spatial.rule,
      microLocation: micro.rule,
    },
  }, {
    status: ok ? 200 : 500,
    headers: {
      "cache-control": "no-store, max-age=0",
    },
  });
}
