import type { NormalizedRadarObservation } from "./radar-pipeline";

export type CommercialValidation = "CONFIRMED" | "NOT_CONFIRMED" | "UNVERIFIED";
export type DecisionAction =
  | "CREATE_ANSWER_PAGE"
  | "PROMOTE_PARIS_UNCOVERED"
  | "PROMOTE_NOW"
  | "INVESTIGATE_PRODUCT"
  | "MONITOR"
  | "IGNORE";

export type DecisionConfidence = "HIGH" | "MEDIUM" | "LOW";

export type BuySourceHealth = {
  source: string;
  available: boolean;
  matchedThemes?: string[];
};

export type VelvetDecision = {
  theme: string;
  action: DecisionAction;
  priorityScore: number;
  confidence: DecisionConfidence;
  commercialValidation: CommercialValidation;
  sourceCount: number;
  sources: string[];
  sourceTypes: string[];
  signalCount: number;
  bestVelvetOpportunity: number;
  avgVelvetOpportunity: number;
  avgVelvetFit: number;
  avgTravelerIntent: number;
  askConfirmed: boolean;
  searchConfirmed: boolean;
  buyConfirmed: boolean;
  operationalNeed: boolean;
  operationalEvidenceCount: number;
  reasons: string[];
  nextStep: string;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const OPERATIONAL_THEMES = new Set([
  "rainy-day-paris",
  "paris-after-dark",
]);

const GUIDE_FRIENDLY_THEMES = new Set([
  "non-touristy-paris",
  "hidden-bookshops",
  "quiet-paris",
  "forgotten-passages",
  "secret-gardens",
  "unusual-museums",
  "literary-paris",
  "local-neighborhoods",
  "romantic-hidden-places",
  "beyond-the-classics",
]);

const operationalCuePattern = /\b(today|tonight|right now|currently|open now|closed now|weather|raining|heatwave|route now|metro delay|rer delay|traffic|strike|delay|sold out|availability|near me|this evening|ce soir|aujourd'hui|maintenant|météo|pluie|grève|retard|disponibilit[eé])\b/i;

function commercialStatus(theme: string, signals: NormalizedRadarObservation[], buyHealth: BuySourceHealth[]): CommercialValidation {
  if (signals.some((signal) => signal.sourceType === "BUY")) return "CONFIRMED";
  const healthyBuySources = buyHealth.filter((source) => source.available);
  if (healthyBuySources.some((source) => source.matchedThemes?.includes(theme))) return "CONFIRMED";
  // One accessible marketplace is not enough negative evidence to declare a market absent.
  if (healthyBuySources.length < 2) return "UNVERIFIED";
  return "NOT_CONFIRMED";
}

function chooseAction(input: {
  theme: string;
  sourceCount: number;
  askConfirmed: boolean;
  searchConfirmed: boolean;
  buyConfirmed: boolean;
  bestOpportunity: number;
  avgOpportunity: number;
  avgVelvetFit: number;
  operationalNeed: boolean;
  commercialValidation: CommercialValidation;
}) {
  const {
    theme,
    sourceCount,
    askConfirmed,
    searchConfirmed,
    buyConfirmed,
    bestOpportunity,
    avgOpportunity,
    avgVelvetFit,
    operationalNeed,
    commercialValidation,
  } = input;

  if (operationalNeed && bestOpportunity >= 58 && (askConfirmed || searchConfirmed)) {
    return "PROMOTE_NOW" as const;
  }

  if (buyConfirmed && GUIDE_FRIENDLY_THEMES.has(theme) && avgVelvetFit >= 68 && bestOpportunity >= 58) {
    return "PROMOTE_PARIS_UNCOVERED" as const;
  }

  if (askConfirmed && searchConfirmed && bestOpportunity >= 62 && avgVelvetFit >= 65) {
    return "CREATE_ANSWER_PAGE" as const;
  }

  if (sourceCount >= 2 && bestOpportunity >= 58 && avgVelvetFit >= 62) {
    return commercialValidation === "UNVERIFIED" ? "CREATE_ANSWER_PAGE" as const : "INVESTIGATE_PRODUCT" as const;
  }

  if (bestOpportunity >= 45 || avgOpportunity >= 38) return "MONITOR" as const;
  return "IGNORE" as const;
}

function nextStepFor(action: DecisionAction, theme: string, commercialValidation: CommercialValidation) {
  switch (action) {
    case "CREATE_ANSWER_PAGE":
      return `Publish or test a focused free Answer Page for ${theme}; use engagement and guide CTA behavior as first-party validation.`;
    case "PROMOTE_PARIS_UNCOVERED":
      return `Connect ${theme} directly to Paris Uncovered and measure guide CTA, store-router and store-selection events.`;
    case "PROMOTE_NOW":
      return `Test ${theme} as a NOW use case with live context, timing or route utility rather than static discovery alone.`;
    case "INVESTIGATE_PRODUCT":
      return `Investigate whether ${theme} represents an unmet paid-product cluster before building anything new.`;
    case "MONITOR":
      return `Keep ${theme} in the watch list until another independent source or stronger first-party behavior appears.`;
    default:
      return commercialValidation === "NOT_CONFIRMED"
        ? `Do not invest in ${theme} yet; multiple accessible commercial sources did not confirm it.`
        : `Ignore ${theme} unless new evidence materially changes the signal.`;
  }
}

export function buildVelvetDecisions(
  signals: NormalizedRadarObservation[],
  buyHealth: BuySourceHealth[] = [],
): VelvetDecision[] {
  const themes = [...new Set(signals.map((signal) => signal.theme))];

  return themes.map((theme) => {
    const themed = signals.filter((signal) => signal.theme === theme);
    const sources = [...new Set(themed.map((signal) => signal.source))];
    const sourceTypes = [...new Set(themed.map((signal) => signal.sourceType))];
    const bestOpportunity = Math.max(...themed.map((signal) => signal.velvetOpportunityScore ?? 0));
    const avgOpportunity = average(themed.map((signal) => signal.velvetOpportunityScore ?? 0));
    const avgVelvetFit = average(themed.map((signal) => signal.velvetFit ?? 0));
    const avgTravelerIntent = average(themed.map((signal) => signal.travelerIntentScore ?? 0));
    const askSignals = themed.filter((signal) => signal.sourceType === "ASK");
    const askConfirmed = askSignals.length > 0;
    const searchConfirmed = themed.some((signal) => signal.sourceType === "SEARCH");
    const buyConfirmed = themed.some((signal) => signal.sourceType === "BUY");
    const operationalEvidenceCount = askSignals.filter((signal) => operationalCuePattern.test(signal.text)).length;
    const operationalNeed = OPERATIONAL_THEMES.has(theme) || operationalEvidenceCount >= 2;
    const commercialValidation = commercialStatus(theme, themed, buyHealth);

    const action = chooseAction({
      theme,
      sourceCount: sources.length,
      askConfirmed,
      searchConfirmed,
      buyConfirmed,
      bestOpportunity,
      avgOpportunity,
      avgVelvetFit,
      operationalNeed,
      commercialValidation,
    });

    let priorityScore =
      bestOpportunity * 0.34 +
      avgOpportunity * 0.18 +
      avgVelvetFit * 0.18 +
      avgTravelerIntent * 0.12 +
      Math.min(100, sources.length * 25) * 0.12;

    if (askConfirmed && searchConfirmed) priorityScore += 8;
    if (commercialValidation === "CONFIRMED") priorityScore += 10;
    if (commercialValidation === "NOT_CONFIRMED") priorityScore -= 8;
    if (operationalNeed && action === "PROMOTE_NOW") priorityScore += 5;
    priorityScore = clamp(priorityScore);

    const confidence: DecisionConfidence =
      sources.length >= 3 || (askConfirmed && searchConfirmed && bestOpportunity >= 70)
        ? "HIGH"
        : sources.length >= 2 || bestOpportunity >= 60
          ? "MEDIUM"
          : "LOW";

    const reasons: string[] = [];
    if (askConfirmed) reasons.push("Traveler need appears in ASK behavior.");
    if (searchConfirmed) reasons.push("Search demand independently confirms the theme.");
    if (buyConfirmed) reasons.push("A BUY source directly confirms commercial presence.");
    if (commercialValidation === "UNVERIFIED") reasons.push("Commercial demand remains unverified because fewer than two independent BUY sources are currently accessible; this is not treated as zero demand.");
    if (commercialValidation === "NOT_CONFIRMED") reasons.push("Multiple accessible BUY sources were checked but did not confirm this theme.");
    if (operationalNeed) reasons.push(OPERATIONAL_THEMES.has(theme)
      ? "The theme is inherently live-context and suited to NOW."
      : `Repeated ASK evidence (${operationalEvidenceCount} signals) shows a live-context need suited to NOW.`);
    if (avgVelvetFit >= 75) reasons.push("Strong fit with the Velvet rare/local/atmospheric discovery layer.");

    return {
      theme,
      action,
      priorityScore,
      confidence,
      commercialValidation,
      sourceCount: sources.length,
      sources,
      sourceTypes,
      signalCount: themed.length,
      bestVelvetOpportunity: Math.round(bestOpportunity),
      avgVelvetOpportunity: Math.round(avgOpportunity),
      avgVelvetFit: Math.round(avgVelvetFit),
      avgTravelerIntent: Math.round(avgTravelerIntent),
      askConfirmed,
      searchConfirmed,
      buyConfirmed,
      operationalNeed,
      operationalEvidenceCount,
      reasons,
      nextStep: nextStepFor(action, theme, commercialValidation),
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore || b.bestVelvetOpportunity - a.bestVelvetOpportunity);
}
