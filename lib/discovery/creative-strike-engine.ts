import type { BehaviorPrediction } from "./behavior-prediction";
import type { PredatorExperiment } from "./experiment-engine";
import type { ResourceAllocation } from "./resource-allocator";
import type { SafeDiscoveryCopy } from "./safe-copy-composer";
import type { RefinedPrecisionTarget } from "./target-refinement";

export type StrikeMode = "ORGANIC_STRIKE" | "COMMERCIAL_STRIKE" | "PAID_STRIKE";
export type StrikeStatus =
  | "READY_TO_TEST"
  | "HOLD_NO_LOCK"
  | "HOLD_LOW_CONFIDENCE"
  | "HOLD_COPY_EVIDENCE"
  | "HOLD_PAID"
  | "OFF";

export type CreativeStrike = {
  id: string;
  theme: string;
  channel: string;
  mode: StrikeMode;
  status: StrikeStatus;
  targetState: RefinedPrecisionTarget["state"];
  targetScore: number;
  predictedBehavior: BehaviorPrediction["predictedBehavior"];
  predictionConfidence: BehaviorPrediction["confidence"];
  experimentId?: string;
  variable?: PredatorExperiment["variable"];
  hook: string;
  angle: string;
  body: string[];
  cta: string;
  factualTrace: Array<{ text: string; sourceIds: string[]; sourceUrls: string[] }>;
  reasons: string[];
  safeguards: string[];
};

function strikeMode(channel: string): StrikeMode {
  if (channel === "PAID") return "PAID_STRIKE";
  if (channel === "STORE_SEARCH") return "COMMERCIAL_STRIKE";
  return "ORGANIC_STRIKE";
}

function themeLabel(theme: string) {
  return theme.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeHook(theme: string, behavior: BehaviorPrediction["predictedBehavior"], channel: string) {
  const label = themeLabel(theme);
  if (channel === "PINTEREST") return `See a different side of ${label}.`;
  if (channel === "REDDIT") return `If you are exploring ${label}, start with what is actually useful.`;
  if (channel === "STORE_SEARCH") return `${label}: a more focused way to explore.`;
  if (behavior === "PURCHASE_LIKELY") return `Go deeper into ${label}.`;
  if (behavior === "PRODUCT_INTEREST") return `Explore ${label} with more context.`;
  return `Start with ${label}.`;
}

function safeAngle(behavior: BehaviorPrediction["predictedBehavior"]) {
  if (behavior === "PURCHASE_LIKELY") return "High-intent continuation: move from useful discovery toward the most relevant Velvet product without invented urgency.";
  if (behavior === "PRODUCT_INTEREST") return "Product-fit exploration: connect the useful answer to the most relevant next step.";
  if (behavior === "EXPLORATION") return "Discovery-first: deliver value before asking for a product action.";
  return "Low-pressure discovery: test usefulness before conversion pressure.";
}

function safeCta(mode: StrikeMode, behavior: BehaviorPrediction["predictedBehavior"]) {
  if (mode === "COMMERCIAL_STRIKE") return behavior === "PURCHASE_LIKELY" ? "Explore the full guide" : "See what is inside";
  if (behavior === "PURCHASE_LIKELY") return "Go deeper";
  if (behavior === "PRODUCT_INTEREST") return "Explore the guide";
  return "Discover more";
}

function evidenceForTheme(copies: SafeDiscoveryCopy[] | undefined) {
  const ready = (copies ?? []).filter((copy) => copy.status === "READY");
  const sentences = ready.flatMap((copy) => [...copy.summary, ...copy.facts]).slice(0, 4);
  return sentences.map((sentence) => ({
    text: sentence.text,
    sourceIds: sentence.sourceIds,
    sourceUrls: sentence.sourceUrls,
  }));
}

export function buildCreativeStrikes(input: {
  targets: RefinedPrecisionTarget[];
  predictions: BehaviorPrediction[];
  allocations: ResourceAllocation[];
  experiments: PredatorExperiment[];
  safeCopyByTheme?: Record<string, SafeDiscoveryCopy[]>;
}): CreativeStrike[] {
  const strikes: CreativeStrike[] = [];

  for (const target of input.targets) {
    const prediction = input.predictions.find((item) => item.theme === target.theme);
    const allocation = input.allocations.find((item) => item.theme === target.theme);
    if (!prediction || !allocation || allocation.directive === "STOP") continue;

    const factualTrace = evidenceForTheme(input.safeCopyByTheme?.[target.theme]);

    for (const channel of allocation.channels) {
      if (channel.status === "OFF") continue;
      const mode = strikeMode(channel.channel);
      const experiment = input.experiments.find((item) => item.theme === target.theme && item.channel === channel.channel);
      const reasons: string[] = [];

      let status: StrikeStatus = "READY_TO_TEST";
      if (mode === "PAID_STRIKE") {
        status = "HOLD_PAID";
        reasons.push("Paid execution is always held behind a separate spend gate and explicit authorization.");
      } else if (target.state !== "LOCK") {
        status = "HOLD_NO_LOCK";
        reasons.push("Strong strike requires a LOCK target; TRACK and RETEST remain experiment-only upstream.");
      } else if (prediction.status !== "MEASURED" || prediction.confidence === "NONE" || prediction.confidence === "LOW") {
        status = "HOLD_LOW_CONFIDENCE";
        reasons.push("A LOCK target still needs measured behavior with at least medium confidence before a strong strike is prepared.");
      } else if (factualTrace.length === 0) {
        status = "HOLD_COPY_EVIDENCE";
        reasons.push("No READY Safe Copy evidence exists for factual body copy, so the strike stays held rather than inventing claims.");
      } else {
        reasons.push("Target is LOCKED, behavior is measured with adequate confidence, and factual copy has a verified source trace.");
      }

      if (prediction.predictedBehavior === "PURCHASE_LIKELY") reasons.push("Measured cohort behavior indicates comparatively strong purchase-oriented intent.");
      else if (prediction.predictedBehavior === "PRODUCT_INTEREST") reasons.push("Measured cohort behavior indicates product interest but not a guaranteed purchase outcome.");
      else reasons.push("Creative pressure remains conservative because behavior is exploratory or weak.");

      strikes.push({
        id: `${target.theme}:${channel.channel}:strike`,
        theme: target.theme,
        channel: channel.channel,
        mode,
        status,
        targetState: target.state,
        targetScore: target.targetScore,
        predictedBehavior: prediction.predictedBehavior,
        predictionConfidence: prediction.confidence,
        experimentId: experiment?.id,
        variable: experiment?.variable,
        hook: safeHook(target.theme, prediction.predictedBehavior, channel.channel),
        angle: safeAngle(prediction.predictedBehavior),
        body: factualTrace.map((item) => item.text),
        cta: safeCta(mode, prediction.predictedBehavior),
        factualTrace,
        reasons,
        safeguards: [
          "NO LOCK means no strong strike.",
          "Low-confidence or unmeasured behavior cannot activate a strong strike.",
          "Factual body copy may only come from READY Safe Copy with source trace.",
          "No urgency, scarcity, social proof, secrecy or exclusivity claim may be invented.",
          "Paid spend is never activated by this engine.",
          "Reddit output is a compliant draft/test recommendation, never automated spam posting.",
          "A strike is a testable hypothesis, not a guarantee of consumer behavior.",
        ],
      });
    }
  }

  return strikes;
}
