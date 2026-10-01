import { NextResponse } from "next/server";
import { evaluatePredatorSiteTimeline } from "@/lib/discovery/predator-site-timeline";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const sameSiteDifferentBuildings = evaluatePredatorSiteTimeline([
    {
      id: "episode-1",
      periodLabel: "18th century",
      storyLabel: "First strong historical episode",
      eventYear: 1765,
      materialRelation: "POST_EVENT_BUILDING",
      currentAnchorLabel: "same-current-anchor",
      confidence: "HIGH",
      notes: ["Current building did not exist in 1765; spatial anchor only."],
    },
    {
      id: "episode-2",
      periodLabel: "late 19th century",
      storyLabel: "Second strong historical episode",
      eventYear: 1892,
      materialRelation: "BUILDING_TRANSFORMED",
      currentAnchorLabel: "same-current-anchor",
      confidence: "HIGH",
      notes: ["Later built phase is relevant to this episode."],
    },
  ]);

  const differentAnchors = evaluatePredatorSiteTimeline([
    {
      id: "episode-a",
      periodLabel: "18th century",
      storyLabel: "Story A",
      eventYear: 1770,
      materialRelation: "BUILDING_GONE_CURRENT_PARCEL",
      currentAnchorLabel: "parcel-A",
      confidence: "HIGH",
      notes: [],
    },
    {
      id: "episode-b",
      periodLabel: "19th century",
      storyLabel: "Story B",
      eventYear: 1888,
      materialRelation: "SAME_BUILDING_SURVIVES",
      currentAnchorLabel: "parcel-B",
      confidence: "HIGH",
      notes: [],
    },
  ]);

  const unresolvedSharedSite = evaluatePredatorSiteTimeline([
    {
      id: "episode-x",
      periodLabel: "17th century",
      storyLabel: "Strong but weakly located story",
      materialRelation: "LOCATION_UNANCHORED",
      currentAnchorLabel: "candidate-zone",
      confidence: "LOW",
      notes: ["Only broad zone resolved."],
    },
    {
      id: "episode-y",
      periodLabel: "19th century",
      storyLabel: "Later strong story",
      materialRelation: "SAME_BUILDING_SURVIVES",
      currentAnchorLabel: "candidate-zone",
      confidence: "HIGH",
      notes: [],
    },
  ]);

  const checks = {
    sameSiteDifferentBuildingsCanChain: sameSiteDifferentBuildings.decision === "CHAIN_AS_ONE_STOP",
    differentAnchorsStaySeparate: differentAnchors.decision === "KEEP_AS_TWO_CANDIDATES",
    unresolvedSharedSiteHolds: unresolvedSharedSite.decision === "HOLD_RELATIONSHIP_UNRESOLVED",
    materialTruthExplicit:
      sameSiteDifferentBuildings.materialTruthRules.some((rule) =>
        rule.includes("never becomes a material witness"),
      ),
  };

  const ok = Object.values(checks).every(Boolean);

  return NextResponse.json({
    ok,
    checks,
    cases: {
      sameSiteDifferentBuildings,
      differentAnchors,
      unresolvedSharedSite,
    },
  }, {
    status: ok ? 200 : 500,
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
