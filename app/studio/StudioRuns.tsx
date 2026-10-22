"use client";
import { useCallback, useEffect, useState } from "react";
import styles from "./studio.module.css";
type Run = { key: string; label: string; run: number; status: string; conclusion: string | null; url: string };
type Data = { checked_at: string; runs: Run[] };
export default function StudioRuns() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/studio/runs", { cache: "no-store" });
      if (!response.ok) throw new Error("GitHub status unavailable");
      setData(await response.json() as Data); setError("");
    } catch { setError("Could not read GitHub Actions status. No changes were made."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return <section className={styles.card}>
    <div className={styles.runsHeader}><h3>GitHub production status</h3><button type="button" onClick={() => void refresh()} disabled={loading}>{loading ? "Checking…" : "Refresh status"}</button></div>
    <p>Source: GitHub Actions · read-only. No jobs are started from this screen.</p>
    {error && <p role="alert">{error}</p>}
    {data && <><ul className={styles.runs}>
      {data.runs.map(r => <li key={r.key}><span><strong>{r.label}</strong><small>{r.conclusion ?? r.status}</small></span><a href={r.url} target="_blank" rel="noopener noreferrer">Run #{r.run} ↗</a></li>)}
    </ul><small>Last checked: {new Date(data.checked_at).toLocaleString()}</small></>}
  </section>;
}
