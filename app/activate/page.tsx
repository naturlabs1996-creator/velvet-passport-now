"use client";

import { useState } from "react";
import styles from "./page.module.css";

export default function ActivateParisNow() {
  const [state, setState] = useState<"ready" | "activating" | "retry" | "error">("ready");
  const [message, setMessage] = useState("Your Pass is paid and waiting. The clock has not started.");

  async function activate() {
    if (state === "activating") return;
    setState("activating");
    setMessage("Confirming your purchase and starting your Pass…");
    try {
      const response = await fetch("/api/now/activate-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await response.json() as { activated?: boolean; retryable?: boolean; error?: string };
      if (response.ok && data.activated) {
        window.location.assign("/app?checkout=activated");
        return;
      }
      if (data.retryable) {
        setState("retry");
        setMessage("Stripe is still finishing the payment confirmation. Your Pass has not started. Try again in a moment.");
        return;
      }
      setState("error");
      setMessage(data.error || "This Pass could not be activated.");
    } catch {
      setState("retry");
      setMessage("The connection was interrupted. Your Pass has not started. Try again when you’re ready.");
    }
  }

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <a className={styles.brand} href="/" aria-label="Paris NOW home">
          <span className={styles.rings}><i /><i /></span>
          <span>Paris <b>NOW</b></span>
        </a>
        <p className={styles.kicker}>PURCHASE CONFIRMED</p>
        <h1>Your Pass is yours.<br /><em>Start it when you’re ready.</em></h1>
        <p className={styles.message}>{message}</p>
        <div className={styles.rule} />
        <div className={styles.promise}>
          <span><b>01</b> Buying does not start the clock.</span>
          <span><b>02</b> Activation starts your 72-hour or 7-day window.</span>
          <span><b>03</b> Reopening this page never extends or resets an active Pass.</span>
        </div>
        <button className={styles.activate} type="button" onClick={activate} disabled={state === "activating"}>
          {state === "activating" ? "ACTIVATING…" : state === "retry" ? "TRY ACTIVATION AGAIN →" : "ACTIVATE PARIS NOW →"}
        </button>
        <p className={styles.small}>Activation is final for the current Pass period. Your exact expiration is recorded securely when you confirm.</p>
      </section>
    </main>
  );
}
