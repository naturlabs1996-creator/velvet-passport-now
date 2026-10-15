"use client";
import { useEffect, useState } from "react";
import { NowRouteNavigator } from "../../lib/now-route-navigator";

const stops = [
  { id: "1", title: "Arrêt 1", description: "Contenu de démonstration hors ligne." },
  { id: "2", title: "Arrêt 2", description: "La visite reste disponible sans réseau après téléchargement." },
  { id: "3", title: "Arrêt 3", description: "Fermez l'onglet, puis rouvrez la même adresse sans Wi-Fi." },
  { id: "4", title: "Arrêt 4", description: "Retour en arrière et sauvegarde locale." },
  { id: "5", title: "Arrêt 5", description: "Terminez le parcours." },
];
export default function OfflineLab() {
  const [message, setMessage] = useState("Préparation non commencée.");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) setMessage("Ce navigateur ne prend pas en charge le mode hors ligne.");
  }, []);
  async function prepare() {
    setReady(false);
    setMessage("Téléchargement en cours…");
    try {
      if (!("serviceWorker" in navigator)) throw Error("Service worker indisponible");
      const registration = await navigator.serviceWorker.register("/test-offline/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      await registration.update();
      if (!registration.active) throw Error("Service worker non actif");
      const response = await fetch("/test-offline", { cache: "reload" });
      if (!response.ok) throw Error("Page non disponible");
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const assetPaths = new Set<string>();
      for (const node of doc.querySelectorAll("script[src], link[rel='stylesheet'][href], link[rel='modulepreload'][href]")) {
        const value = node.getAttribute("src") || node.getAttribute("href");
        if (value) {
          const url = new URL(value, location.origin);
          if (url.origin === location.origin && url.pathname.startsWith("/_next/static/")) assetPaths.add(url.href);
        }
      }
      const cache = await caches.open("vp-offline-lab-v3");
      await cache.put("/test-offline", new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
      for (const asset of assetPaths) {
        const assetResponse = await fetch(asset);
        if (!assetResponse.ok) throw Error("Ressource indisponible");
        await cache.put(asset, assetResponse);
      }
      const verified = await cache.match("/test-offline");
      if (!verified || !(await verified.text()).includes("Velvet Passport")) throw Error("Cache HTML non vérifié");
      if (!registration.active) throw Error("Service worker non actif");
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(Error("Page non contrôlée par le Service Worker")), 5000);
          navigator.serviceWorker.addEventListener("controllerchange", () => { clearTimeout(timer); resolve(); }, { once: true });
        });
      }
      setReady(true);
      setMessage("Cache HTML et ressources vérifiés. Le test de réouverture sans Wi-Fi reste nécessaire.");
    } catch (error) {
      setMessage("Téléchargement incomplet : " + (error instanceof Error ? error.message : "erreur inconnue") + ". Ne coupe pas le Wi-Fi.");
    }
  }
  return <main style={{ maxWidth: 680, margin: "2rem auto", padding: "0 1rem", fontFamily: "system-ui", lineHeight: 1.6 }}>
    <h1>Velvet Passport NOW — laboratoire hors ligne</h1>
    <p>Prototype technique : textes seulement. Pas encore de cartes, images ou audio téléchargés.</p>
    <button type="button" onClick={prepare} style={{ padding: 12 }}>Télécharger le parcours de test</button>
    <p role="status">{message}</p>
    {ready && <p>Test : avance à l’arrêt 3, coupe le Wi-Fi, ferme l’onglet et rouvre exactement cette adresse. La reprise doit afficher l’arrêt 3.</p>}
    <NowRouteNavigator city="quebec" routeId="offline-lab-v1" routeTitle="Parcours hors ligne — 5 arrêts" stops={stops} />
    <p>La disponibilité hors ligne dépend du navigateur et de son stockage. Ce test ne garantit pas encore une application complète hors connexion.</p>
  </main>;
}
