"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./health.module.css";

type HealthLevel = "green" | "amber" | "red";

type Signal = {
  component: string;
  level: HealthLevel;
  code: string;
  message: string;
  fallbackAvailable: boolean;
  fallbackActive?: boolean;
  checkedAt: string;
};

type ComponentRollup = {
  component: string;
  status: HealthLevel;
  code: string;
  message: string;
  fallbackActive: boolean;
};

type HealthPayload = {
  status: HealthLevel;
  travelerSafe: boolean;
  degraded: boolean;
  generatedAt: string;
  action: "continue" | "continue_with_fallbacks" | "protect_traveler";
  counts: Record<HealthLevel, number>;
  signals: Signal[];
  componentRollup?: ComponentRollup[];
  componentCount: number;
  scope: string;
  probeType: string;
};

const LABELS: Record<string, string> = {
  ticket_intelligence: "Ticket Intelligence",
  weather: "Weather",
  rain_ahead: "Rain Ahead",
  transport: "Transport",
  walking_routing: "Walking Routing",
  live_needs: "Live Needs",
  disruptions: "Disruptions",
  commerce: "Commerce",
  pass_access: "Pass Access",
};

function label(component: string) {
  return LABELS[component] ?? component.replaceAll("_", " ");
}

function statusCopy(status: HealthLevel) {
  if (status === "green") return "All monitored systems are operating within the expected safety envelope.";
  if (status === "amber") return "NOW is operating with one or more verified fallbacks or degraded providers.";
  return "A critical component has no acceptable fallback. Traveler protection must take priority.";
}

export default function HealthDashboard() {
  const [key, setKey] = useState("");
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem("now-health-key") ?? "";
    setKey(saved);
  }, []);

  async function runHealthCheck() {
    const cleanKey = key.trim();
    if (!cleanKey) {
      setError("Enter the internal Health Key.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/now/health", {
        headers: { "x-now-health-key": cleanKey },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok && response.status !== 503) {
        throw new Error("Health access was not accepted.");
      }
      if (!payload || !payload.status) throw new Error("Health response was incomplete.");
      sessionStorage.setItem("now-health-key", cleanKey);
      setHealth(payload as HealthPayload);
    } catch (err) {
      setHealth(null);
      setError(err instanceof Error ? err.message : "Health check failed.");
    } finally {
      setLoading(false);
    }
  }

  const rollup = useMemo(() => {
    if (!health) return [];
    if (health.componentRollup?.length) return health.componentRollup;
    const byComponent = new Map<string, ComponentRollup>();
    const weight: Record<HealthLevel, number> = { green: 0, amber: 1, red: 2 };
    for (const signal of health.signals) {
      const current = byComponent.get(signal.component);
      if (!current || weight[signal.level] > weight[current.status]) {
        byComponent.set(signal.component, {
          component: signal.component,
          status: signal.level,
          code: signal.code,
          message: signal.message,
          fallbackActive: Boolean(signal.fallbackActive),
        });
      }
    }
    return [...byComponent.values()];
  }, [health]);

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>VELVET PASSPORT NOW · INTERNAL</p>
          <h1>System Health</h1>
          <p className={styles.subhead}>One operational view of the systems that must keep working when a traveler is already in motion.</p>
        </div>
        <div className={styles.controls}>
          <input
            type="password"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") void runHealthCheck(); }}
            placeholder="Internal Health Key"
            aria-label="Internal Health Key"
          />
          <button type="button" onClick={() => void runHealthCheck()} disabled={loading}>
            {loading ? "RUNNING DEEP CHECK…" : health ? "RUN DEEP CHECK AGAIN" : "RUN DEEP CHECK"}
          </button>
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
      </section>

      {!health ? (
        <section className={styles.empty}>
          <span className={styles.emptyDot} />
          <div>
            <strong>Health data is private.</strong>
            <p>Enter the internal key to run a fresh provider and fallback diagnostic.</p>
          </div>
        </section>
      ) : (
        <>
          <section className={`${styles.overview} ${styles[health.status]}`}>
            <div className={styles.statusOrb} aria-hidden="true" />
            <div className={styles.overviewMain}>
              <p className={styles.statusLabel}>PARIS NOW · {health.status.toUpperCase()}</p>
              <h2>{health.status === "green" ? "Operating normally" : health.status === "amber" ? "Operating with fallbacks" : "Protection required"}</h2>
              <p>{statusCopy(health.status)}</p>
            </div>
            <div className={styles.metrics}>
              <div><strong>{health.counts.green}</strong><span>Green</span></div>
              <div><strong>{health.counts.amber}</strong><span>Amber</span></div>
              <div><strong>{health.counts.red}</strong><span>Red</span></div>
            </div>
          </section>

          <section className={styles.metaRow}>
            <span>Action: <strong>{health.action.replaceAll("_", " ")}</strong></span>
            <span>Traveler safe: <strong>{health.travelerSafe ? "YES" : "NO"}</strong></span>
            <span>Probe: <strong>{health.probeType}</strong></span>
            <span>Checked: <strong>{new Date(health.generatedAt).toLocaleString()}</strong></span>
          </section>

          <section className={styles.grid}>
            {rollup.map((item) => (
              <article className={`${styles.card} ${styles[item.status]}`} key={`${item.component}-${item.code}`}>
                <div className={styles.cardTop}>
                  <span className={styles.pill}>{item.status.toUpperCase()}</span>
                  <span className={styles.component}>{label(item.component)}</span>
                </div>
                <h3>{item.message}</h3>
                <div className={styles.cardFooter}>
                  <span>{item.code.replaceAll("_", " ")}</span>
                  <strong>{item.fallbackActive ? "Fallback active" : "Primary path"}</strong>
                </div>
              </article>
            ))}
          </section>

          <section className={styles.policy}>
            <div>
              <p className={styles.eyebrow}>OPERATING RULE</p>
              <h2>If NOW is not certain, NOW does not pretend.</h2>
            </div>
            <p>Green means primary operation is healthy. Amber means the traveler can continue with a verified fallback. Red means a critical function has no acceptable fallback and NOW must protect the traveler instead of improvising.</p>
          </section>
        </>
      )}
    </main>
  );
}
