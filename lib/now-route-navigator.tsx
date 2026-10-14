"use client";

import { useEffect, useState } from "react";
import { clearRouteProgress, loadRouteProgress, saveRouteProgress } from "./now-route-progress";

export type NowNavigationStop = { id: string; title: string; description?: string };
export type NowNavigationProps = {
  city: string;
  routeId: string;
  routeTitle: string;
  stops: NowNavigationStop[];
};

/** Route player without a GPS dependency. Works after an interruption if its content is available. */
export function NowRouteNavigator({ city, routeId, routeTitle, stops }: NowNavigationProps) {
  const [position, setPosition] = useState(0);
  const [restored, setRestored] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const count = stops.length;
  const routeKey = city + ":" + routeId;

  useEffect(() => {
    const saved = loadRouteProgress(city, routeId, count);
    setPosition(saved.ok ? saved.progress.stopIndex : 0);
    setRestored(saved.ok && saved.progress.stopIndex > 0);
    setStorageWarning(!saved.ok && saved.reason === "unavailable");
    setCompleted(false);
    setHydrated(true);
  }, [city, routeId, count]);

  function goTo(index: number) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= count) return;
    setPosition(index);
    setRestored(false);
    if (!saveRouteProgress(city, routeId, index, count).ok) setStorageWarning(true);
  }

  function finish() {
    if (!clearRouteProgress(city, routeId)) setStorageWarning(true);
    setCompleted(true);
  }

  if (count === 0) return <section aria-label="Navigation">Parcours indisponible : aucun arrêt.</section>;
  if (!hydrated) return <section aria-label="Navigation" aria-busy="true">Chargement du parcours…</section>;
  if (completed) return <section aria-label="Navigation"><h2>Parcours terminé</h2><p>{routeTitle}</p></section>;

  const stop = stops[position];
  return (
    <section aria-label="Navigation" data-route-key={routeKey}>
      <h2>{routeTitle}</h2>
      {restored && <p role="status">Votre parcours a été repris au dernier arrêt enregistré.</p>}
      {storageWarning && <p role="alert">La sauvegarde locale est indisponible. Vous pouvez poursuivre la visite, mais votre progression pourrait ne pas être conservée.</p>}
      <p>Arrêt {position + 1} sur {count}</p>
      <article>
        <h3>{stop.title}</h3>
        {stop.description && <p>{stop.description}</p>}
      </article>
      <nav aria-label="Étapes du parcours">
        <button type="button" onClick={() => goTo(position - 1)} disabled={position === 0}>Précédent</button>
        {position + 1 < count
          ? <button type="button" onClick={() => goTo(position + 1)}>Arrêt suivant</button>
          : <button type="button" onClick={finish}>Terminer le parcours</button>}
      </nav>
    </section>
  );
}
