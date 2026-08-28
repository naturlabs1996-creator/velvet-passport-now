import type { KeywordUniverse } from "./search-demand";
import type { OpportunityGapScore } from "./opportunity-gap";
import type { VelvetDecision } from "./decision-engine";

export type ProductionAssetType = "ANSWER_PAGE" | "NOW_LANDING" | "RESEARCH_TEST";
export type ProductionStatus = "READY" | "VALIDATE" | "HOLD";

export type ProductionBrief = {
  id: string;
  city: string;
  theme: string;
  assetType: ProductionAssetType;
  status: ProductionStatus;
  priority: number;
  confidence: OpportunityGapScore["confidence"];
  primaryKeyword: string;
  supportingKeywords: string[];
  proposedSlug: string;
  proposedTitle: string;
  searchIntent: string;
  productTarget: "PARIS_UNCOVERED" | "PARIS_NOW" | "DISCOVERY_ONLY";
  primaryCta: string;
  secondaryCta: string;
  productionRules: string[];
  evidenceNeeded: string[];
  gapScore: number;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
}

function productFor(decision: VelvetDecision): ProductionBrief["productTarget"] {
  if (decision.action === "PROMOTE_NOW" || decision.operationalNeed) return "PARIS_NOW";
  if (decision.action === "CREATE_ANSWER_PAGE" || decision.action === "PROMOTE_PARIS_UNCOVERED") return "PARIS_UNCOVERED";
  return "DISCOVERY_ONLY";
}

function titleFor(keyword: string) {
  const normalized = keyword
    .split(" ")
    .map((word) => ["in", "to", "the", "for", "at", "and", "of", "when"].includes(word) ? word : word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return normalized.includes("Paris") ? normalized : `${normalized} in Paris`;
}

function intentFor(theme: string) {
  if (/after-dark|rainy-day|tonight|live/i.test(theme)) return "SITUATIONAL_NOW";
  if (/quiet|secret|hidden|unusual|forgotten|non-touristy|classics|literary/i.test(theme)) return "DISCOVERY";
  return "DISCOVERY";
}

function statusFor(gap: OpportunityGapScore): ProductionStatus {
  if (gap.action === "BUILD_IMMEDIATELY" || gap.action === "BUILD_NEXT") return "READY";
  if (gap.action === "TEST_FIRST") return "VALIDATE";
  return "HOLD";
}

function pickKeywords(theme: string, universe: KeywordUniverse) {
  return universe.themes.find((item) => item.theme === theme)?.keywords ?? [];
}

export function buildProductionQueue(input: {
  universe: KeywordUniverse;
  gaps: OpportunityGapScore[];
  decisions: VelvetDecision[];
  maxReady?: number;
}) {
  const maxReady = input.maxReady ?? 20;
  let readyCount = 0;

  return input.gaps.map((gap) => {
    const decision = input.decisions.find((item) => item.theme === gap.theme);
    const keywords = pickKeywords(gap.theme, input.universe);
    if (!decision || !keywords.length) return null;

    let status = statusFor(gap);
    if (status === "READY" && readyCount >= maxReady) status = "VALIDATE";
    if (status === "READY") readyCount += 1;

    const primaryKeyword = keywords[0];
    const productTarget = productFor(decision);
    const assetType: ProductionAssetType = productTarget === "PARIS_NOW"
      ? "NOW_LANDING"
      : status === "VALIDATE" && gap.confidence === "LOW"
        ? "RESEARCH_TEST"
        : "ANSWER_PAGE";

    const evidenceNeeded: string[] = [];
    if (gap.evidence.searchVolumeStatus === "UNKNOWN") evidenceNeeded.push("SEARCH_VOLUME");
    if (gap.evidence.destinationStatus === "UNKNOWN") evidenceNeeded.push("DESTINATION_CAPTURE");
    if (gap.confidence === "LOW") evidenceNeeded.push("SECOND_INDEPENDENT_SIGNAL");

    return {
      id: `${input.universe.id}:${gap.theme}`,
      city: input.universe.city,
      theme: gap.theme,
      assetType,
      status,
      priority: gap.gapScore,
      confidence: gap.confidence,
      primaryKeyword,
      supportingKeywords: keywords.slice(1, 6),
      proposedSlug: `/${input.universe.city.toLowerCase()}/${slugify(primaryKeyword.replace(/\bparis\b/gi, "").trim())}`,
      proposedTitle: titleFor(primaryKeyword),
      searchIntent: intentFor(gap.theme),
      productTarget,
      primaryCta: productTarget === "PARIS_NOW" ? "Try Paris NOW" : "Get Paris Uncovered",
      secondaryCta: "Try the Free Paris Mini Guide",
      productionRules: [
        "Answer the exact traveler intent before introducing the product.",
        "Do not create a second page if the same intent can be satisfied by an existing canonical page.",
        "Use specific Paris discoveries rather than generic listicle filler.",
        "Keep the page useful even if the visitor never buys.",
        "Track page_view, answer_engaged and the relevant CTA click events.",
      ],
      evidenceNeeded,
      gapScore: gap.gapScore,
    } satisfies ProductionBrief;
  }).filter((item): item is ProductionBrief => Boolean(item))
    .sort((a, b) => {
      const order: Record<ProductionStatus, number> = { READY: 0, VALIDATE: 1, HOLD: 2 };
      return order[a.status] - order[b.status] || b.priority - a.priority;
    });
}
