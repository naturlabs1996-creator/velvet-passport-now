export type NowHealthLevel = "green" | "amber" | "red";

export type NowHealthComponent =
  | "ticket_intelligence"
  | "weather"
  | "rain_ahead"
  | "transport"
  | "walking_routing"
  | "live_needs"
  | "disruptions"
  | "commerce"
  | "pass_access";

export type NowHealthSignal = {
  component: NowHealthComponent;
  level: NowHealthLevel;
  code: string;
  message: string;
  fallbackAvailable: boolean;
  fallbackActive?: boolean;
  checkedAt: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type NowHealthSnapshot = {
  status: NowHealthLevel;
  travelerSafe: boolean;
  degraded: boolean;
  generatedAt: string;
  counts: Record<NowHealthLevel, number>;
  signals: NowHealthSignal[];
  action: "continue" | "continue_with_fallbacks" | "protect_traveler";
};

const LEVEL_WEIGHT: Record<NowHealthLevel, number> = {
  green: 0,
  amber: 1,
  red: 2,
};

export function healthSignal(input: Omit<NowHealthSignal, "checkedAt"> & { checkedAt?: string }): NowHealthSignal {
  return {
    ...input,
    checkedAt: input.checkedAt ?? new Date().toISOString(),
  };
}

export function summarizeNowHealth(signals: NowHealthSignal[]): NowHealthSnapshot {
  const counts: Record<NowHealthLevel, number> = { green: 0, amber: 0, red: 0 };
  for (const signal of signals) counts[signal.level] += 1;

  if (signals.length === 0) {
    return {
      status: "red",
      travelerSafe: false,
      degraded: true,
      generatedAt: new Date().toISOString(),
      counts,
      signals,
      action: "protect_traveler",
    };
  }

  const worst = signals.reduce<NowHealthLevel>((current, signal) =>
    LEVEL_WEIGHT[signal.level] > LEVEL_WEIGHT[current] ? signal.level : current,
  "green");

  const unsafeRed = signals.some((signal) => signal.level === "red" && !signal.fallbackAvailable);
  const redCoveredByFallback = signals.some((signal) => signal.level === "red" && signal.fallbackAvailable);
  const amber = signals.some((signal) => signal.level === "amber");
  const degraded = redCoveredByFallback || amber;

  return {
    status: unsafeRed ? "red" : degraded ? "amber" : worst,
    travelerSafe: !unsafeRed,
    degraded,
    generatedAt: new Date().toISOString(),
    counts,
    signals,
    action: unsafeRed
      ? "protect_traveler"
      : degraded
        ? "continue_with_fallbacks"
        : "continue",
  };
}

export function providerFailureSignal(
  component: NowHealthComponent,
  code: string,
  message: string,
  fallbackAvailable: boolean,
  metadata?: NowHealthSignal["metadata"],
) {
  return healthSignal({
    component,
    level: fallbackAvailable ? "amber" : "red",
    code,
    message,
    fallbackAvailable,
    fallbackActive: fallbackAvailable,
    metadata,
  });
}

export function providerHealthySignal(
  component: NowHealthComponent,
  code: string,
  message: string,
  metadata?: NowHealthSignal["metadata"],
) {
  return healthSignal({
    component,
    level: "green",
    code,
    message,
    fallbackAvailable: true,
    fallbackActive: false,
    metadata,
  });
}

export const NOW_HEALTH_POLICY = {
  principle: "If NOW is not certain, NOW does not pretend.",
  recoveryFlow: ["detect", "diagnose", "fallback", "verify"] as const,
  autonomousRepairsAllowed: [
    "discard_stale_cache",
    "switch_to_verified_fallback_source",
    "retry_idempotent_provider_read",
    "drop_optional_route_step",
  ] as const,
  autonomousRepairsForbidden: [
    "modify_code",
    "modify_database_schema",
    "change_payment_state",
    "change_security_configuration",
    "invent_provider_data",
  ] as const,
};
