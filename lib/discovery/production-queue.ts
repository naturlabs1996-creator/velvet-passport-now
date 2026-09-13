import type { KeywordUniverse } from "./search-demand";
import type { OpportunityGapScore } from "./opportunity-gap";
import type { VelvetDecision } from "./decision-engine";
import { resolveTheme, type ThemeResolutionMethod } from "./theme-resolver";

export type ProductionAssetType = "ANSWER_PAGE" | "NOW_LANDING" | "RESEARCH_TEST";
export type ProductionStatus = "READY" | "VALIDATE" | "HOLD";

export type ProductionBrief = {
  id: string;
  city: string;
  theme: string;
  rawTheme: string;
  canonicalTheme: string;
  themeResolutionMethod: ThemeResolutionMethod;
  themeResolutionConfidence: number;
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

function keywordsFor(theme: string, universe: KeywordUniverse) {
  return universe.themes.find((item) => item.theme === theme)?.keywords ?? [];
}

function fallbackKeyword(rawTheme: string, city: string) {
  const words = rawTheme.replace(/-/g, " ").replace(new RegExp(`\\b${city}\\b`, "ig"), "").trim();
  return `${words || rawTheme} ${city}`.replace(/\s+/g, " ").trim();
}

export function buildProductionQueue(input: {
  universe: KeywordUniverse;
  gaps: OpportunityGapScore[];
  decisions: VelvetDecision[];
  maxReady?: number;
}) {
  const maxReady = input.maxReady ?? 20;
  let readyCount = 0;

  const briefs = input.gaps.map((gap) => {
    const decision = input.decisions.find((item) => item.theme === gap.theme);
    if (!decision) return null;

    const resolution = resolveTheme(gap.theme, input.universe);
    const canonicalTheme = resolution.canonicalTheme ?? gap.theme;
    const keywords = resolution.canonicalTheme ? keywordsFor(canonicalTheme, input.universe) : [];

    let status = statusFor(gap);
    if (resolution.method === "UNRESOLVED" && status === "READY") status = "VALIDATE";
    if (status === "READY" && readyCount >= maxReady) status = "VALIDATE";
    if (status === "READY") readyCount += 1;

    const primaryKeyword = keywords[0] ?? fallbackKeyword(gap.theme, input.universe.city);
    const productTarget = productFor(decision);
    const assetType: ProductionAssetType = resolution.method === "UNRESOLVED"
      ? "RESEARCH_TEST"
      : productTarget === "PARIS_NOW"
        ? "NOW_LANDING"
        : status === "VALIDATE" && gap.confidence === "LOW"
          ? "RESEARCH_TEST"
          : "ANSWER_PAGE";

    const evidenceNeeded: string[] = [];
    if (gap.evidence.searchVolumeStatus === "UNKNOWN") evidenceNeeded.push("SEARCH_VOLUME");
    if (gap.evidence.destinationStatus === "UNKNOWN") evidenceNeeded.push("DESTINATION_CAPTURE");
    if (gap.confidence === "LOW") evidenceNeeded.push("SECOND_INDEPENDENT_SIGNAL");
    if (resolution.method === "UNRESOLVED") evidenceNeeded.push("THEME_RESOLUTION");
    if (resolution.method === "SEMANTIC") evidenceNeeded.push("CONFIRM_CANONICAL_INTENT");

    return {
      id: `${input.universe.id}:${canonicalTheme}`,
      city: input.universe.city,
      theme: canonicalTheme,
      rawTheme: gap.theme,
      canonicalTheme,
      themeResolutionMethod: resolution.method,
      themeResolutionConfidence: resolution.confidence,
      assetType,
      status,
      priority: gap.gapScore,
      confidence: gap.confidence,
      primaryKeyword,
      supportingKeywords: keywords.slice(1, 6),
      proposedSlug: `/${input.universe.city.toLowerCase()}/${slugify(primaryKeyword.replace(/\bparis\b/gi, "").trim())}`,
      proposedTitle: titleFor(primaryKeyword),
      searchIntent: intentFor(canonicalTheme),
      productTarget,
      primaryCta: productTarget === "PARIS_NOW" ? "Try Paris NOW" : "Get Paris Uncovered",
      secondaryCta: "Try the Free Paris Mini Guide",
      productionRules: [
        "Answer the exact traveler intent before introducing the product.",
        "Preserve the raw Radar theme even when production uses a canonical theme.",
        "Do not create a second page if the same intent resolves to an existing canonical page.",
        "Unresolved themes become research tests instead of disappearing from the queue.",
        "Use specific Paris discoveries rather than generic listicle filler.",
        "Keep the page useful even if the visitor never buys.",
        "Track page_view, answer_engaged and the relevant CTA click events.",
      ],
      evidenceNeeded,
      gapScore: gap.gapScore,
    } satisfies ProductionBrief;
  }).filter((item): item is ProductionBrief => Boolean(item));

  // One canonical production asset per intent. If several raw signals resolve to the same
  // canonical cluster, keep the strongest brief and preserve the alias relationship upstream.
  const byCanonical = new Map<string, ProductionBrief>();
  for (const brief of briefs) {
    const key = `${brief.city}:${brief.canonicalTheme}:${brief.productTarget}`;
    const existing = byCanonical.get(key);
    if (!existing || brief.priority > existing.priority) byCanonical.set(key, brief);
  }

  return [...byCanonical.values()].sort((a, b) => {
    const order: Record<ProductionStatus, number> = { READY: 0, VALIDATE: 1, HOLD: 2 };
    return order[a.status] - order[b.status] || b.priority - a.priority;
  });
}
