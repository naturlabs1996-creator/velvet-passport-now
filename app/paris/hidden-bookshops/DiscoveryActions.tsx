"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoreOption } from "../../../lib/discovery/paris";

type Props = {
  page: string;
  theme: string;
  product: string;
  stores: StoreOption[];
  miniGuideUrl?: string;
};

function params() {
  if (typeof window === "undefined") return {};
  const search = new URLSearchParams(window.location.search);
  return {
    source: search.get("src") || search.get("utm_source") || undefined,
    campaign: search.get("campaign") || search.get("utm_campaign") || undefined,
    asset: search.get("asset") || search.get("utm_content") || undefined,
  };
}

function track(event: string, payload: Record<string, unknown> = {}) {
  const body = JSON.stringify({ event, ...params(), ...payload });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/discovery/events", new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch("/api/discovery/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  });
}

export default function DiscoveryActions({ page, theme, product, stores, miniGuideUrl }: Props) {
  const [open, setOpen] = useState(false);
  const availableStores = useMemo(() => stores.filter((store) => Boolean(store.url)), [stores]);

  useEffect(() => {
    track("page_view", { page, theme });
  }, [page, theme]);

  function openRouter() {
    track("guide_cta_click", { page, theme, product });
    track("store_router_open", { page, theme, product });
    setOpen(true);
  }

  return (
    <div className="discovery-actions">
      <button type="button" className="discovery-primary" onClick={openRouter}>
        Get Paris Uncovered
      </button>

      {miniGuideUrl ? (
        <a
          className="discovery-secondary"
          href={miniGuideUrl}
          onClick={() => track("mini_guide_click", { page, theme, product: "paris-mini-guide" })}
        >
          Try the Free Paris Mini Guide
        </a>
      ) : (
        <span className="discovery-secondary discovery-disabled">Free Paris Mini Guide · link pending</span>
      )}

      {open && (
        <div className="store-router" role="dialog" aria-modal="true" aria-label="Choose a store">
          <button className="store-router-close" type="button" onClick={() => setOpen(false)} aria-label="Close">
            ×
          </button>
          <p className="store-router-kicker">PARIS UNCOVERED</p>
          <h3>Choose where you'd like to get it</h3>
          <div className="store-router-options">
            {availableStores.length > 0 ? (
              availableStores.map((store) => (
                <a
                  key={store.key}
                  href={store.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => track("store_selected", { page, theme, product, store: store.key })}
                >
                  {store.label}
                </a>
              ))
            ) : (
              <p className="store-router-empty">Store links are ready to connect in configuration.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
