"use client";

export type LiveNeedChoice = {
  name: string;
  detail: string;
  distanceMeters: number;
  lat: number;
  lon: number;
  source: string;
  openStatus?: "open" | "closing_soon" | "closed" | "unknown";
  openLabel?: string;
  closesInMinutes?: number;
  travelMinutes?: number;
  walkingSource?: "valhalla" | "estimated";
  walkingLive?: boolean;
  walkingCacheHit?: boolean;
};

type Props = {
  kind: "food" | "pharmacy";
  choices: LiveNeedChoice[];
  selected?: LiveNeedChoice | null;
  busy: boolean;
  onSelect: (choice: LiveNeedChoice) => void;
};

function statusText(choice: LiveNeedChoice) {
  if (choice.openStatus === "open") return choice.openLabel || "Open now";
  if (choice.openStatus === "closing_soon") return choice.openLabel || "Closing soon";
  if (choice.openStatus === "closed") return "Closed now";
  return "Hours not confirmed";
}

function sameChoice(a: LiveNeedChoice | null | undefined, b: LiveNeedChoice) {
  return Boolean(a && a.name === b.name && Math.abs(a.lat - b.lat) < 0.00025 && Math.abs(a.lon - b.lon) < 0.00035);
}

export default function LiveNeedChoices({ kind, choices, selected, busy, onSelect }: Props) {
  const visible = choices.slice(0, 3);
  if (!visible.length) return null;

  return (
    <section style={{ margin: "0 15px 20px", background: "#fff", border: "1px solid #ddd4c2", padding: "20px 16px" }} aria-live="polite">
      <span style={{ display: "block", color: "#a2802d", fontSize: 9, letterSpacing: ".19em", fontWeight: 700 }}>
        {kind === "food" ? "NOW TABLE CHOICES" : "NOW PHARMACY CHOICES"}
      </span>
      <h2 style={{ margin: "8px 0 6px", font: "28px/1.05 Georgia,serif", color: "#211e19" }}>
        {kind === "food" ? "Choose your table." : "Choose your pharmacy."}
      </h2>
      <p style={{ margin: "0 0 15px", color: "#746f67", fontSize: 12, lineHeight: 1.45 }}>
        NOW has already filtered these for distance and timing. Selecting one recalculates your protected route.
      </p>

      <div style={{ display: "grid", gap: 9 }}>
        {visible.map((choice) => {
          const isSelected = sameChoice(selected, choice);
          const unavailable = choice.openStatus === "closed";
          const walkMinutes = choice.travelMinutes ?? Math.max(1, Math.round(choice.distanceMeters / 80));
          const routingLabel = choice.walkingSource === "valhalla" ? "STREET ROUTED" : "WALK ESTIMATE";
          return (
            <button
              key={`${choice.name}-${choice.lat}-${choice.lon}`}
              type="button"
              disabled={busy || unavailable}
              onClick={() => onSelect(choice)}
              style={{
                width: "100%",
                border: isSelected ? "1px solid #b28e32" : "1px solid #ddd6c9",
                background: isSelected ? "#f4efe2" : "#fff",
                padding: "13px 12px",
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "5px 12px",
                textAlign: "left",
                color: "#211e19",
                opacity: unavailable ? .48 : 1,
              }}
            >
              <strong style={{ font: "17px Georgia,serif" }}>{choice.name}</strong>
              <b style={{ fontSize: 11, color: choice.openStatus === "closing_soon" ? "#9a5b21" : choice.openStatus === "open" ? "#397f65" : "#756f66" }}>
                {statusText(choice)}
              </b>
              <span style={{ gridColumn: "1", color: "#7a756d", fontSize: 11 }}>{walkMinutes} min walk · {choice.distanceMeters} m</span>
              <em style={{ gridColumn: "2", gridRow: "2 / 5", alignSelf: "end", fontStyle: "normal", fontSize: 9, letterSpacing: ".08em", color: "#8a6d24" }}>
                {isSelected ? "SELECTED ✓" : unavailable ? "CLOSED" : busy ? "RECALCULATING…" : "USE THIS STOP →"}
              </em>
              <small style={{ gridColumn: "1", color: "#9a948a", fontSize: 9 }}>{choice.source}</small>
              <small style={{ gridColumn: "1", color: choice.walkingSource === "valhalla" ? "#397f65" : "#9a948a", fontSize: 8, letterSpacing: ".08em" }}>{routingLabel}{choice.walkingCacheHit ? " · CACHED" : ""}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
