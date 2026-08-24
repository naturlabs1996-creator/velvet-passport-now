"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

type ActivationState = "ready" | "pending" | "activating" | "retry" | "error";

export default function ActivateParisNow() {
  const [state, setState] = useState<ActivationState>("pending");
  const [message, setMessage] = useState("Checking your Stripe purchase. Your Pass has not started.");

  useEffect(() => {
    const checkout = new URLSearchParams(window.location.search).get("checkout");
    if (checkout === "ready") {
      setState("ready");
      setMessage("Your Pass is paid and waiting. The clock has not started.");
    } else if (checkout === "failed") {
      setState("error");
      setMessage("We could not verify this purchase in this browser. No Pass has been activated and no timer has started.");
    } else {
      setState("pending");
      setMessage("Stripe is still confirming the purchase. Your Pass has not started. Refresh this page after confirmation completes.");
    }
  }, []);

  async function activate() {
    if (state === "activating" || state === "error" || state === "pending") return;
    setState("activating");
    setMessage("Confirming your purchase and starting your Pass…");
    try {
      const response = await fetch("/api/now/activate-pass", { method: "POST" });
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
      setMessage(data.error || "This Pass could not be activated. No timer has started.");
    } catch {
      setState("retry");
      setMessage("The connection was interrupted. Your Pass has not started. Try again when you’re ready.");
    }
  }

  const confirmed = state === "ready" || state === "activating" || state === "retry";

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <a className={styles.brand} href="/" aria-label="Paris NOW home">
          <span className={styles.rings}><i /><i /></span>
          <span>Paris <b>NOW</b></span>
        </a>
        <p className={styles.kicker}>{confirmed ? "PURCHASE CONFIRMED" : state === "pending" ? "CONFIRMATION IN PROGRESS" : "PURCHASE NOT VERIFIED"}</p>
        <h1>{confirmed ? <>Your Pass is yours.<br /><em>Start it when you’re ready.</em></> : state === "pending" ? <>Your Pass is not running.<br /><em>We’re confirming the purchase.</em></> : <>Nothing has started.<br /><em>Your access is protected.</em></>}</h1>
        <p className={styles.message}>{message}</p>
        <div className={styles.rule} />
        <div className={styles.promise}>
          <span><b>01</b> Buying does not start the clock.</span>
          <span><b>02</b> Activation starts your 72-hour or 7-day window.</span>
          <span><b>03</b> Reopening this page never extends or resets an active Pass.</span>
        </div>
        {state !== "error" && state !== "pending" && <button className={styles.activate} type="button" onClick={activate} disabled={state === "activating"}>
          {state === "activating" ? "ACTIVATING…" : state === "retry" ? "TRY ACTIVATION AGAIN →" : "ACTIVATE PARIS NOW →"}
        </button>}
        {state === "pending" && <button className={styles.activate} type="button" onClick={() => window.location.reload()}>CHECK AGAIN →</button>}
        {state === "error" && <a className={styles.activate} href="/contact">CONTACT VELVET PASSPORT →</a>}
        <p className={styles.small}>Activation is final for the current Pass period. Your exact expiration is recorded securely when you confirm.</p>
      </section>
    </main>
  );
}
