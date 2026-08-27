import type { TicketCandidate } from "./ticket-intelligence";

export type ViatorProviderMode = "production" | "sandbox" | "unconfigured";
export type ViatorCandidateState =
  | "verified"
  | "product_unavailable"
  | "slot_unavailable"
  | "price_changed"
  | "provider_unavailable"
  | "invalid_product"
  | "sandbox_only";

export type ViatorCandidateDiagnostic = {
  id: string;
  state: ViatorCandidateState;
  productCode?: string;
  previousPrice?: number;
  currentPrice?: number;
  currency?: string;
  message: string;
};

export type ViatorProviderResult = {
  mode: ViatorProviderMode;
  configured: boolean;
  verifiedCount: number;
  degraded: boolean;
  reason?: string;
  diagnostics: ViatorCandidateDiagnostic[];
  candidates: TicketCandidate[];
};

type BookingConfirmationSettings = {
  bookingCutoffType?: "START_TIME" | "OPENING_TIME" | "CLOSING_TIME" | "FIXED_TIME" | string;
  bookingCutoffInMinutes?: number;
  bookingCutoffFixedTime?: string;
  confirmationType?: string;
};

type ViatorProduct = {
  status?: string;
  productCode?: string;
  title?: string;
  timeZone?: string;
  bookingConfirmationSettings?: BookingConfirmationSettings;
};

type TimedEntry = {
  startTime?: string;
  unavailableDates?: string[];
};

type PricingRecord = {
  daysOfWeek?: string[];
  timedEntries?: TimedEntry[];
  unavailableDates?: string[];
};

type Season = {
  startDate?: string;
  endDate?: string;
  pricingRecords?: PricingRecord[];
};

type BookableItem = {
  productOptionCode?: string;
  seasons?: Season[];
};

type AvailabilitySchedule = {
  productCode?: string;
  bookableItems?: BookableItem[];
  currency?: string;
  summary?: { fromPrice?: number };
};

type PriceSnapshot = {
  price: number;
  currency?: string;
  observedAt: number;
};

const API_VERSION = "application/json;version=2.0";
const PARIS_TIME_ZONE = "Europe/Paris";
const PRICE_SNAPSHOT_TTL_MS = 6 * 60 * 60 * 1000;
const recentPrices = new Map<string, PriceSnapshot>();

function providerMode(): ViatorProviderMode {
  const mode = (process.env.VIATOR_API_MODE || "").trim().toLowerCase();
  if (mode === "production") return "production";
  if (mode === "sandbox") return "sandbox";
  return "unconfigured";
}

function baseUrl(mode: ViatorProviderMode) {
  if (mode === "production") return "https://api.viator.com/partner";
  if (mode === "sandbox") return "https://api.sandbox.viator.com/partner";
  return null;
}

