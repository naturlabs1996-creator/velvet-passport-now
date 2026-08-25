import { getWeatherIntelligence } from "./weather-intelligence";
import { getRainAhead } from "./rain-ahead";
import { getWalkingRoute } from "./walking-routing";
import { getLiveNeedChoices } from "./live-needs";
import { PARIS_TICKET_SEEDS } from "./ticket-intelligence";
import { revalidateViatorCandidates } from "./viator-provider";
import {
  liveNeedsHealthSignal,
  rainAheadHealthSignal,
  walkingHealthSignal,
  weatherHealthSignal,
} from "./now-health-adapters";
import {
  providerFailureSignal,
  providerHealthySignal,
  summarizeNowHealth,
  type NowHealthComponent,
  type NowHealthLevel,
  type NowHealthSignal,
  type NowHealthSnapshot,
} from "./now-health";

const PARIS_REFERENCE = { lat: 48.8566, lon: 2.3522 };
const WALK_REFERENCE = { lat: 48.8606, lon: 2.3376 };
const LEVEL_WEIGHT: Record<NowHealthLevel, number> = { green: 0, amber: 1, red: 2 };

async function transportProbe(): Promise<NowHealthSignal> {
  const token = process.env.IDFM_PRIM_API_KEY || process.env.PRIM_API_KEY;
  if (!token) {
    return providerFailureSignal(
      "transport",
      "transport_provider_unconfigured",
      "Official transport provider is not configured; NOW can only use clearly labelled transport estimates.",
      true,
    );
  }

  try {
    const response = await fetch(
      "https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/places?q=Louvre%2C%20Paris&count=1",
      {
        headers: { apikey: token, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(7000),
      },
    );
    if (!response.ok) throw new Error(`PRIM ${response.status}`);
    return providerHealthySignal(
      "transport",
      "transport_provider_healthy",
      "Official Île-de-France Mobilités provider responded to the health probe.",
    );
  } catch {
    return providerFailureSignal(
      "transport",
      "transport_provider_unavailable",
      "Official transport provider did not pass the health probe; labelled estimates remain available.",
      true,
    );
  }
}

async function disruptionProbe(): Promise<NowHealthSignal> {
  try {
    const response = await fetch(
      "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/chantiers-a-paris/records?limit=1",
      { cache: "no-store", signal: AbortSignal.timeout(6000) },
    );
    if (!response.ok) throw new Error(`Paris Data ${response.status}`);
    return providerHealthySignal(
      "disruptions",
      "disruptions_provider_healthy",
      "Paris disruption data source responded to the health probe.",
    );
  } catch {
    return providerFailureSignal(
      "disruptions",
      "disruptions_provider_unavailable",
      "Paris disruption data is temporarily unavailable; NOW must avoid claiming that streets are clear.",
      true,
    );
  }
}

async function commerceProbe(): Promise<NowHealthSignal> {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    return providerFailureSignal(
      "commerce",
      "commerce_unconfigured",
      "Stripe commerce is not configured.",
      false,
    );
  }

  try {
    const response = await fetch("https://api.stripe.com/v1/account", {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new Error(`Stripe ${response.status}`);
    return providerHealthySignal(
      "commerce",
      "commerce_provider_healthy",
      "Stripe responded to a read-only account health probe.",
    );
  } catch {
    return providerFailureSignal(
      "commerce",
      "commerce_provider_unavailable",
      "Stripe did not pass the read-only health probe; new purchases should not be assumed available.",
      false,
    );
  }
}

function passAccessProbe(): NowHealthSignal {
  const passSecret = process.env.PARIS_NOW_PASS_SECRET?.trim();
  return passSecret
    ? providerHealthySignal(
        "pass_access",
        "pass_signing_configured",
        "Paris NOW Pass signing secret is configured.",
      )
    : providerFailureSignal(
        "pass_access",
        "pass_signing_unconfigured",
        "Paris NOW Pass signing secret is missing.",
        false,
      );
}

function ticketSignal(provider: Awaited<ReturnType<typeof revalidateViatorCandidates>>): NowHealthSignal {
  if (provider.mode === "production" && !provider.degraded && provider.verifiedCount >= 3) {
    return providerHealthySignal(
      "ticket_intelligence",
      "ticket_provider_healthy",
      "Ticket Intelligence has at least three freshly revalidated production offers.",
      { verifiedCount: provider.verifiedCount },
    );
  }

  return providerFailureSignal(
    "ticket_intelligence",
    provider.configured ? "ticket_provider_degraded" : "ticket_provider_unconfigured",
    provider.reason || "Ticket provider cannot currently prove three live bookable offers.",
    true,
    { verifiedCount: provider.verifiedCount, productionMode: provider.mode === "production" },
  );
}

export type GlobalHealthComponent = {
  component: NowHealthComponent;
  status: NowHealthLevel;
  degraded: boolean;
  fallbackActive: boolean;
  signalCount: number;
  primaryCode: string;
  primaryMessage: string;
};

function componentRollup(signals: NowHealthSignal[]): GlobalHealthComponent[] {
  const groups = new Map<NowHealthComponent, NowHealthSignal[]>();
  for (const signal of signals) {
    const existing = groups.get(signal.component) ?? [];
    existing.push(signal);
    groups.set(signal.component, existing);
  }

  return [...groups.entries()].map(([component, componentSignals]) => {
    const primary = [...componentSignals].sort((a, b) => LEVEL_WEIGHT[b.level] - LEVEL_WEIGHT[a.level])[0];
    return {
      component,
      status: primary.level,
      degraded: componentSignals.some((signal) => signal.level !== "green"),
      fallbackActive: componentSignals.some((signal) => Boolean(signal.fallbackActive)),
      signalCount: componentSignals.length,
      primaryCode: primary.code,
      primaryMessage: primary.message,
    };
  }).sort((a, b) => LEVEL_WEIGHT[b.status] - LEVEL_WEIGHT[a.status] || a.component.localeCompare(b.component));
}

export type GlobalNowHealth = NowHealthSnapshot & {
  scope: "paris-now";
  probeType: "deep";
  componentCount: number;
  components: GlobalHealthComponent[];
};

export async function runGlobalNowHealth(): Promise<GlobalNowHealth> {
  const [weather, rainAhead, walking, pharmacyChoices, foodChoices, tickets, transport, disruptions, commerce] = await Promise.all([
    getWeatherIntelligence(PARIS_REFERENCE),
    getRainAhead(PARIS_REFERENCE),
    getWalkingRoute(PARIS_REFERENCE, WALK_REFERENCE),
    getLiveNeedChoices("Louvre & Opéra", "pharmacy", PARIS_REFERENCE),
    getLiveNeedChoices("Louvre & Opéra", "food", PARIS_REFERENCE),
    revalidateViatorCandidates(PARIS_TICKET_SEEDS),
    transportProbe(),
    disruptionProbe(),
    commerceProbe(),
  ]);

  const signals: NowHealthSignal[] = [
    weatherHealthSignal(weather),
    rainAheadHealthSignal(rainAhead),
    walkingHealthSignal([{
      walkingSource: walking.source,
      walkingLive: walking.live,
    }]),
    liveNeedsHealthSignal("pharmacy", pharmacyChoices),
    liveNeedsHealthSignal("food", foodChoices),
    ticketSignal(tickets),
    transport,
    disruptions,
    commerce,
    passAccessProbe(),
  ];

  const snapshot = summarizeNowHealth(signals);
  const components = componentRollup(signals);
  return {
    ...snapshot,
    scope: "paris-now",
    probeType: "deep",
    componentCount: components.length,
    components,
  };
}
