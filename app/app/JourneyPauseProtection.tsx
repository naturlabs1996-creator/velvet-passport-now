"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./JourneyPauseProtection.module.css";

type ResumeOverride = {
  availableMinutes: number;
  location?: { lat: number; lon: number };
};

type Urgency = "normal" | "attention" | "urgent" | "critical" | "at_risk";

function parisClockMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const second = Number(parts.find((part) => part.type === "second")?.value ?? 0);
  return hour * 60 + minute + second / 60;
}

function ticketMinutes(time: string | null) {
  if (!time) return null;
  const match = time.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function remainingToTicket(time: string | null) {
  const target = ticketMinutes(time);
  if (target === null) return null;
  return Math.max(0, target - parisClockMinutes());
}

function urgencyFor(remaining: number | null): Urgency {
  if (remaining === null) return "normal";
  if (remaining <= 0) return "at_risk";
  if (remaining <= 7) return "critical";
  if (remaining <= 12) return "urgent";
  if (remaining <= 20) return "attention";
  return "normal";
}

function urgencyCopy(urgency: Urgency) {
  if (urgency === "at_risk") return "RESERVATION AT RISK · RESUME NOW";
  if (urgency === "critical") return "LEAVE NOW · RESERVATION CRITICAL";
  if (urgency === "urgent") return "RESUME NOW TO PROTECT YOUR RESERVATION";
  if (urgency === "attention") return "YOUR RESERVATION IS GETTING CLOSE";
  return "RESERVATION CLOCK STILL RUNNING";
}

function readTicketFromPage() {
  const text = document.getElementById("ticket-protection-section")?.textContent ?? "";
  return text.match(/\b([01]\d|2[0-3]):[0-5]\d\b/)?.[0] ?? null;
}

function getFreshPosition(): Promise<{ lat: number; lon: number } | undefined> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 15000 },
    );
  });
}

export default function JourneyPauseProtection() {
  const [paused, setPaused] = useState(false);
  const [ticketTime, setTicketTime] = useState<string | null>(null);
  const [clockTick, setClockTick] = useState(0);
  const [resuming, setResuming] = useState(false);
  const overrideRef = useRef<ResumeOverride | null>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const syncTicket = () => setTicketTime(readTicketFromPage());
    const initial = window.setTimeout(syncTicket, 600);
    const ticketRefresh = window.setInterval(syncTicket, 5000);
    const ticker = window.setInterval(() => setClockTick((value) => value + 1), 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(ticketRefresh);
      window.clearInterval(ticker);
    };
  }, []);

  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const isRoutePost = method === "POST" && /\/api\/now\/route(?:\?|$)/.test(url);
      const override = overrideRef.current;

      if (isRoutePost && pausedRef.current && !override) {
        throw new DOMException("Journey paused", "AbortError");
      }

      if (override && isRoutePost && typeof init?.body === "string") {
        try {
          const body = JSON.parse(init.body) as Record<string, unknown>;
          const currentAvailable = typeof body.availableMinutes === "number" ? body.availableMinutes : override.availableMinutes;
          body.availableMinutes = Math.max(1, Math.min(currentAvailable, override.availableMinutes));
          body.ticket = {
            ...(body.ticket && typeof body.ticket === "object" ? body.ticket as Record<string, unknown> : {}),
            time: ticketTime ?? undefined,
            protectedMarginMinutes: Math.min(15, Math.max(3, Math.floor(override.availableMinutes / 3))),
          };
          if (override.location) body.location = override.location;
          overrideRef.current = null;
          return nativeFetch(input, { ...init, body: JSON.stringify(body) });
        } catch {
          overrideRef.current = null;
        }
      }
      return nativeFetch(input, init);
    };
    return () => { window.fetch = nativeFetch; };
  }, [ticketTime]);

  const remaining = useMemo(() => {
    void clockTick;
    return remainingToTicket(ticketTime);
  }, [ticketTime, clockTick]);
  const urgency = urgencyFor(remaining);

  async function resumeJourney() {
    setResuming(true);
    const latestRemaining = remainingToTicket(ticketTime);
    const location = await getFreshPosition();
    overrideRef.current = {
      availableMinutes: Math.max(1, Math.floor(latestRemaining ?? 90)),
      location,
    };
    pausedRef.current = false;
    setPaused(false);
    window.dispatchEvent(new Event("online"));
    window.setTimeout(() => {
      document.getElementById("now-route-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      setResuming(false);
    }, 500);
  }

  function pauseJourney() {
    pausedRef.current = true;
    setPaused(true);
  }

  if (!ticketTime) return null;

  return (
    <aside className={`${styles.control} ${paused ? styles.paused : ""} ${styles[urgency]}`} aria-live="polite">
      <div className={styles.status}>
        <span>{paused ? "ROUTE PAUSED" : "RESERVATION PROTECTION"}</span>
        <strong>{remaining === null ? "—" : `${Math.max(0, Math.ceil(remaining))} min`}</strong>
        <small>{paused ? urgencyCopy(urgency) : `Louvre entry · ${ticketTime}`}</small>
      </div>
      {paused ? (
        <button type="button" onClick={resumeJourney} disabled={resuming}>
          {resuming ? "RECALCULATING…" : urgency === "critical" || urgency === "at_risk" ? "RESUME · GO NOW" : "RESUME & RECALCULATE"}
        </button>
      ) : (
        <button type="button" onClick={pauseJourney}>PAUSE ROUTE</button>
      )}
    </aside>
  );
}
