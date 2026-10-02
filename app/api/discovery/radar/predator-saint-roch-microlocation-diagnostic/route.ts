import { NextResponse } from "next/server";
import { runPredatorMission } from "@/lib/discovery/predator-mission";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const missions = [
  {
    subject: "Patrick Pearl / Michael Lawlor tavern, 1863",
    objective: "Determine the most defensible present-day micro-location of Michael Lawlor's tavern on rue Saint-Vallier where the Patrick Pearl case began. Resolve historical numbering, street continuity, parcel or present physical anchor if possible. Fail closed on any unproven exactness.",
    knownAddress: "rue Saint-Vallier, Québec, QC, Canada",
    knownFacts: [
      "The incident began at Michael Lawlor's tavern on rue Saint-Vallier on 11 September 1863.",
      "Patrick Pearl was 16 and later died from the assault.",
    ],
  },
  {
    subject: "Duncan McCallum brewery explosion, 1842",
    objective: "Determine the most defensible present-day footprint or physical anchor for Duncan McCallum's brewery destroyed by explosion on 4 March 1842, using the stated north side of rue Saint-Paul and relationship to the St. Roch Brewery. Distinguish current anchor from historical-building survival.",
    knownAddress: "rue Saint-Paul, Québec, QC, Canada",
    knownFacts: [
      "The brewery was on the north side of rue Saint-Paul.",
      "It stood opposite the St. Roch Brewery.",
      "The brewery was destroyed by explosion on 4 March 1842 and one employee died.",
    ],
  },
  {
    subject: "John Munn shipyard strike scene, 1840",
    objective: "Determine the most defensible current physical anchor for the December 1840 strike/riot scene associated with John Munn's shipyard in Saint-Roch. Use historical plans, shoreline, streets and parcel continuity where available. Do not reduce a large shipyard to a false single door.",
    knownAddress: "rue Saint-Paul et rue Saint-Vallier, Québec, QC, Canada",
    knownFacts: [
      "A strike involving shipyard workers occurred in December 1840.",
      "An episode on 8 December was reported near John Munn's shipyard.",
      "Munn controlled a large Saint-Charles waterfront shipyard in Saint-Roch.",
    ],
  },
  {
    subject: "Louis Richard mica workshop, 1919",
    objective: "Resolve the historical address lineage of Louis Richard's rue Arago industrial premises where about twenty women processed mica around 1919, including old numbering 121 and later 159-161/161 if supported, and identify the present-day physical anchor without assuming number continuity.",
    knownAddress: "161 rue Arago, Québec, QC, Canada",
    knownFacts: [
      "Louis Richard operated on rue Arago.",
      "The premises are associated in sources with 121 rue Arago and later 159-161/161.",
      "Around 1919 about twenty women processed mica there for export.",
    ],
  },
  {
    subject: "Manoir Saint-Roch / Maison blanche, 1775",
    objective: "Test site continuity for the Manoir Saint-Roch / Maison blanche episode of 1775. Determine whether the present-day anchor at 870 rue Saint-Vallier Est occupies the defensible historical site of the British defensive position burned during the American invasion. Explicitly separate site continuity, surviving old cellars or other remnants, and any post-1775 building fabric. Identify the best NOW stopping point without treating later construction as a material witness to 1775.",
    knownAddress: "870 rue Saint-Vallier Est, Québec, QC, Canada",
    knownFacts: [
      "The Manoir Saint-Roch / Maison blanche was used as a British defensive position in 1775 and was burned during withdrawal to prevent American use.",
      "The present-day site is associated with 870 rue Saint-Vallier Est.",
      "Old vaulted cellar elements are reported to survive, but their precise dating and continuity must be verified independently.",
    ],
  },
  {
    subject: "Two soldiers hanged after brandy theft, 31 August 1759",
    objective: "Reconstruct the most defensible present-day geography of the 31 August 1759 episode in Saint-Roch involving two soldiers who stole a quarter-cask of brandy from M. Soupiran's cellar, rolled or moved it to Charland's house, and were hanged at 3 PM. Identify who Soupiran and Charland were, locate their properties if possible, distinguish the theft site from Charland's house, and determine the execution site only if archival or spatial evidence supports it. Do not invent a gallows location from neighborhood-level context.",
    knownAddress: "Saint-Roch, Québec, QC, Canada",
    knownFacts: [
      "On 31 August 1759 two soldiers stole a quarter-cask of brandy from M. Soupiran's cellar.",
      "The cask was rolled or deposited at Charland's house in Saint-Roch.",
      "The two soldiers were hanged at 3 PM the same day.",
      "The identities and properties of Soupiran and Charland, and the exact execution site, remain unresolved.",
    ],
  },
];

export async function GET() {
  const results = [];
  for (const item of missions) {
    const mission = await runPredatorMission({
      cityId: "quebec-city-ca",
      subject: item.subject,
      objective: item.objective,
      knownAddress: item.knownAddress,
      knownFacts: item.knownFacts,
      requestedDepth: "MAXIMUM",
    });
    const report: any = (mission as any).report;
    results.push({
      subject: item.subject,
      status: mission.status,
      conclusion: report?.conclusion,
      addressLineage: report?.historicalAddressLineage,
      microLocation: report?.microLocation,
      currentParcelAndEntrances: report?.currentParcelAndEntrances,
      linkageResearch: report?.linkageResearch,
      unresolved: report?.unresolved,
      sourceUrls: report?.sourceUrls,
      integrity: report?.independentIntegrity,
    });
  }
  return NextResponse.json({ ok: true, results }, { headers: { "cache-control": "no-store, max-age=0" } });
}
