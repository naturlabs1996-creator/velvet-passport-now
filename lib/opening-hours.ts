export type OpenStatus = "open" | "closing_soon" | "closed" | "unknown";

export type OpeningEvaluation = {
  status: OpenStatus;
  label: string;
  openingHours?: string;
  closesInMinutes?: number;
};

const DAY_INDEX: Record<string, number> = {
  Mo: 1,
  Tu: 2,
  We: 3,
  Th: 4,
  Fr: 5,
  Sa: 6,
  Su: 7,
};

const CLOSING_SOON_MINUTES = 30;

function parisNowParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const weekdayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { day: weekdayMap[weekday] ?? 1, minuteOfDay: hour * 60 + minute };
}

function parseTime(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 24 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function expandDays(expression: string): Set<number> | null {
  const result = new Set<number>();
  for (const token of expression.split(",").map((item) => item.trim()).filter(Boolean)) {
    const range = token.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)-(Mo|Tu|We|Th|Fr|Sa|Su)$/);
    if (range) {
      const start = DAY_INDEX[range[1]];
      const end = DAY_INDEX[range[2]];
      let day = start;
      result.add(day);
      while (day !== end) {
        day = day === 7 ? 1 : day + 1;
        result.add(day);
      }
      continue;
    }
    if (DAY_INDEX[token]) {
      result.add(DAY_INDEX[token]);
      continue;
    }
    return null;
  }
  return result;
}

function evaluateRule(rule: string, day: number, minuteOfDay: number): { matches: boolean; closesInMinutes?: number } | null {
  const normalized = rule.trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  if (/\boff\b|\bclosed\b/i.test(normalized)) return { matches: false };

  const match = normalized.match(/^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*))\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
  if (!match) return null;
  const days = expandDays(match[1]);
  const start = parseTime(match[2]);
  const end = parseTime(match[3]);
  if (!days || start === null || end === null) return null;

  if (start <= end) {
    const matches = days.has(day) && minuteOfDay >= start && minuteOfDay < end;
    return matches ? { matches: true, closesInMinutes: end - minuteOfDay } : { matches: false };
  }

  const previousDay = day === 1 ? 7 : day - 1;
  if (days.has(day) && minuteOfDay >= start) return { matches: true, closesInMinutes: (24 * 60 - minuteOfDay) + end };
  if (days.has(previousDay) && minuteOfDay < end) return { matches: true, closesInMinutes: end - minuteOfDay };
  return { matches: false };
}

export function evaluateOpeningHours(openingHours?: string, now = new Date()): OpeningEvaluation {
  const raw = openingHours?.trim();
  if (!raw) return { status: "unknown", label: "Hours not confirmed" };
  if (raw === "24/7") return { status: "open", label: "Open now · 24/7", openingHours: raw };

  const { day, minuteOfDay } = parisNowParts(now);
  const rules = raw.split(";").map((rule) => rule.trim()).filter(Boolean);
  let understoodAny = false;
  for (const rule of rules) {
    const result = evaluateRule(rule, day, minuteOfDay);
    if (result === null) continue;
    understoodAny = true;
    if (result.matches) {
      const closesInMinutes = result.closesInMinutes;
      if (typeof closesInMinutes === "number" && closesInMinutes <= CLOSING_SOON_MINUTES) {
        return { status: "closing_soon", label: `Closing soon · ${closesInMinutes} min`, openingHours: raw, closesInMinutes };
      }
      return { status: "open", label: "Open now", openingHours: raw, closesInMinutes };
    }
  }

  if (understoodAny) return { status: "closed", label: "Closed now", openingHours: raw };
  return { status: "unknown", label: "Hours not confirmed", openingHours: raw };
}

export function sortByOpenStatus<T extends { openStatus?: OpenStatus; distanceMeters: number; closesInMinutes?: number }>(items: T[]) {
  const rank: Record<OpenStatus, number> = { open: 0, unknown: 1, closing_soon: 2, closed: 3 };
  return [...items].sort((a, b) => {
    const aRank = rank[a.openStatus ?? "unknown"];
    const bRank = rank[b.openStatus ?? "unknown"];
    if (aRank !== bRank) return aRank - bRank;
    if (a.openStatus === "open" && b.openStatus === "open") {
      const aRemaining = a.closesInMinutes ?? Number.POSITIVE_INFINITY;
      const bRemaining = b.closesInMinutes ?? Number.POSITIVE_INFINITY;
      if (aRemaining !== bRemaining) return bRemaining - aRemaining;
    }
    return a.distanceMeters - b.distanceMeters;
  });
}
