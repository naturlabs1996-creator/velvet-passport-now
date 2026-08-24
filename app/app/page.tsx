"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import LiveNeedChoices, { type LiveNeedChoice } from "./LiveNeedChoices";
import styles from "./page.module.css";

type Need = "route" | "rain" | "heat" | "cold" | "snow" | "blocked" | "food" | "water" | "restroom" | "energy" | "pharmacy" | "sitdown" | "battery" | "medication" | "glucose" | "transport" | "guardian";
type WeatherScenario = "route" | "rain" | "snow" | "heat" | "cold";
type WeatherState = {
  available: boolean;
  temperature?: number;
  wind?: number;
  precipitation?: number;
  symbol?: string;
  scenario: WeatherScenario;
  source: string;
};

type ConfidentialRouteSummary = { id: string; zone: string; title: string; durationMinutes: number; stopCount: number; ticketProtection: boolean };

type TicketState = {
  venue: string;
  time: string;
  entrance: string;
  marginMinutes: number;
  protected: boolean;
};

type GuardianLevel = "checkin" | "assistance" | "medical" | "emergency";
type AppSection = "now" | "day" | "tickets" | "guardian";
type TransportMode = "metro" | "rer" | "bus" | "tram" | "taxi" | "walk";
type TransportOption = { id: TransportMode; label: string; minutes: number; detail: string; source: "official" | "estimated"; transfers: number | null };
type TransportResult = { origin: string; destination: string; options: TransportOption[]; provider: { connected: boolean; live: boolean; issue: boolean }; disclaimer: string };
type TravelerLocation = { lat: number; lon: number; accuracy: number; capturedAt: number };
type LocationStatus = "idle" | "locating" | "live" | "fallback";

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

type LiveNeedState = {
  scenario: "food" | "pharmacy" | string;
  choices: LiveNeedChoice[];
  selected: LiveNeedChoice;
  selectedStatus?: string;
  manuallySelected?: boolean;
  betterAlternativeSelected?: boolean;
};

