"use client";

import { useEffect } from "react";

const BUY_BUTTON = /^BUY (72-HOUR|7-DAY) PASS/i;
const RESET_AFTER_MS = 12000;
const ATTEMPT_TTL_MS = 30000;
const ATTEMPT_STORAGE_KEY = "paris_now_checkout_attempt";

type StoredAttempt = {
  id: string;
  key: string;
  createdAt: number;
};

function sharedAttemptFor(init?: RequestInit) {
  let key = "unknown";
  try {
    if (typeof init?.body === "string") {
      const parsed = JSON.parse(init.body) as { plan?: unknown; channel?: unknown };
      key = `${String(parsed.plan ?? "unknown")}:${String(parsed.channel ?? "direct")}`;
    }
  } catch {
    key = "unknown";
  }

  try {
    const raw = window.localStorage.getItem(ATTEMPT_STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) as StoredAttempt : null;
    if (stored && stored.key === key && Date.now() - stored.createdAt <= ATTEMPT_TTL_MS && /^[A-Za-z0-9_-]{20,100}$/.test(stored.id)) {
      return stored.id;
    }
  } catch {
    // Local storage may be unavailable in strict privacy modes.
  }

  const id = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(18))).map((value) => value.toString(16).padStart(2, "0")).join("");

  try {
    window.localStorage.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify({ id, key, createdAt: Date.now() } satisfies StoredAttempt));
  } catch {
    // The request still proceeds; server-side validation remains active.
  }
  return id;
}

export default function CheckoutClickGuard() {
  useEffect(() => {
    let locked = false;
    let resetTimer: number | null = null;
    const nativeFetch = window.fetch.bind(window);

    const unlock = () => {
      locked = false;
      if (resetTimer !== null) {
        window.clearTimeout(resetTimer);
        resetTimer = null;
      }
    };

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button");
      if (!button || !BUY_BUTTON.test(button.textContent?.trim() ?? "")) return;

      if (locked) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }

      locked = true;
      resetTimer = window.setTimeout(unlock, RESET_AFTER_MS);
    };

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (method === "POST" && /\/api\/now\/checkout(?:\?|$)/.test(url)) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        headers.set("X-NOW-Checkout-Attempt", sharedAttemptFor(init));
        return nativeFetch(input, { ...init, headers });
      }
      return nativeFetch(input, init);
    };

    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("pageshow", unlock);

    return () => {
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("pageshow", unlock);
      window.fetch = nativeFetch;
      if (resetTimer !== null) window.clearTimeout(resetTimer);
    };
  }, []);

  return null;
}
