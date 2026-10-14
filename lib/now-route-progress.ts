/** Offline-first progress persistence for NOW walking routes.
 * No GPS coordinates or personal identifiers are stored.
 * Client-only: safe to import during SSR.
 */
export type RouteProgress = {
  version: 1;
  city: string;
  routeId: string;
  stopIndex: number;
  stopCount: number;
  updatedAt: number;
};
export type ProgressResult =
  | { ok: true; progress: RouteProgress }
  | { ok: false; reason: "unavailable" | "missing" | "invalid" };

const PREFIX = "vp-now-route-progress-v1:";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function key(city: string, routeId: string): string | null {
  if (!/^[a-z0-9_-]{1,60}$/i.test(city) || !/^[a-z0-9_-]{1,80}$/i.test(routeId)) return null;
  return PREFIX + city.toLowerCase() + ":" + routeId.toLowerCase();
}

function storage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; }
  catch { return null; }
}

export function saveRouteProgress(
  city: string, routeId: string, stopIndex: number, stopCount: number,
): ProgressResult {
  const k = key(city, routeId);
  if (!k || !Number.isSafeInteger(stopCount) || stopCount < 1 || stopCount > 100 ||
      !Number.isSafeInteger(stopIndex) || stopIndex < 0 || stopIndex >= stopCount)
    return { ok: false, reason: "invalid" };
  const s = storage();
  if (!s) return { ok: false, reason: "unavailable" };
  const progress: RouteProgress = { version: 1, city: city.toLowerCase(), routeId: routeId.toLowerCase(),
    stopIndex, stopCount, updatedAt: Date.now() };
  try { s.setItem(k, JSON.stringify(progress)); return { ok: true, progress }; }
  catch { return { ok: false, reason: "unavailable" }; }
}

export function loadRouteProgress(city: string, routeId: string, expectedStopCount: number): ProgressResult {
  const k = key(city, routeId);
  if (!k || !Number.isSafeInteger(expectedStopCount) || expectedStopCount < 1 || expectedStopCount > 100)
    return { ok: false, reason: "invalid" };
  const s = storage();
  if (!s) return { ok: false, reason: "unavailable" };
  try {
    const raw = s.getItem(k);
    if (raw === null) return { ok: false, reason: "missing" };
    const p: unknown = JSON.parse(raw);
    if (!p || typeof p !== "object") return { ok: false, reason: "invalid" };
    const v = p as Partial<RouteProgress>;
    if (v.version !== 1 || v.city !== city.toLowerCase() || v.routeId !== routeId.toLowerCase() ||
        v.stopCount !== expectedStopCount || !Number.isSafeInteger(v.stopIndex) ||
        (v.stopIndex as number) < 0 || (v.stopIndex as number) >= expectedStopCount ||
        !Number.isFinite(v.updatedAt) || (v.updatedAt as number) > Date.now() + 60000 ||
        Date.now() - (v.updatedAt as number) > MAX_AGE_MS)
      return { ok: false, reason: "invalid" };
    return { ok: true, progress: v as RouteProgress };
  } catch { return { ok: false, reason: "invalid" }; }
}

export function clearRouteProgress(city: string, routeId: string): boolean {
  const k = key(city, routeId);
  const s = storage();
  if (!k || !s) return false;
  try { s.removeItem(k); return true; }
  catch { return false; }
}
