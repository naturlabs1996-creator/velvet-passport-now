import type { ThemeJourney } from "./demand-journey";

export type InterceptChannel = "SEO_ANSWER_PAGE" | "REDDIT" | "PINTEREST" | "STORE_SEARCH" | "VELVET_INTERNAL" | "PAID_RETARGETING";
export type InterceptAction = "BUILD" | "PUBLISH" | "OPTIMIZE" | "MONITOR" | "HOLD";

export type InterceptRecommendation = {
  theme: string;
  channel: InterceptChannel;
  action: InterceptAction;
  priority: number;
  costMode: "FREE" | "PAID_OPTIONAL";
  reason: string;
  destinationProduct: "PARIS_UNCOVERED" | "PARIS_NOW" | "MINI_GUIDE" | "DISCOVERY_ONLY";
  requires: string[];
};

function targetProduct(journey: ThemeJourney): InterceptRecommendation["destinationProduct"] {
  const action = journey.decision?.action;
  if (action === "PROMOTE_NOW") return "PARIS_NOW";
  if (action === "PROMOTE_PARIS_UNCOVERED") return "PARIS_UNCOVERED";
  if (action === "CREATE_ANSWER_PAGE") return "PARIS_UNCOVERED";
  return "DISCOVERY_ONLY";
}

function basePriority(journey: ThemeJourney) {
  const decisionPriority = journey.decision?.priorityScore ?? 0;
  const demandBoost = typeof journey.demand.monthlySearches === "number"
    ? Math.min(15, Math.round(Math.log10(Math.max(10, journey.demand.monthlySearches)) * 4))
    : 0;
  return Math.max(0, Math.min(100, decisionPriority + demandBoost));
}

export function buildInterceptPlan(journey: ThemeJourney): InterceptRecommendation[] {
  const recommendations: InterceptRecommendation[] = [];
  const product = targetProduct(journey);
  const priority = basePriority(journey);

  if (journey.decision?.action === "CREATE_ANSWER_PAGE" || journey.decision?.action === "PROMOTE_PARIS_UNCOVERED" || journey.decision?.action === "PROMOTE_NOW") {
    recommendations.push({
      theme: journey.theme,
      channel: "SEO_ANSWER_PAGE",
      action: "BUILD",
      priority,
      costMode: "FREE",
      reason: "Capture existing search intent with a precise Velvet answer before the traveler reaches a competing destination.",
      destinationProduct: product,
      requires: journey.demand.status === "UNKNOWN" ? ["SEARCH_VOLUME"] : [],
    });
  }

  if (journey.decision?.askConfirmed) {
    recommendations.push({
      theme: journey.theme,
      channel: "REDDIT",
      action: "PUBLISH",
      priority: Math.max(0, priority - 5),
      costMode: "FREE",
      reason: "ASK evidence exists: answer the traveler question where it is already being asked, without promotional spam.",
      destinationProduct: product,
      requires: [],
    });
  }

  if (journey.decision?.searchConfirmed) {
    recommendations.push({
      theme: journey.theme,
      channel: "PINTEREST",
      action: "PUBLISH",
      priority: Math.max(0, priority - 8),
      costMode: "FREE",
      reason: "Reuse proven search language as a discovery entry point that routes to the relevant Answer Page.",
      destinationProduct: product,
      requires: [],
    });
  }

  if (journey.decision?.buyConfirmed) {
    recommendations.push({
      theme: journey.theme,
      channel: "STORE_SEARCH",
      action: "OPTIMIZE",
      priority: Math.max(0, priority - 3),
      costMode: "FREE",
      reason: "Commercial presence is observed: align marketplace title, description and discovery language with the validated theme.",
      destinationProduct: product === "PARIS_NOW" ? "PARIS_UNCOVERED" : product,
      requires: [],
    });
  }

  recommendations.push({
    theme: journey.theme,
    channel: "VELVET_INTERNAL",
    action: "OPTIMIZE",
    priority: Math.max(0, priority - 2),
    costMode: "FREE",
    reason: "Use first-party engagement to choose the next CTA and product path while the visitor is already inside Velvet.",
    destinationProduct: product,
    requires: journey.velvetJourney.status === "UNKNOWN" ? ["FIRST_PARTY_JOURNEY"] : [],
  });

  recommendations.push({
    theme: journey.theme,
    channel: "PAID_RETARGETING",
    action: journey.velvetJourney.status === "MEASURED" ? "MONITOR" : "HOLD",
    priority: Math.max(0, priority - 25),
    costMode: "PAID_OPTIONAL",
    reason: "Paid retargeting is a last-mile option only after first-party intent demonstrates that spending is justified.",
    destinationProduct: product,
    requires: journey.velvetJourney.status === "MEASURED" ? [] : ["FIRST_PARTY_JOURNEY"],
  });

  return recommendations.sort((a, b) => b.priority - a.priority);
}

export function buildInterceptPortfolio(journeys: ThemeJourney[]) {
  return journeys.flatMap(buildInterceptPlan).sort((a, b) => b.priority - a.priority);
}
