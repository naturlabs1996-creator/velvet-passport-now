"use client";

import { useEffect } from "react";

const OFFICIAL_SERVICES = [
  { label: "European emergency", number: "112", purpose: "Police, fire or medical emergency" },
  { label: "SAMU — medical emergency", number: "15", purpose: "Urgent medical assistance in France" },
  { label: "Police or gendarmerie", number: "17", purpose: "Immediate danger or police assistance" },
  { label: "Fire and rescue", number: "18", purpose: "Fire, accident or rescue" },
  { label: "Emergency by text", number: "114", purpose: "Accessible emergency contact by text" },
];

function offlineGuardianResponse(level: "medical" | "emergency") {
  return new Response(JSON.stringify({
    level,
    routePaused: true,
    priority: "urgent",
    officialServices: OFFICIAL_SERVICES,
    hotelContact: {
      status: "consent_required",
      consent: false,
      messagePreview: null,
      deliveryAvailable: false,
    },
    passVerified: false,
    safetyAccess: "offline-emergency-services-only",
    disclaimer: "Guardian does not replace official emergency services or medical advice. Offline mode can only show the stored official emergency numbers.",
    mode: "offline-safety-fallback",
    generatedAt: new Date().toISOString(),
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-NOW-Data-Mode": "offline-emergency-services-only",
    },
  });
}

export default function GuardianOfflineFallback() {
  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

      if (method === "POST" && /\/api\/now\/guardian(?:\?|$)/.test(url)) {
        let level: "medical" | "emergency" | null = null;
        try {
          if (typeof init?.body === "string") {
            const body = JSON.parse(init.body) as { level?: unknown };
            if (body.level === "medical" || body.level === "emergency") level = body.level;
          }
        } catch {
          level = null;
        }

        if (level && !navigator.onLine) return offlineGuardianResponse(level);

        try {
          return await nativeFetch(input, init);
        } catch (error) {
          if (level) return offlineGuardianResponse(level);
          throw error;
        }
      }

      return nativeFetch(input, init);
    };

    return () => {
      window.fetch = nativeFetch;
    };
  }, []);

  return null;
}
