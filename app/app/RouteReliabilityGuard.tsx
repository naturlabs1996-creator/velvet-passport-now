"use client";

import { useEffect, useState } from "react";

type ReliabilityState = "verified" | "offline" | "revalidating";

function isRouteRequest(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  return method === "POST" && /\/api\/now\/route(?:\?|$)/.test(url);
}

export default function RouteReliabilityGuard() {
  const [state, setState] = useState<ReliabilityState>("verified");

  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);

    const onOffline = () => setState("offline");
    const onOnline = () => setState("revalidating");

    if (!navigator.onLine) setState("offline");

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!isRouteRequest(input, init)) return nativeFetch(input, init);

      if (!navigator.onLine) {
        setState("offline");
        return nativeFetch(input, init);
      }

      setState("revalidating");
      try {
        const response = await nativeFetch(input, init);
        if (response.ok) setState("verified");
        else setState("revalidating");
        return response;
      } catch (error) {
        setState(navigator.onLine ? "revalidating" : "offline");
        throw error;
      }
    };

    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      window.fetch = nativeFetch;
    };
  }, []);

  if (state === "verified") return null;

  const offline = state === "offline";
  return (
    <div
      role="status"
      aria-live="assertive"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 1000,
        padding: "10px 16px",
        textAlign: "center",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.08em",
        background: "#2a0f12",
        color: "#fff",
        borderBottom: "1px solid rgba(255,255,255,.2)",
      }}
    >
      {offline
        ? "OFFLINE · LAST ROUTE IS REFERENCE ONLY · LIVE CHANGES PAUSED"
        : "REVALIDATION REQUIRED · NOW IS VERIFYING THE ROUTE BEFORE CALLING IT LIVE"}
    </div>
  );
}
