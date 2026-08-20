"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type Need = "route" | "rain" | "blocked" | "food" | "water" | "restroom" | "energy" | "guardian";

type Stop = {
  time: string;
  duration: string;
  title: string;
  detail: string;
  state?: "current" | "next" | "done" | "warning" | "destination";
};

const routes: Record<Need, { eyebrow: string; title: string; meta: string; note: string; stops: Stop[] }> = {
  route: {
    eyebrow: "VELVET ROUTE · LOUVRE & OPÉRA",
    title: "A quieter Paris before your Louvre entry.",
    meta: "62 min · 1.1 km · arrival margin 24 min",
    note: "NOW works backward from your 16:30 Louvre ticket and keeps the last 24 minutes protected.",
    stops: [
      { time: "NOW", duration: "14 min", title: "Galerie Vivienne", detail: "Enter by rue Vivienne · covered", state: "current" },
      { time: "+18", duration: "16 min", title: "Palais-Royal courtyard", detail: "Quiet crossing · Velvet Pick", state: "next" },
      { time: "+42", duration: "12 min", title: "Carrousel entrance", detail: "Correct entrance · crowd-aware", state: "next" },
      { time: "16:06", duration: "24 min", title: "Protected arrival window", detail: "Louvre ticket 16:30 · no rush", state: "destination" },
    ],
  },
  rain: {
    eyebrow: "WEATHER ADAPTATION",
    title: "Rain changed the route—not the day.",
    meta: "58 min · 82% sheltered · arrival margin 27 min",
    note: "Covered passages replace exposed crossings. Your Louvre obligation remains protected.",
    stops: [
      { time: "NOW", duration: "17 min", title: "Passage des Panoramas", detail: "Covered · warm reset", state: "current" },
      { time: "+21", duration: "15 min", title: "Galerie Vivienne", detail: "Indoor route · 3 min exposed", state: "next" },
      { time: "+44", duration: "11 min", title: "Carrousel entrance", detail: "Underground approach", state: "next" },
      { time: "16:03", duration: "27 min", title: "Protected arrival window", detail: "Ticket remains safe", state: "destination" },
    ],
  },
  blocked: {
    eyebrow: "LIVE ROUTE PROTECTION",
    title: "Rue Saint-Honoré is blocked. Rebuilding calmly.",
    meta: "66 min · +6 min · arrival margin 18 min",
    note: "The unsafe segment is removed. NOW reroutes through Palais-Royal without sacrificing the ticket.",
    stops: [
      { time: "NOW", duration: "2 min", title: "Pause at the safe corner", detail: "Route issue confirmed", state: "warning" },
      { time: "+02", duration: "19 min", title: "Reroute via rue de Valois", detail: "Clear pedestrian access", state: "current" },
      { time: "+29", duration: "14 min", title: "Palais-Royal arcades", detail: "Protected alternative", state: "next" },
      { time: "16:12", duration: "18 min", title: "Protected arrival window", detail: "Louvre ticket 16:30", state: "destination" },
    ],
  },
  food: {
    eyebrow: "HUMAN NEED · FOOD",
    title: "A proper meal that still fits the day.",
    meta: "77 min total · Chez Vong · arrival margin 17 min",
    note: "Selected for rating confidence, walking time and compatibility with your next obligation.",
    stops: [
      { time: "NOW", duration: "11 min", title: "Walk to Chez Vong", detail: "Cantonese · €€€ · 9.1/10", state: "current" },
      { time: "+11", duration: "48 min", title: "Seated meal", detail: "10 rue de la Grande Truanderie", state: "next" },
      { time: "+63", duration: "14 min", title: "Resume protected route", detail: "17 min margin remains", state: "destination" },
    ],
  },
  water: {
    eyebrow: "HUMAN NEED · WATER",
    title: "Water now. No unnecessary detour.",
    meta: "7 min pause · free · route preserved",
    note: "A verified public drinking-water point is inserted in the natural direction of travel.",
    stops: [
      { time: "NOW", duration: "3 min", title: "Walk to drinking-water point", detail: "Verified · public access", state: "current" },
      { time: "+03", duration: "4 min", title: "Refill and reset", detail: "Free · on your route", state: "next" },
      { time: "+07", duration: "12 min", title: "Resume current route", detail: "Destination preserved", state: "destination" },
    ],
  },
  restroom: {
    eyebrow: "HUMAN NEED · RESTROOM",
    title: "The nearest practical restroom—not merely a pin.",
    meta: "13 min stop · indoor · route preserved",
    note: "NOW checks access, opening status and walking direction before adding the stop.",
    stops: [
      { time: "NOW", duration: "5 min", title: "Carrousel du Louvre facilities", detail: "Access route verified", state: "current" },
      { time: "+05", duration: "8 min", title: "Restroom stop", detail: "Indoor · accessible facilities", state: "next" },
      { time: "+13", duration: "12 min", title: "Resume from Carrousel exit", detail: "Original destination preserved", state: "destination" },
    ],
  },
  energy: {
    eyebrow: "NOW CARE · LOW ENERGY",
    title: "Less walking. More of the Paris worth keeping.",
    meta: "49 min · 620 m · seated pause included",
    note: "The route contracts around your energy instead of asking you to push through it.",
    stops: [
      { time: "NOW", duration: "6 min", title: "Quiet seated pause", detail: "Warm café · low noise", state: "current" },
      { time: "+18", duration: "12 min", title: "Short Palais-Royal loop", detail: "Benches · level access", state: "next" },
      { time: "+37", duration: "12 min", title: "Carrousel entrance", detail: "Shortest protected approach", state: "destination" },
    ],
  },
  guardian: {
    eyebrow: "NOW GUARDIAN",
    title: "Your route is paused. Help comes first.",
    meta: "Location ready · official help identified",
    note: "Guardian separates a travel disruption from a true emergency and keeps official services understandable.",
    stops: [
      { time: "NOW", duration: "Paused", title: "Stay where you feel safe", detail: "Paris NOW stops the itinerary", state: "warning" },
      { time: "01", duration: "Ready", title: "Medical emergency — SAMU", detail: "Call 15 · urgent medical help", state: "current" },
      { time: "02", duration: "Ready", title: "European emergency", detail: "Call 112 · police, fire or medical", state: "next" },
      { time: "03", duration: "Optional", title: "Contact your hotel", detail: "Only with your permission", state: "destination" },
    ],
  },
};

