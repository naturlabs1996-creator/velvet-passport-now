import { NowRouteNavigator } from "../../../lib/now-route-navigator";

export const metadata = { title: "REAL-01 Paris #5 — Velvet Passport NOW" };

// Read-only editorial snapshot from vp_now_test, 15 October 2026.
// Not a public release. Coordinates for stops 3 and 4 remain under review.
const stops = [
  { id: "VP-PAR-NOW-05-SZ-01", title: "21 rue Louis-le-Grand — Ernest Appert", description: "Grand Hôtel d’Egmont, construit en 1771. Le photographe Ernest Appert travaille au premier étage. Le rez-de-chaussée a changé : levez les yeux vers les étages historiques. Repère : 21 rue Louis-le-Grand. Accès extérieur à revérifier." },
  { id: "VP-PAR-NOW-05-SZ-02", title: "16 rue Louis-le-Grand — Vente de Malmaison, 1819", description: "En mars 1819, Maître Lacoste expose puis vend des objets des collections de Joséphine : antiquités, mobilier, minéraux et même deux momies. Le lien de certains objets ethnographiques avec l’expédition Baudin reste probable, non certain. L’étage exact est inconnu. Accès extérieur à revérifier." },
  { id: "VP-PAR-NOW-05-SZ-03", title: "Opéra — Kommandantur, 25 août 1944", description: "La 11e compagnie du III/RMT attaque ce point allemand. Le half-track La Revanche 39-40 participe au combat ; un drapeau blanc précède la reddition. Le commandement supérieur de von Choltitz se trouvait au Meurice, et non ici. Point d’arrêt précis à valider avant guidage réel." },
  { id: "VP-PAR-NOW-05-SZ-04", title: "Ancien marché aux chevaux — Beaufort et Nemours, 1652", description: "Le 30 juillet 1652, duel collectif de cinq contre cinq : Nemours tire et manque Beaufort ; Beaufort tire avec un pistolet chargé de trois balles et blesse mortellement Nemours. Secteur historique : rue d’Antin / rue Danielle-Casanova / Louis-le-Grand. Le point exact n’est pas établi : ne pas utiliser cette description comme instruction de navigation." },
];

export default function ParisFivePilotPage() {
  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem 4rem", fontFamily: "system-ui", lineHeight: 1.6 }}>
      <p style={{ fontWeight: 700 }}>VELVET PASSPORT NOW · REAL-01 · PILOTE ÉDITORIAL</p>
      <h1>Paris #5 — Opera Back Streets</h1>
      <p>65 minutes visées · Quatre arrêts · Texte historique issu du Master et de Supabase.</p>
      <p style={{ padding: 12, background: "#fff4d6", color: "#513900", borderRadius: 8 }}><strong>Prototype non certifié :</strong> ne pas suivre comme guidage sur le terrain. Accès des quatre arrêts à confirmer ; coordonnées des arrêts 3 et 4 en révision. Le visuel reconstitué du stop 2 est intégré à cette page ; les autres médias historiques, les audios définitifs, le GPS et le téléchargement hors connexion ne sont pas encore intégrés.</p>
      <section aria-label="Visuel historique Malmaison" style={{ margin: "1.5rem 0" }}>
        <h2>Stop 2 · Malmaison, 1819</h2>
        <figure style={{ margin: 0, maxWidth: 360 }}>
          <img src="/pilots/paris-05/malmaison-1819-reconstruction.svg" alt="Restitution typographique contemporaine de la vente Malmaison, 24 mars 1819 ; ce n'est pas un fac-similé du catalogue" style={{ width: "100%", height: "auto" }} />
          <figcaption style={{ fontSize: 13 }}>Restitution typographique contemporaine inspirée du catalogue de 1819, non reproduction de l'original. Aucun imprimeur attribué.</figcaption>
        </figure>
      </section>
      <NowRouteNavigator city="paris" routeId="VP-PAR-NOW-05-real-01" routeTitle="Les rues derrière l’Opéra" stops={stops} />
      <p style={{ marginTop: 30, fontSize: 13 }}>La progression est enregistrée localement sur cet appareil. Les textes sont des extraits de test, non les narrations audiovisuelles finales. Source : Master assemblé du 23 septembre 2026, état Supabase du 15 octobre 2026.</p>
    </main>
  );
}
