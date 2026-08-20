"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type Need = "route" | "rain" | "blocked" | "food" | "water" | "restroom" | "energy" | "pharmacy" | "sitdown" | "battery" | "medication" | "glucose" | "guardian";

type TicketState = {
  venue: string;
  time: string;
  entrance: string;
  marginMinutes: number;
  protected: boolean;
};

type GuardianLevel = "checkin" | "assistance" | "medical" | "emergency";

type PassStatus = {
  state: "loading" | "active" | "preview" | "inactive";
  allowed: boolean;
  plan: string | null;
  expiresAt: string | null;
};

type GuardianAssessment = {
  level: GuardianLevel;
  priority: "standard" | "urgent";
  officialServices: { label: string; number: string; purpose: string }[];
  hotelContact: {
    status: "consent_required" | "preview_only";
    consent: boolean;
    messagePreview: string | null;
    deliveryAvailable: boolean;
  };
  disclaimer: string;
};

type Stop = {
  time: string;
  duration: string;
  title: string;
  detail: string;
  state?: "current" | "next" | "done" | "warning" | "destination";
};

type RouteView = {
  eyebrow: string;
  title: string;
  meta: string;
  note: string;
  stops: Stop[];
};

const emptyRoute: RouteView = {
  eyebrow: "NOW ENGINE",
  title: "Preparing your protected route…",
  meta: "Checking time, access and your next obligation.",
  note: "The route is calculated securely on the server.",
  stops: [
    { time: "NOW", duration: "—", title: "Calculating route", detail: "Please keep this screen open", state: "current" },
  ],
};

const needs: { id: Need; label: string; icon: string }[] = [
  { id: "rain", label: "It’s raining", icon: "☂" },
  { id: "blocked", label: "Street blocked", icon: "⊘" },
  { id: "food", label: "I’m hungry", icon: "⌖" },
  { id: "water", label: "I need water", icon: "◉" },
  { id: "restroom", label: "I need a restroom", icon: "WC" },
  { id: "energy", label: "Low energy", icon: "◌" },
  { id: "pharmacy", label: "Find a pharmacy", icon: "✚" },
  { id: "sitdown", label: "I need to sit down", icon: "◡" },
  { id: "battery", label: "Phone battery", icon: "▥" },
  { id: "medication", label: "Medication reminder", icon: "◷" },
  { id: "glucose", label: "Glucose check", icon: "◉" },
  { id: "guardian", label: "I need help", icon: "✚" },
];

