"use client";

import { useEffect, useState } from "react";
import styles from "./RainAheadPrompt.module.css";

type RainAheadState = {
  alert: boolean;
  minutesUntil?: number;
  confidence?: "high" | "moderate" | "low" | "none";
  message?: string;
};

type ContextResponse = {
  rainAhead?: RainAheadState;
};

const FALLBACK_POINT = { lat: 48.8662, lon: 2.3371 };

export default function RainAheadPrompt() {
  const [rain, setRain] = useState<RainAheadState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async (lat: number, lon: number) => {
      try {
        const response = await fetch("/api/now/context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lon, radiusMeters: 800 }),
        });
        if (!response.ok) return;
        const context = await response.json() as ContextResponse;
        if (!cancelled) setRain(context.rainAhead ?? null);
      } catch {
        // Weather Ahead must never block the core route.
      }
    };

    if (!navigator.geolocation) {
      void load(FALLBACK_POINT.lat, FALLBACK_POINT.lon);
      return () => { cancelled = true; };
    }

    navigator.geolocation.getCurrentPosition(
      (position) => void load(position.coords.latitude, position.coords.longitude),
      () => void load(FALLBACK_POINT.lat, FALLBACK_POINT.lon),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 120000 },
    );

    return () => { cancelled = true; };
  }, []);

  if (!rain?.alert || dismissed) return null;

  function adjustRoute() {
    setBusy(true);
    setError("");

    const rainButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => /it[’']s raining/i.test(button.textContent ?? ""));

    if (rainButton) {
      rainButton.click();
      setDismissed(true);
      window.setTimeout(() => {
        document.getElementById("now-route-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
      return;
    }

    setBusy(false);
    setError("I couldn't adjust this route automatically. Your current route remains unchanged.");
  }

  const confidenceText = rain.confidence === "high" ? "High-confidence forecast" : rain.confidence === "moderate" ? "Rain forecast" : "Possible rain";

  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <div className={styles.card}>
        <div className={styles.topline}><span className={styles.dot} />RAIN AHEAD</div>
        <p className={styles.message}>{rain.message ?? `Rain is likely in about ${rain.minutesUntil ?? 30} minutes.`}</p>
        <p className={styles.detail}>{confidenceText}. Want me to adjust your route before it starts?</p>
        <div className={styles.actions}>
          <button type="button" onClick={adjustRoute} disabled={busy}>{busy ? "ADJUSTING…" : "ADJUST MY ROUTE"}</button>
          <button type="button" onClick={() => setDismissed(true)} disabled={busy}>KEEP CURRENT ROUTE</button>
        </div>
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}