function productCodeFromUrl(productUrl: string) {
  try {
    const url = new URL(productUrl);
    const match = url.pathname.match(/\/d\d+-([A-Za-z0-9_]+)\/?$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function clearLiveEvidence(candidate: TicketCandidate): TicketCandidate {
  const {
    availabilityVerifiedAt: _availabilityVerifiedAt,
    priceVerifiedAt: _priceVerifiedAt,
    currentPrice: _currentPrice,
    currency: _currency,
    ...safe
  } = candidate;
  return safe;
}

function previousPriceFor(productCode: string) {
  const snapshot = recentPrices.get(productCode);
  if (!snapshot) return undefined;
  if (Date.now() - snapshot.observedAt > PRICE_SNAPSHOT_TTL_MS) {
    recentPrices.delete(productCode);
    return undefined;
  }
  return snapshot;
}

function rememberPrice(productCode: string, price?: number, currency?: string) {
  if (typeof price !== "number" || !Number.isFinite(price)) return;
  recentPrices.set(productCode, { price, currency, observedAt: Date.now() });
}

function parisDateParts(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: String(parts.weekday || "").toUpperCase(),
    minutesNow: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function dateWithinSeason(date: string, season: Season) {
  if (!season.startDate || date < season.startDate) return false;
  if (season.endDate && date > season.endDate) return false;
  return true;
}

function startMinutes(value?: string) {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function startTimeCutoffMinutes(settings?: BookingConfirmationSettings) {
  if (settings?.bookingCutoffType !== "START_TIME") return 0;
  const value = Number(settings.bookingCutoffInMinutes ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.min(7 * 24 * 60, value)) : 0;
}

function scheduleHasAvailabilityToday(schedule: AvailabilitySchedule, cutoffMinutes = 0) {
  const today = parisDateParts();
  const earliestBookableStart = today.minutesNow + cutoffMinutes;
  for (const item of schedule.bookableItems ?? []) {
    for (const season of item.seasons ?? []) {
      if (!dateWithinSeason(today.date, season)) continue;
      for (const record of season.pricingRecords ?? []) {
        const weekdays = record.daysOfWeek ?? [];
        if (weekdays.length && !weekdays.includes(today.weekday)) continue;
        if ((record.unavailableDates ?? []).includes(today.date)) continue;

        const timedEntries = record.timedEntries ?? [];
        if (!timedEntries.length) return true;

        const viableTimedEntry = timedEntries.some((entry) => {
          if ((entry.unavailableDates ?? []).includes(today.date)) return false;
          const minutes = startMinutes(entry.startTime);
          if (minutes === null) return true;
          return minutes >= earliestBookableStart;
        });
        if (viableTimedEntry) return true;
      }
    }
  }
  return false;
}

async function viatorGet<T>(base: string, path: string, apiKey: string): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    headers: {
      "exp-api-key": apiKey,
      "Accept-Language": "en-US",
      Accept: API_VERSION,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error(`Viator ${response.status}`);
  return await response.json() as T;
}

async function revalidateCandidate(
  candidate: TicketCandidate,
  base: string,
  apiKey: string,
  mode: ViatorProviderMode,
): Promise<{ candidate: TicketCandidate; diagnostic: ViatorCandidateDiagnostic }> {
  const productCode = productCodeFromUrl(candidate.productUrl);
  const cleanCandidate = clearLiveEvidence(candidate);

  if (!productCode) {
    return {
      candidate: cleanCandidate,
      diagnostic: {
        id: candidate.id,
        state: "invalid_product",
        message: "The stored Viator URL no longer resolves to a valid exact product code.",
      },
    };
  }

  try {
    const [product, schedule] = await Promise.all([
      viatorGet<ViatorProduct>(base, `/products/${encodeURIComponent(productCode)}`, apiKey),
      viatorGet<AvailabilitySchedule>(base, `/availability/schedules/${encodeURIComponent(productCode)}`, apiKey),
    ]);

    const active = product.status === "ACTIVE" && product.productCode === productCode;
    if (!active) {
      return {
        candidate: cleanCandidate,
        diagnostic: {
          id: candidate.id,
          productCode,
          state: "product_unavailable",
          message: "Viator no longer reports this product as active, so NOW removed it from booking suggestions.",
        },
      };
    }

    const hasBookableItems = Array.isArray(schedule.bookableItems) && schedule.bookableItems.length > 0;
    const cutoffMinutes = startTimeCutoffMinutes(product.bookingConfirmationSettings);
    const availableToday = hasBookableItems && scheduleHasAvailabilityToday(schedule, cutoffMinutes);
    if (!availableToday) {
      return {
        candidate: cleanCandidate,
        diagnostic: {
          id: candidate.id,
          productCode,
          state: "slot_unavailable",
          message: cutoffMinutes > 0
            ? "The product is active, but no remaining slot is safely beyond the supplier booking cutoff. NOW removed it from the current selection."
            : "The product is active, but no viable remaining slot is present today. NOW removed it from the current selection.",
        },
      };
    }

    const verifiedAt = new Date().toISOString();
    const providerPrice = typeof schedule.summary?.fromPrice === "number" ? schedule.summary.fromPrice : undefined;
    const providerCurrency = typeof schedule.currency === "string" ? schedule.currency : undefined;
    const previousSnapshot = previousPriceFor(productCode);
    const previousPrice = typeof candidate.currentPrice === "number" ? candidate.currentPrice : previousSnapshot?.price;
    const priceChanged = typeof previousPrice === "number"
      && typeof providerPrice === "number"
      && Math.abs(previousPrice - providerPrice) > 0.009;
    rememberPrice(productCode, providerPrice, providerCurrency);

    if (mode !== "production") {
      return {
        candidate: cleanCandidate,
        diagnostic: {
          id: candidate.id,
          productCode,
          state: "sandbox_only",
          previousPrice: priceChanged ? previousPrice : undefined,
          currentPrice: providerPrice,
          currency: providerCurrency,
          message: priceChanged
            ? "Viator Sandbox returned a changed price, but sandbox evidence remains diagnostic only and never becomes traveler-facing booking readiness."
            : "Viator Sandbox returned data, but sandbox evidence never becomes traveler-facing booking readiness.",
        },
      };
    }

    const refreshed: TicketCandidate = {
      ...cleanCandidate,
      title: typeof product.title === "string" && product.title.trim() ? product.title.trim() : candidate.title,
      availabilityVerifiedAt: verifiedAt,
      currentPrice: providerPrice,
      currency: providerCurrency,
      priceVerifiedAt: providerPrice !== undefined ? verifiedAt : undefined,
    };

    return {
      candidate: refreshed,
      diagnostic: {
        id: candidate.id,
        productCode,
        state: priceChanged ? "price_changed" : "verified",
        previousPrice: priceChanged ? previousPrice : undefined,
        currentPrice: providerPrice,
        currency: providerCurrency,
        message: priceChanged
          ? "The live Viator price changed. NOW discarded the old price and will show only the freshly revalidated amount."
          : "Product, same-day availability and current provider pricing were freshly revalidated.",
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Viator request failed";
    return {
      candidate: cleanCandidate,
      diagnostic: {
        id: candidate.id,
        productCode,
        state: "provider_unavailable",
        message: `${message}. NOW removed stale booking evidence and kept the route usable without this offer.`,
      },
    };
  }
}

export async function revalidateViatorCandidates(candidates: TicketCandidate[]): Promise<ViatorProviderResult> {
  const mode = providerMode();
  const apiKey = process.env.VIATOR_API_KEY?.trim();
  const base = baseUrl(mode);

  if (!apiKey || !base) {
    const diagnostics = candidates.map<ViatorCandidateDiagnostic>((candidate) => ({
      id: candidate.id,
      state: "provider_unavailable",
      message: "Viator live verification is not configured. NOW will not expose stale or assumed booking availability.",
    }));
    return {
      mode,
      configured: false,
      verifiedCount: 0,
      degraded: true,
      reason: "Viator API is not configured for live verification.",
      diagnostics,
      candidates: candidates.map(clearLiveEvidence),
    };
  }

  const results = await Promise.all(candidates.map((candidate) => revalidateCandidate(candidate, base, apiKey, mode)));
  const refreshed = results.map((result) => result.candidate);
  const diagnostics = results.map((result) => result.diagnostic);
  const verifiedCount = diagnostics.filter((diagnostic) => diagnostic.state === "verified" || diagnostic.state === "price_changed").length;

  const unavailableCount = diagnostics.filter((diagnostic) =>
    ["product_unavailable", "slot_unavailable", "provider_unavailable", "invalid_product", "sandbox_only"].includes(diagnostic.state)
  ).length;

  return {
    mode,
    configured: true,
    verifiedCount,
    degraded: mode !== "production" || verifiedCount < 3,
    reason: mode !== "production"
      ? "Viator Sandbox is diagnostic only and cannot make offers booking-ready."
      : verifiedCount < 3
        ? `${unavailableCount} prepared offer(s) failed live revalidation; fewer than three remain safe to show.`
        : undefined,
    diagnostics,
    candidates: refreshed,
  };
}