export default function ParisNowApp() {
  const [active, setActive] = useState<Need>("route");
  const [progress, setProgress] = useState(7);
  const [rebuilding, setRebuilding] = useState(false);
  const [serverRoute, setServerRoute] = useState<RouteView | null>(null);
  const [ticket, setTicket] = useState<TicketState>({
    venue: "Musée du Louvre",
    time: "16:30",
    entrance: "Carrousel du Louvre",
    marginMinutes: 24,
    protected: true,
  });
  const [ticketOpen, setTicketOpen] = useState(false);
  const [passStatus, setPassStatus] = useState<PassStatus>({ state: "loading", allowed: false, plan: null, expiresAt: null });
  const [guardianLevel, setGuardianLevel] = useState<GuardianLevel>("checkin");
  const [hotelConsent, setHotelConsent] = useState(false);
  const [guardianAssessment, setGuardianAssessment] = useState<GuardianAssessment | null>(null);
  const route = serverRoute ?? emptyRoute;

  useEffect(() => {
    fetch("/api/now/pass", { cache: "no-store" })
      .then(async (response) => {
        const status = await response.json();
        setPassStatus(status);
      })
      .catch(() => setPassStatus({ state: "inactive", allowed: false, plan: null, expiresAt: null }));
  }, []);

  useEffect(() => {
    setProgress(7);
    setRebuilding(true);
    const controller = new AbortController();
    const rebuild = window.setTimeout(() => setRebuilding(false), 850);
    const timer = window.setInterval(() => {
      setProgress((value) => (value >= 88 ? value : value + 1));
    }, 1400);

    fetch("/api/now/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: active, ticketTime: "16:30" }),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Route calculation failed");
        return response.json();
      })
      .then((plan) => {
        setServerRoute(plan);
        setTicket(plan.ticket);
      })
      .catch((error) => {
        if (error instanceof Error && error.name !== "AbortError") {
          setServerRoute(null);
        }
      });

    return () => {
      controller.abort();
      window.clearTimeout(rebuild);
      window.clearInterval(timer);
    };
  }, [active]);

  useEffect(() => {
    if (active !== "guardian") return;
    const controller = new AbortController();

    fetch("/api/now/guardian", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: guardianLevel, hotelConsent }),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Guardian assessment failed");
        return response.json();
      })
      .then((assessment: GuardianAssessment) => setGuardianAssessment(assessment))
      .catch((error) => {
        if (!(error instanceof Error && error.name === "AbortError")) {
          setGuardianAssessment(null);
        }
      });

    return () => controller.abort();
  }, [active, guardianLevel, hotelConsent]);

  const status = useMemo(() => active === "blocked" ? "Reroute active" : active === "guardian" ? "Route paused" : "Live route", [active]);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="Return to Paris NOW">
          <span className={styles.rings}><i /><i /></span>
          <span>Paris <b>NOW</b></span>
        </a>
        <div className={styles.pass}>
          <span>{passStatus.state === "preview" ? "DEVELOPMENT" : passStatus.plan === "7d" ? "7-DAY PASS" : "72H PASS"}</span>
          <strong>{passStatus.state === "active" ? "ACTIVE" : passStatus.state === "preview" ? "PREVIEW MODE" : passStatus.state === "loading" ? "CHECKING" : "INACTIVE"}</strong>
        </div>
      </header>

      <section className={styles.context}>
        <div>
          <span className={styles.kicker}>PARIS · LOUVRE & OPÉRA</span>
          <h1>Good afternoon, Alan.</h1>
          <p>We’re protecting your Louvre entry at 16:30.</p>
        </div>
        <div className={styles.weather}>
          <b>18°</b><span>Light rain</span>
        </div>
      </section>

      {passStatus.state === "preview" && (
        <div className={styles.previewBanner}>PRIVATE PREVIEW · NO CUSTOMER PASS HAS BEEN ACTIVATED</div>
      )}
      {passStatus.state === "inactive" && (
        <div className={styles.inactiveBanner}>A valid Paris NOW Pass is required to calculate routes.</div>
      )}

      <section className={styles.liveCard}>
        <div className={styles.liveTop}>
          <span><i className={active === "blocked" || active === "guardian" ? styles.alertDot : styles.liveDot} />{status}</span>
          <span>15:04</span>
        </div>
        <div className={styles.progressTrack}>
          <span className={active === "blocked" || active === "guardian" ? styles.redProgress : ""} style={{ width: `${progress}%` }} />
        </div>
        <div className={styles.progressLabels}>
          <span>Galerie Vivienne</span>
          <span>Louvre 16:30</span>
        </div>
      </section>

      <section className={styles.ticketProtection}>
        <button className={styles.ticketSummary} onClick={() => setTicketOpen((open) => !open)} aria-expanded={ticketOpen}>
          <span>
            <i className={ticket.protected ? styles.liveDot : styles.alertDot} />
            TICKET PROTECTION
          </span>
          <strong>{ticket.venue} · {ticket.time}</strong>
          <b>{ticketOpen ? "−" : "+"}</b>
        </button>
        {ticketOpen && (
          <div className={styles.ticketDetails}>
            <div><span>Correct entrance</span><strong>{ticket.entrance}</strong></div>
            <div><span>Arrival margin</span><strong>{ticket.marginMinutes} min</strong></div>
            <p>{ticket.protected ? "Protected. NOW will remove optional stops before risking this entry." : "The itinerary is paused while Guardian is active."}</p>
            <small>Prepared calculation · live providers not connected yet</small>
          </div>
        )}
      </section>

      <section className={styles.needs}>
        <div className={styles.sectionTitle}>
          <span>WHAT CHANGED?</span>
          <button onClick={() => setActive("route")}>Reset route</button>
        </div>
        <div className={styles.needRail}>
          {needs.map((need) => (
            <button key={need.id} className={active === need.id ? styles.activeNeed : ""} onClick={() => setActive(need.id)}>
              <span>{need.icon}</span>{need.label}
            </button>
          ))}
        </div>
      </section>

      {active === "guardian" && (
        <section className={styles.guardianPanel} aria-live="polite">
          <div className={styles.guardianHeading}>
            <span>NOW GUARDIAN · HOW CAN WE HELP?</span>
            <h2>You are not on your own.</h2>
            <p>Choose the situation. Your route stays paused while you decide.</p>
          </div>

          <div className={styles.guardianLevels}>
            {([
              ["checkin", "Just checking in", "No urgent problem"],
              ["assistance", "I need assistance", "Lost, tired or need a safe return"],
              ["medical", "I feel unwell", "Medical attention may be needed"],
              ["emergency", "Immediate danger", "Call official emergency services"],
            ] as const).map(([level, label, detail]) => (
              <button
                key={level}
                className={guardianLevel === level ? styles.guardianSelected : ""}
                onClick={() => setGuardianLevel(level)}
              >
                <strong>{label}</strong>
                <span>{detail}</span>
              </button>
            ))}
          </div>

          {(guardianLevel === "medical" || guardianLevel === "emergency") && (
            <div className={styles.emergencyServices}>
              <span>OFFICIAL EMERGENCY SERVICES</span>
              {(guardianAssessment?.officialServices ?? []).map((service) => (
                <a key={service.number} href={`tel:${service.number}`}>
                  <strong>{service.label}</strong>
                  <span>{service.purpose}</span>
                  <b>{service.number}</b>
                </a>
              ))}
            </div>
          )}

          <div className={styles.hotelContact}>
            <span>HOTEL CONTACT · EXPLICIT PERMISSION REQUIRED</span>
            <label>
              <input type="checkbox" checked={hotelConsent} onChange={(event) => setHotelConsent(event.target.checked)} />
              I authorize NOW to prepare a message for my hotel.
            </label>
            {hotelConsent && guardianAssessment?.hotelContact.messagePreview && (
              <blockquote>{guardianAssessment.hotelContact.messagePreview}</blockquote>
            )}
            <p>{hotelConsent ? "Preview only. Hotel delivery is not connected yet." : "No hotel is contacted and no location is shared without permission."}</p>
          </div>

          <small>Guardian does not replace emergency services, medical advice or professional care.</small>
        </section>
      )}

      <section className={styles.routeCard} aria-live="polite">
        <div className={styles.routeIntro}>
          <span>{route.eyebrow}</span>
          <h2>{rebuilding ? "Rebuilding around this moment…" : route.title}</h2>
          <p>{rebuilding ? "Checking time, walking effort, access and your next obligation." : route.meta}</p>
        </div>

        <div className={styles.routeImages}>
          <figure>
            <Image src="/images/paris-covered-passage.webp" alt="Galerie Vivienne starting area" fill sizes="45vw" />
            <figcaption><span>STARTING POINT</span>{route.stops[0].title}</figcaption>
          </figure>
          <span>→</span>
          <figure>
            <Image src="/images/paris-haussmann-evening.webp" alt="Louvre and Opera destination area" fill sizes="45vw" />
            <figcaption><span>FINAL DESTINATION</span>{route.stops.at(-1)?.title}</figcaption>
          </figure>
        </div>

        <div className={styles.timeline}>
          {route.stops.map((stop, index) => (
            <article key={`${active}-${stop.title}`} className={stop.state === "warning" ? styles.warningStop : ""}>
              <div className={styles.when}><b>{stop.time}</b><span>{stop.duration}</span></div>
              <div className={styles.marker}><i className={index === route.stops.length - 1 ? styles.destinationMarker : index === 0 ? styles.currentMarker : ""} /></div>
              <div className={styles.stopText}><h3>{stop.title}</h3><p>{stop.detail}</p></div>
            </article>
          ))}
        </div>

        <aside className={styles.why}>
          <span>WHY NOW CHOSE THIS</span>
          <p>{route.note}</p>
        </aside>
      </section>

      <nav className={styles.bottomNav} aria-label="Paris NOW app navigation">
        <button className={active !== "guardian" ? styles.navActive : ""} onClick={() => setActive("route")}><span>◆</span>NOW</button>
        <button onClick={() => setActive("route")}><span>⌁</span>My day</button>
        <button className={ticketOpen ? styles.navActive : ""} onClick={() => setTicketOpen((open) => !open)}><span>◇</span>Tickets</button>
        <button className={active === "guardian" ? styles.navActive : ""} onClick={() => setActive("guardian")}><span>✚</span>Guardian</button>
      </nav>
    </main>
  );
}
