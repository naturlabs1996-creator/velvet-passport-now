"use client";

import { useEffect, useRef, useState } from "react";

type Fix = { accuracy: number; age: number; time: string };
const messages: Record<number, string> = {
  1: "Autorisation refusée. Activez la localisation dans le navigateur.",
  2: "Position indisponible. Essayez à ciel ouvert.",
  3: "Délai dépassé. Réessayez près d’une fenêtre ou dehors.",
};
export default function GpsLabPage() {
  const watch = useRef<number | null>(null);
  const [status, setStatus] = useState("En attente — aucune localisation demandée.");
  const [fix, setFix] = useState<Fix | null>(null);
  const [count, setCount] = useState(0);
  const [online, setOnline] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current);
    };
  }, []);

  function stop() {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    setRunning(false);
    setStatus("Suivi arrêté.");
  }
  function start() {
    if (!("geolocation" in navigator)) {
      setStatus("GPS non disponible dans ce navigateur.");
      return;
    }
    if (watch.current !== null) return;
    setStatus("Recherche du signal GPS… Autorisez la localisation si demandé.");
    setFix(null);
    setCount(0);
    setRunning(true);
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        setFix({ accuracy: Math.round(p.coords.accuracy), age: Date.now() - p.timestamp, time: new Date(p.timestamp).toLocaleTimeString("fr-CA") });
        setCount((n) => n + 1);
        setStatus("Position reçue. Les coordonnées ne sont ni affichées ni enregistrées.");
      },
      (e) => {
        setStatus(messages[e.code] || "Erreur GPS inconnue.");
        if (e.code === 1) stop();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }

  return (
    <main style={{ maxWidth: 680, margin: "2rem auto", padding: "0 1rem", fontFamily: "system-ui", lineHeight: 1.6 }}>
      <p style={{ fontWeight: 700 }}>VELVET PASSPORT NOW · LABORATOIRE</p>
      <h1>Test GPS et changement de réseau</h1>
      <p>Essai technique uniquement. Aucun itinéraire réel, aucun paiement. Aucune coordonnée GPS n’est affichée, transmise ou sauvegardée par cette page.</p>
      <p><strong>Réseau :</strong> {online === null ? "Vérification…" : online ? "Navigateur en ligne" : "Navigateur hors ligne"} (indication du navigateur, pas une preuve d’accès Internet).</p>
      <p><strong>GPS :</strong> {status}</p>
      <p><strong>Suivi :</strong> {running ? "actif" : "inactif"}</p>
      <p><strong>Positions reçues :</strong> {count}</p>
      {fix && <p><strong>Dernière mesure :</strong> {fix.time} · précision annoncée ±{fix.accuracy} m. Cette précision est une estimation, pas une garantie.</p>}
      <button type="button" onClick={start} disabled={running} style={{ padding: 12, marginRight: 12 }}>Démarrer le GPS</button>
      <button type="button" onClick={stop} disabled={!running} style={{ padding: 12 }}>Arrêter le GPS</button>
      <h2>Protocole de test</h2>
      <ol>
        <li>Chez toi, connecté au Wi-Fi, appuie sur « Démarrer le GPS » et autorise la localisation.</li>
        <li>Attends une mesure. Note la précision indiquée.</li>
        <li>Sans fermer cette page, éloigne-toi prudemment du Wi-Fi. Regarde si de nouvelles mesures GPS arrivent.</li>
        <li>Reviens au Wi-Fi et vérifie que les mesures continuent.</li>
        <li>Appuie sur « Arrêter le GPS » en terminant.</li>
      </ol>
      <p><strong>Important :</strong> ne fais pas ce test en conduisant. Le GPS peut être imprécis à l’intérieur; reste à un endroit sûr. Un rechargement complet hors ligne n’est pas encore pris en charge.</p>
    </main>
  );
}
