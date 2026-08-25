import type { TicketCandidate } from "./ticket-intelligence";

export type ViatorProviderMode = "production" | "sandbox" | "unconfigured";

export type ViatorProviderResult = {
  mode: ViatorProviderMode;
  configured: boolean;
  verifiedCount: number;
  degraded: boolean;
  reason?: string;
  candidates: TicketCandidate[];
};

type ViatorProduct = {
  status?: string;
  productCode?: string;
  title?: string;
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

const API_VERSION = "application/json;version=2.0";
const PARIS_TIME_ZONE = "Europe/Paris";

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

function scheduleHasAvailabilityToday(schedule: AvailabilitySchedule) {
  const today = parisDateParts();
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
          return minutes >= today.minutesNow;
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

async function revalidateCandidate(candidate: TicketCandidate, base: string, apiKey: string, mode: ViatorProviderMode) {
  const productCode = productCodeFromUrl(candidate.productUrl);
  if (!productCode) return candidate;

  try {
    const [product, schedule] = await Promise.all([
      viatorGet<ViatorProduct>(base, `/products/${encodeURIComponent(productCode)}`, apiKey),
      viatorGet<AvailabilitySchedule>(base, `/availability/schedules/${encodeURIComponent(productCode)}`, apiKey),
    ]);

    const active = product.status === "ACTIVE" && product.productCode === productCode;
    const hasBookableItems = Array.isArray(schedule.bookableItems) && schedule.bookableItems.length > 0;
    const availableToday = active && hasBookableItems && scheduleHasAvailabilityToday(schedule);
    const verifiedAt = new Date().toISOString();

    // Sandbox is diagnostic only. It must never make a traveler-facing offer booking-ready.
    const productionVerified = mode === "production" && availableToday;

    return {
      ...candidate,
      title: typeof product.title === "string" && product.title.trim() ? product.title.trim() : candidate.title,
      availabilityVerifiedAt: productionVerified ? verifiedAt : undefined,
      currentPrice: productionVerified && typeof schedule.summary?.fromPrice === "number" ? schedule.summary.fromPrice : undefined,
      currency: productionVerified && typeof schedule.currency === "string" ? schedule.currency : undefined,
      priceVerifiedAt: productionVerified && typeof schedule.summary?.fromPrice === "number" ? verifiedAt : undefined,
    } satisfies TicketCandidate;
  } catch {
    return candidate;
  }
}

export async function revalidateViatorCandidates(candidates: TicketCandidate[]): Promise<ViatorProviderResult> {
  const mode = providerMode();
  const apiKey = process.env.VIATOR_API_KEY?.trim();
  const base = baseUrl(mode);

  if (!apiKey || !base) {
    return {
      mode,
      configured: false,
      verifiedCount: 0,
      degraded: true,
      reason: "Viator API is not configured for live verification.",
      candidates,
    };
  }

  const refreshed = await Promise.all(candidates.map((candidate) => revalidateCandidate(candidate, base, apiKey, mode)));
  const verifiedCount = refreshed.filter((candidate) => Boolean(candidate.availabilityVerifiedAt)).length;

  return {
    mode,
    configured: true,
    verifiedCount,
    degraded: mode !== "production" || verifiedCount < 3,
    reason: mode !== "production"
      ? "Viator Sandbox is available for testing, but sandbox responses are never treated as live booking availability."
      : verifiedCount < 3
        ? "Fewer than three offers passed live Viator verification."
        : undefined,
    candidates: refreshed,
  };
}
