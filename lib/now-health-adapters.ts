import type { WeatherIntelligence } from "./weather-intelligence";
import type { RainAhead } from "./rain-ahead";
import type { LiveNeedChoice, LiveNeedScenario } from "./live-needs";
import {
  healthSignal,
  providerFailureSignal,
  providerHealthySignal,
  type NowHealthSignal,
} from "./now-health";

export function weatherHealthSignal(weather: WeatherIntelligence): NowHealthSignal {
  if (!weather.available) {
    return providerFailureSignal(
      "weather",
      "weather_unavailable",
      "Weather providers are unavailable; NOW must avoid weather-specific claims and keep a weather-neutral route.",
      true,
      { modelsAttempted: weather.modelsAttempted.length, modelsUsed: weather.modelsUsed.length },
    );
  }

  if (weather.agreement === "single-source" || weather.agreement === "mixed") {
    return healthSignal({
      component: "weather",
      level: "amber",
      code: weather.agreement === "mixed" ? "weather_models_disagree" : "weather_single_source",
      message: weather.agreement === "mixed"
        ? "Weather models disagree; NOW should use the conservative scenario and avoid overconfident wording."
        : "Only one weather source is available; NOW should treat the forecast as lower confidence.",
      fallbackAvailable: true,
      fallbackActive: true,
      metadata: {
        modelsAttempted: weather.modelsAttempted.length,
        modelsUsed: weather.modelsUsed.length,
        scenario: weather.scenario,
      },
    });
  }

  return providerHealthySignal(
    "weather",
    "weather_consensus_healthy",
    "Weather Intelligence has a usable multi-source consensus.",
    { modelsUsed: weather.modelsUsed.length, scenario: weather.scenario },
  );
}

export function rainAheadHealthSignal(rainAhead: RainAhead): NowHealthSignal {
  if (!rainAhead.available) {
    return providerFailureSignal(
      "rain_ahead",
      "rain_ahead_unavailable",
      "Rain Ahead is unavailable; NOW must suppress proactive rain claims and leave the current route unchanged.",
      true,
    );
  }

  return providerHealthySignal(
    "rain_ahead",
    rainAhead.alert ? "rain_ahead_alert_verified" : "rain_ahead_clear",
    rainAhead.alert ? "Rain Ahead has a verified alert candidate." : "Rain Ahead is available and has no near-term rain alert.",
    {
      alert: rainAhead.alert,
      confidence: rainAhead.confidence,
      minutesUntil: rainAhead.minutesUntil ?? null,
    },
  );
}

export function transportHealthSignal(provider: {
  connected: boolean;
  live: boolean;
  issue: boolean;
}): NowHealthSignal {
  if (provider.live && !provider.issue) {
    return providerHealthySignal(
      "transport",
      "transport_live_healthy",
      "Official Île-de-France Mobilités journey data is available.",
      { connected: provider.connected, live: true },
    );
  }

  return providerFailureSignal(
    "transport",
    provider.issue ? "transport_provider_unavailable" : provider.connected ? "transport_live_unresolved" : "transport_provider_unconfigured",
    provider.issue
      ? "Official transport data is temporarily unavailable; NOW is using clearly labelled estimates where possible."
      : provider.connected
        ? "Official transport data did not resolve a live journey; NOW is using clearly labelled estimates where possible."
        : "Official transport data is not configured; NOW is limited to clearly labelled estimates.",
    true,
    { connected: provider.connected, live: provider.live, issue: provider.issue },
  );
}

export function walkingHealthSignal(choices: Array<Pick<LiveNeedChoice, "walkingSource" | "walkingLive">>): NowHealthSignal {
  if (!choices.length) {
    return providerFailureSignal(
      "walking_routing",
      "walking_route_missing",
      "No walking route could be evaluated for the current choices.",
      false,
    );
  }

  const estimatedCount = choices.filter((choice) => choice.walkingSource === "estimated" || choice.walkingLive === false).length;
  if (estimatedCount > 0) {
    return providerFailureSignal(
      "walking_routing",
      "walking_estimate_fallback",
      "One or more walking routes are using deterministic estimates because street routing was unavailable.",
      true,
      { estimatedCount, total: choices.length },
    );
  }

  return providerHealthySignal(
    "walking_routing",
    "walking_routing_live",
    "Street-routed walking times are available.",
    { total: choices.length },
  );
}

export function liveNeedsHealthSignal(scenario: LiveNeedScenario, choices: LiveNeedChoice[]): NowHealthSignal {
  const minimum = scenario === "pharmacy" ? 2 : scenario === "food" ? 3 : 1;
  const confirmedOpen = choices.filter((choice) => choice.openStatus === "open");
  const unknown = choices.filter((choice) => !choice.openStatus || choice.openStatus === "unknown");

  if (confirmedOpen.length >= minimum) {
    return providerHealthySignal(
      "live_needs",
      "live_needs_healthy",
      `NOW has enough confirmed-open ${scenario} choices for the current location.`,
      { scenario, usable: confirmedOpen.length, unknown: unknown.length, total: choices.length },
    );
  }

  if (choices.length > 0) {
    return providerFailureSignal(
      "live_needs",
      unknown.length > 0 ? "live_needs_hours_unconfirmed" : "live_needs_limited",
      unknown.length > 0
        ? `NOW found ${scenario} options, but too few have confirmed current opening hours.`
        : `NOW found ${scenario} options, but fewer than the preferred number are safely usable right now.`,
      true,
      { scenario, usable: confirmedOpen.length, unknown: unknown.length, total: choices.length, minimum },
    );
  }

  return providerFailureSignal(
    "live_needs",
    "live_needs_unavailable",
    `NOW could not verify a usable ${scenario} option for the current request; it must show no verified choice rather than invent availability.`,
    true,
    { scenario, usable: 0, unknown: 0, total: 0, minimum },
  );
}