const needs: { id: Need; label: string; icon: string }[] = [
  { id: "rain", label: "It’s raining", icon: "☂" },
  { id: "blocked", label: "Street blocked", icon: "⊘" },
  { id: "food", label: "I’m hungry", icon: "⌖" },
  { id: "water", label: "I need water", icon: "◉" },
  { id: "restroom", label: "I need a restroom", icon: "WC" },
  { id: "energy", label: "Low energy", icon: "◌" },
  { id: "guardian", label: "I need help", icon: "✚" },
];

export default function ParisNowApp() {
  const [active, setActive] = useState<Need>("route");
  const [progress, setProgress] = useState(7);
  const [rebuilding, setRebuilding] = useState(false);
  const route = routes[active];

  useEffect(() => {
    setProgress(7);
    setRebuilding(true);
    const rebuild = window.setTimeout(() => setRebuilding(false), 850);
    const timer = window.setInterval(() => {
      setProgress((value) => (value >= 88 ? value : value + 1));
    }, 1400);
    return () => {
      window.clearTimeout(rebuild);
      window.clearInterval(timer);
    };
  }, [active]);

  const status = useMemo(() => active === "blocked" ? "Reroute active" : active === "guardian" ? "Route paused" : "Live route", [active]);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="Return to Paris NOW">
          <span className={styles.rings}><i /><i /></span>
          <span>Paris <b>NOW</b></span>
        </a>
        <div className={styles.pass}>
          <span>72H PASS</span>
          <strong>ACTIVE</strong>
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
        <button className={styles.navActive}><span>◆</span>NOW</button>
        <button><span>⌁</span>My day</button>
        <button><span>◇</span>Tickets</button>
        <button><span>✚</span>Guardian</button>
      </nav>
    </main>
  );
}