type RouteView = {
  eyebrow: string;
  title: string;
  meta: string;
  note: string;
  stops: Stop[];
  ticket?: TicketState;
  liveNeed?: LiveNeedState | null;
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

const LOCATION_AWARE_NEEDS = new Set<Need>(["food", "pharmacy", "water", "restroom"]);
const WEATHER_NEEDS = new Set<Need>(["route", "rain", "heat", "cold", "snow"]);
const LOCATION_FRESH_MS = 2 * 60 * 1000;
const LOCATION_REFRESH_MS = 2 * 60 * 1000;
const LOCATION_MOVE_THRESHOLD_METERS = 120;
const WEATHER_REFRESH_MS = 15 * 60 * 1000;
const ZONE_CENTRES: Record<string, { lat: number; lon: number }> = {
  "Louvre & Opéra": { lat: 48.8662, lon: 2.3371 },
  "Le Marais": { lat: 48.8590, lon: 2.3622 },
  "Saint-Germain-des-Prés": { lat: 48.8534, lon: 2.3333 },
  "Montmartre": { lat: 48.8867, lon: 2.3431 },
  "Quartier latin": { lat: 48.8463, lon: 2.3470 },
  "Bords de Seine": { lat: 48.8550, lon: 2.3480 },
};

function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function weatherLabel(weather: WeatherState | null) {
  if (!weather?.available) return "Weather updating";
  const symbol = weather.symbol ?? "";
  if (/snow/.test(symbol)) return "Snow";
  if (/sleet/.test(symbol)) return "Sleet";
  if (/rain|showers/.test(symbol)) return weather.precipitation && weather.precipitation > 1 ? "Rain" : "Light rain";
  if (/cloud/.test(symbol)) return "Cloudy";
  if (/fair/.test(symbol)) return "Fair";
  if (/clear/.test(symbol)) return "Clear";
  if (weather.scenario === "heat") return "Hot";
  if (weather.scenario === "cold") return "Cold";
  return "Current conditions";
}

function weatherIcon(weather: WeatherState | null) {
  if (!weather?.available) return "◌";
  if (weather.scenario === "snow") return "❅";
  if (weather.scenario === "rain") return "☂";
  if (weather.scenario === "heat") return "☀";
  if (weather.scenario === "cold") return "❄";
  return /cloud/.test(weather.symbol ?? "") ? "☁" : "☀";
}

const needs: { id: Need; label: string; icon: string }[] = [
  { id: "rain", label: "It’s raining", icon: "☂" },
  { id: "heat", label: "It’s too hot", icon: "☀" },
  { id: "cold", label: "It’s too cold", icon: "❄" },
  { id: "snow", label: "It’s snowing", icon: "❅" },
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
  { id: "transport", label: "Find transport", icon: "▰" },
  { id: "guardian", label: "I need help", icon: "✚" },
];

export default function ParisNowApp() {
  const [active, setActive] = useState<Need>("route");
  const [activeSection, setActiveSection] = useState<AppSection>("now");
  const [progress, setProgress] = useState(7);
  const [catalogRoutes, setCatalogRoutes] = useState<ConfidentialRouteSummary[]>([]);
  const [selectedZone, setSelectedZone] = useState("Louvre & Opéra");
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [choiceBusy, setChoiceBusy] = useState(false);
  const [serverRoute, setServerRoute] = useState<RouteView | null>(null);
  const [travelerLocation, setTravelerLocation] = useState<TravelerLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locationRevision, setLocationRevision] = useState(0);
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [autoWeatherScenario, setAutoWeatherScenario] = useState<WeatherScenario>("route");
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
  const [availableMinutes, setAvailableMinutes] = useState(90);
  const [hotelConsent, setHotelConsent] = useState(false);
  const [guardianAssessment, setGuardianAssessment] = useState<GuardianAssessment | null>(null);
  const [transportOrigin, setTransportOrigin] = useState("");
  const [transportMode, setTransportMode] = useState<TransportMode>("metro");
  const [transportResult, setTransportResult] = useState<TransportResult | null>(null);
  const [transportLoading, setTransportLoading] = useState(false);
  const [transportError, setTransportError] = useState("");
  const [transportApplied, setTransportApplied] = useState<TransportMode | null>(null);
  const route = serverRoute ?? emptyRoute;
  const selectedCatalogRoute = catalogRoutes.find((item) => item.id === selectedRouteId) ?? null;

  function routeLocation() {
    return travelerLocation ? { lat: travelerLocation.lat, lon: travelerLocation.lon } : undefined;
  }

  function weatherLocation() {
    return routeLocation() ?? ZONE_CENTRES[selectedZone] ?? ZONE_CENTRES["Louvre & Opéra"];
  }

  function commitTravelerLocation(current: TravelerLocation, recalculateOnMove: boolean) {
    const moved = travelerLocation ? distanceMeters(travelerLocation, current) : Number.POSITIVE_INFINITY;
    setTravelerLocation(current);
    setLocationStatus("live");
    if (recalculateOnMove && moved >= LOCATION_MOVE_THRESHOLD_METERS) {
      setLocationRevision((revision) => revision + 1);
    }
    return moved;
  }

  function requestTravelerLocation(options?: { recalculateOnMove?: boolean; onDone?: () => void; onFallback?: () => void }) {
    if (!navigator.geolocation) {
      setLocationStatus("fallback");
      options?.onFallback?.();
      return;
    }

    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const current: TravelerLocation = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: Date.now(),
        };
        commitTravelerLocation(current, options?.recalculateOnMove ?? false);
        options?.onDone?.();
      },
      () => {
        setLocationStatus(travelerLocation ? "live" : "fallback");
        options?.onFallback?.();
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 },
    );
  }

  function activateNeed(need: Need) {
    if (!LOCATION_AWARE_NEEDS.has(need)) {
      setActive(need);
      return;
    }

    const fresh = travelerLocation && Date.now() - travelerLocation.capturedAt < LOCATION_FRESH_MS;
    if (fresh) {
      setLocationStatus("live");
      setActive(need);
      return;
    }

    requestTravelerLocation({
      recalculateOnMove: true,
      onDone: () => setActive(need),
      onFallback: () => setActive(need),
    });
  }

  async function findTransport(mode: TransportMode = transportMode) {
    if (transportOrigin.trim().length < 3) { setTransportError("Enter your hotel, address or starting station."); return; }
    setTransportLoading(true);
    setTransportError("");
    setTransportApplied(null);
    try {
      const response = await fetch("/api/now/transport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: transportOrigin, destination: selectedCatalogRoute ? selectedCatalogRoute.zone : selectedZone, mode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Transport options unavailable");
      const result = data as TransportResult;
      setTransportResult(result);
      setTransportOrigin(result.origin);
    } catch (error) {
      setTransportError(error instanceof Error ? error.message : "Transport options unavailable");
    } finally { setTransportLoading(false); }
  }

  async function applyTransport(option: TransportOption) {
    if (!transportResult) return;
    setTransportLoading(true);
    setTransportError("");
    try {
      const response = await fetch("/api/now/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: "route",
          ticketTime: ticket.time,
          routeId: selectedRouteId,
          availableMinutes,
          transport: {
            minutes: option.minutes,
            mode: option.id,
            label: option.label,
            origin: transportResult.origin,
            detail: option.detail,
            source: option.source,
          },
        }),
      });
      const plan = await response.json();
      if (!response.ok) throw new Error(plan.error || "Unable to add this connection to your route.");
      setServerRoute(plan as RouteView);
      if (plan.ticket) setTicket(plan.ticket as TicketState);
      setTransportApplied(option.id);
      window.setTimeout(() => document.getElementById("protected-route-heading")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    } catch (error) {
      setTransportError(error instanceof Error ? error.message : "Unable to recalculate your protected route.");
    } finally {
      setTransportLoading(false);
    }
  }

  async function selectLiveNeedChoice(choice: LiveNeedChoice) {
    if (active !== "food" && active !== "pharmacy") return;
    setChoiceBusy(true);
    setRebuilding(true);
    try {
      const response = await fetch("/api/now/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: active,
          ticketTime: ticket.time,
          routeId: selectedRouteId,
          availableMinutes,
          location: routeLocation(),
          selectedPoi: { name: choice.name, lat: choice.lat, lon: choice.lon },
        }),
      });
      const plan = await response.json();
      if (!response.ok) throw new Error(plan.error || "Unable to use this stop.");
      setServerRoute(plan as RouteView);
      if (plan.ticket) setTicket(plan.ticket as TicketState);
      window.setTimeout(() => document.getElementById("protected-route-heading")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch {
      // Keep the current safe route if a selection cannot be revalidated.
    } finally {
      setChoiceBusy(false);
      setRebuilding(false);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) { setTransportError("Location is not available on this device."); return; }
    setTransportLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const current: TravelerLocation = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: Date.now(),
        };
        commitTravelerLocation(current, true);
        setTransportOrigin(position.coords.latitude.toFixed(5) + ", " + position.coords.longitude.toFixed(5));
        setTransportLoading(false);
        setTransportError("");
      },
      () => { setTransportError("Location permission was not granted. Enter an address instead."); setTransportLoading(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 },
    );
  }

  function openSection(section: AppSection) {
    setActiveSection(section);
    if (section === "guardian") {
      setTicketOpen(false);
      setActive("guardian");
      return;
    }
    if (active === "guardian") setActive("route");
    setTicketOpen(section === "tickets");
    const target = section === "day" ? "my-day-section" : section === "tickets" ? "ticket-protection-section" : "now-route-section";
    window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  useEffect(() => {
    fetch("/api/now/pass", { cache: "no-store" })
      .then(async (response) => {
        const status = await response.json();
        setPassStatus(status);
      })
      .catch(() => setPassStatus({ state: "inactive", allowed: false, plan: null, expiresAt: null }));
  }, []);

  useEffect(() => {
    if (!passStatus.allowed) return;
    fetch("/api/now/route", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Catalogue unavailable")))
      .then((data: { routes: ConfidentialRouteSummary[] }) => setCatalogRoutes(data.routes))
      .catch(() => setCatalogRoutes([]));
  }, [passStatus.allowed]);

  useEffect(() => {
    if (!passStatus.allowed) return;
    const controller = new AbortController();
    const loadWeather = async () => {
      const point = weatherLocation();
      try {
        const response = await fetch("/api/now/context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: point.lat, lon: point.lon, radiusMeters: 800 }),
          signal: controller.signal,
        });
        if (!response.ok) return;
        const context = await response.json() as { weather?: WeatherState };
        const nextWeather = context.weather ?? null;
        setWeather(nextWeather);
        const suggested = nextWeather?.available ? nextWeather.scenario : "route";
        setAutoWeatherScenario(suggested);
        setActive((current) => {
          if (current === "route" && suggested !== "route") return suggested;
          if (WEATHER_NEEDS.has(current) && current === autoWeatherScenario && suggested === "route") return "route";
          if (WEATHER_NEEDS.has(current) && current === autoWeatherScenario && suggested !== "route" && suggested !== current) return suggested;
          return current;
        });
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError")) setWeather((current) => current);
      }
    };
    void loadWeather();
    const refresh = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadWeather();
    }, WEATHER_REFRESH_MS);
    return () => {
      controller.abort();
      window.clearInterval(refresh);
    };
  }, [passStatus.allowed, selectedZone, locationRevision, travelerLocation?.lat, travelerLocation?.lon]);

  useEffect(() => {
    if (!LOCATION_AWARE_NEEDS.has(active) || locationStatus !== "live" || !travelerLocation) return;
    const refresh = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - travelerLocation.capturedAt < LOCATION_FRESH_MS) return;
      requestTravelerLocation({ recalculateOnMove: true });
    }, LOCATION_REFRESH_MS);
    return () => window.clearInterval(refresh);
  }, [active, locationStatus, travelerLocation]);

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
      body: JSON.stringify({ scenario: active, ticketTime: "16:30", routeId: selectedRouteId, availableMinutes, location: routeLocation() }),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Route calculation failed");
        return response.json();
      })
      .then((plan) => {
        setServerRoute(plan as RouteView);
        if (plan.ticket) setTicket(plan.ticket as TicketState);
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
  }, [active, selectedRouteId, availableMinutes, locationRevision]);

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
  const selectableLiveNeed = (active === "food" || active === "pharmacy") && route.liveNeed ? route.liveNeed : null;

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
        <div className={styles.contextImage} aria-hidden="true">
          <Image src="/images/paris-covered-passage.webp" alt="" fill sizes="(max-width: 820px) 100vw, 820px" priority />
        </div>
        <div className={styles.contextContent}>
          <span className={styles.kicker}>PARIS · {selectedZone.toUpperCase()}</span>
          <span className={styles.conciergeLabel}>YOUR PRIVATE PARIS CONCIERGE</span>
          <h1>Your afternoon,<br /><em>beautifully protected.</em></h1>
          <p>A quieter Paris, with your Louvre entry safely protected.</p>
        </div>
        <div className={styles.weather}>
          <span className={styles.weatherIcon} aria-hidden="true">{weatherIcon(weather)}</span>
          <b>{weather?.available && typeof weather.temperature === "number" ? `${Math.round(weather.temperature)}°` : "—°"}</b>
          <span>{weatherLabel(weather)}</span>
        </div>
      </section>

      {passStatus.state === "preview" && (
        <div className={styles.previewBanner}>PRIVATE PREVIEW · NO CUSTOMER PASS HAS BEEN ACTIVATED</div>
      )}
      {passStatus.state === "inactive" && (
        <div className={styles.inactiveBanner}>A valid Paris NOW Pass is required to calculate routes.</div>
      )}

      <section className={styles.journeyContext} aria-label="Your current travel context">
        <div><span>YOUR NEIGHBOURHOOD</span><strong>{selectedZone}</strong></div>
        <div><span>{locationStatus === "locating" ? "LOCATING" : locationStatus === "live" ? "LIVE LOCATION" : "TIME AVAILABLE"}</span><strong>{locationStatus === "locating" ? "Finding you…" : locationStatus === "live" ? `GPS · ±${Math.round(travelerLocation?.accuracy ?? 0)} m` : `${availableMinutes} min`}</strong></div>
        <button onClick={() => setAvailableMinutes((minutes) => minutes === 90 ? 60 : minutes === 60 ? 120 : 90)} aria-label="Change available time">Adjust</button>
      </section>

      <section id="now-route-section" className={styles.liveCard}>
        <div className={styles.liveTop}>
          <span><i className={active === "blocked" || active === "guardian" ? styles.alertDot : styles.liveDot} />{status}</span>
          <span>{locationStatus === "live" ? "GPS LIVE" : locationStatus === "fallback" && LOCATION_AWARE_NEEDS.has(active) ? "ROUTE ANCHOR" : weather?.available ? "MET LIVE" : "LIVE"}</span>
        </div>
        <div className={styles.progressTrack}>
          <span className={active === "blocked" || active === "guardian" ? styles.redProgress : ""} style={{ width: `${progress}%` }} />
        </div>
        <div className={styles.progressLabels}>
          <span>{route.stops[0]?.title ?? "Your starting point"}</span>
          <span>{route.stops[route.stops.length - 1]?.title ?? "Protected arrival"}</span>
        </div>
      </section>

      <section id="ticket-protection-section" className={styles.ticketProtection}>
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
            <div><span>{active === "guardian" ? "Journey status" : "Arrival margin"}</span><strong>{active === "guardian" ? "Journey paused" : `${ticket.marginMinutes} min`}</strong></div>
            <p>{ticket.protected ? "Protected. NOW will remove optional stops before risking this entry." : "The itinerary is paused while Guardian is active."}</p>
            <small>{weather?.available ? `Live weather · ${weather.source}` : "Weather fallback active"}</small>
          </div>
        )}
      </section>

      {activeSection === "day" && (
        <section id="my-day-section" className={styles.myDayPanel} aria-label="Your personal day plan">
          <span className={styles.myDayKicker}>YOUR DAY · PROTECTED BY NOW</span>
          <h2>{selectedCatalogRoute ? selectedCatalogRoute.title : "Your day, beautifully organised."}</h2>
          <p>{selectedCatalogRoute ? `${selectedZone} · ${selectedCatalogRoute.stopCount} confidential stops` : "Choose a neighbourhood and a confidential route below to begin planning your day."}</p>
          <div className={styles.myDayStats}>
            <article><span>TIME AVAILABLE</span><strong>{availableMinutes} min</strong></article>
            <article><span>NEXT RESERVATION</span><strong>{ticket.venue} · {ticket.time}</strong></article>
            <article><span>JOURNEY STATUS</span><strong>{ticket.protected ? "Protected" : "Paused"}</strong></article>
          </div>
          {selectedCatalogRoute && <button onClick={() => openSection("now")}>VIEW MY PROTECTED ROUTE →</button>}
        </section>
      )}

      {catalogRoutes.length > 0 && (
        <section className={styles.confidentialCatalog} aria-label="Your confidential Paris routes">
          <div className={styles.catalogHeading}><span>YOUR CONFIDENTIAL PARIS</span><h2>Choose your neighbourhood.</h2><p>Thirty discreet routes, each with a protected alternative.</p></div>
          <div className={styles.zoneRail}>
            {Array.from(new Set(catalogRoutes.map((item) => item.zone))).map((zone) => (
              <button key={zone} className={selectedZone === zone ? styles.selectedZone : ""} onClick={() => { setSelectedZone(zone); setSelectedRouteId(null); setActive("route"); }}>{zone}</button>
            ))}
          </div>
          <div className={styles.routeList}>
            {catalogRoutes.filter((item) => item.zone === selectedZone).map((item) => (
              <button key={item.id} className={selectedRouteId === item.id ? styles.selectedRoute : ""} onClick={() => { setSelectedRouteId(item.id); setActive("route"); }}>
                <strong>{item.title}</strong><span>{item.durationMinutes} min · {item.stopCount} confidential stops</span><b>{selectedRouteId === item.id ? "SELECTED ✓" : "EXPLORE →"}</b>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className={styles.quickAccess} aria-label="Immediate travel needs">
        <div className={styles.quickHeading}><span>YOUR CONCIERGE, RIGHT NOW</span><h2>What do you need?</h2></div>
        <div className={styles.quickGrid}>
          <button onClick={() => activateNeed("food")}><span>◈</span><strong>Find a table</strong><small>Places worth your time</small></button>
          <button onClick={() => activateNeed("water")}><span>◉</span><strong>Water nearby</strong><small>A stop on your way</small></button>
          <button onClick={() => activateNeed("restroom")}><span>◇</span><strong>Restroom</strong><small>Practical, close access</small></button>
          <button onClick={() => openSection("guardian")}><span>✚</span><strong>Need help?</strong><small>Guardian is here</small></button>
        </div>
      </section>

      <section className={styles.needs}>
        <div className={styles.sectionTitle}>
          <span>ADAPT YOUR DAY</span>
          <button onClick={() => setActive("route")}>Reset route</button>
        </div>
        <div className={styles.needRail}>
          {needs.map((need) => (
            <button key={need.id} className={active === need.id ? styles.activeNeed : ""} onClick={() => activateNeed(need.id)}>
              <span>{need.icon}</span>{need.label}
            </button>
          ))}
        </div>
      </section>

      {selectableLiveNeed && (
        <LiveNeedChoices
          kind={active as "food" | "pharmacy"}
          choices={selectableLiveNeed.choices}
          selected={selectableLiveNeed.selected}
          busy={choiceBusy || rebuilding}
          onSelect={selectLiveNeedChoice}
        />
      )}

      {active === "transport" && (
        <section className={styles.transportPanel} aria-live="polite">
          <div className={styles.transportHeading}>
            <span>NOW CONNECTION · YOUR WAY THERE</span>
            <h2>Start where you actually are.</h2>
            <p>Your hotel, current location or any Paris address — connected to {selectedCatalogRoute?.title ?? selectedZone}.</p>
          </div>
          <label className={styles.transportLabel} htmlFor="transport-origin">YOUR STARTING POINT</label>
          <div className={styles.transportOrigin}>
            <input id="transport-origin" value={transportOrigin} onChange={(event) => { setTransportOrigin(event.target.value); setTransportError(""); }} placeholder="Hotel, address or station" autoComplete="street-address" />
            <button type="button" onClick={useCurrentLocation} aria-label="Use my current location">⌖</button>
          </div>
          <span className={styles.transportLabel}>PREFERRED CONNECTION</span>
          <div className={styles.transportModes}>
            {([["metro", "Métro"], ["rer", "RER"], ["bus", "Bus"], ["tram", "Tram"], ["taxi", "Taxi"], ["walk", "Walk"]] as const).map(([id, label]) => (
              <button key={id} type="button" className={transportMode === id ? styles.transportModeActive : ""} onClick={() => { setTransportMode(id); setTransportApplied(null); }}>{label}</button>
            ))}
          </div>
          <button className={styles.transportSearch} type="button" onClick={() => findTransport()} disabled={transportLoading}>
            {transportLoading ? "CHECKING YOUR CONNECTION…" : "FIND MY BEST CONNECTION →"}
          </button>
          {transportError && <p className={styles.transportError}>{transportError}</p>}
          {transportResult && (
            <div className={styles.transportResults}>
              <div className={styles.transportResultHeading}><strong>{transportResult.origin} → {transportResult.destination}</strong><span>{transportResult.provider.live ? "OFFICIAL DATA" : "ESTIMATED TIMES"}</span></div>
              {transportResult.options.map((option) => (
                <button key={option.id} type="button" className={transportApplied === option.id ? styles.transportOptionApplied : transportMode === option.id ? styles.transportOptionPreferred : ""} onClick={() => applyTransport(option)}>
                  <span><strong>{option.label}</strong><small>{option.detail}</small></span>
                  <b>{option.minutes} min</b>
                  <em>{transportApplied === option.id ? "ADDED ✓" : "ADD TO ROUTE →"}</em>
                </button>
              ))}
              <small className={styles.transportDisclaimer}>{transportResult.disclaimer}</small>
            </div>
          )}
        </section>
      )}

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

      <div id="protected-route-heading" className={styles.routeHeading}><span>CURATED FOR THIS MOMENT</span><h2>Your protected route</h2></div>

      <section className={styles.routeCard} aria-live="polite">
        <div className={styles.routeIntro}>
          <span>{route.eyebrow}</span>
          <h2>{rebuilding ? "Rebuilding around this moment…" : route.title}</h2>
          <p>{rebuilding ? "Checking time, walking effort, access and your next obligation." : route.meta}</p>
        </div>

        <div className={styles.routeImages}>
          <figure>
            <Image src="/images/paris-covered-passage.webp" alt="Galerie Vivienne starting area" fill sizes="45vw" />
            <figcaption><span>STARTING POINT</span>{route.stops[0]?.title ?? "Starting point"}</figcaption>
          </figure>
          <span>→</span>
          <figure>
            <Image src="/images/paris-haussmann-evening.webp" alt="Louvre and Opera destination area" fill sizes="45vw" />
            <figcaption><span>FINAL DESTINATION</span>{route.stops.at(-1)?.title}</figcaption>
          </figure>
        </div>

        <div className={styles.timeline}>
          {route.stops.map((stop, index) => (
            <article key={`${active}-${stop.title}-${index}`} className={stop.state === "warning" ? styles.warningStop : ""}>
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
        <button className={activeSection === "now" ? styles.navActive : ""} onClick={() => openSection("now")}><span>◆</span>NOW</button>
        <button className={activeSection === "day" ? styles.navActive : ""} onClick={() => openSection("day")}><span>⌁</span>My day</button>
        <button className={activeSection === "tickets" ? styles.navActive : ""} onClick={() => openSection("tickets")}><span>◇</span>Tickets</button>
        <button className={activeSection === "guardian" ? styles.navActive : ""} onClick={() => openSection("guardian")}><span>✚</span>Guardian</button>
      </nav>
    </main>
  );
}
