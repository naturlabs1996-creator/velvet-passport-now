import { NowRouteNavigator } from "../../lib/now-route-navigator";

export const metadata = { title: "Test interruption — Velvet Passport NOW" };

const stops = [
  { id: "test-01", title: "Arrêt de test 1", description: "Début du parcours de vérification." },
  { id: "test-02", title: "Arrêt de test 2", description: "Passez à l’arrêt suivant pour enregistrer votre progression." },
  { id: "test-03", title: "Arrêt de test 3", description: "Fermez entièrement l’onglet, puis revenez sur cette même adresse." },
  { id: "test-04", title: "Arrêt de test 4", description: "Vérifiez que le retour à l’arrêt précédent fonctionne." },
  { id: "test-05", title: "Arrêt de test 5", description: "Terminez la visite pour effacer la sauvegarde." },
];

export default function InterruptionTestPage() {
  return (
    <main style={{ maxWidth: 680, margin: "3rem auto", padding: "0 1rem", fontFamily: "system-ui" }}>
      <p style={{ fontWeight: 700 }}>VELVET PASSPORT NOW · LABORATOIRE</p>
      <h1>Test : téléphone interrompu</h1>
      <p>Page de test uniquement : aucun itinéraire historique, aucun paiement, aucun GPS.</p>
      <ol>
        <li>Avancez jusqu’à l’arrêt 3.</li>
        <li>Fermez cet onglet ou quittez le navigateur.</li>
        <li>Ouvrez à nouveau cette même adresse dans le même navigateur.</li>
        <li>La visite doit reprendre à l’arrêt 3, avec un message de récupération.</li>
        <li>Terminez le parcours, puis rechargez : la visite doit repartir à l’arrêt 1.</li>
      </ol>
      <NowRouteNavigator city="quebec" routeId="interruption-lab-v1" routeTitle="Parcours laboratoire — 5 arrêts" stops={stops} />
      <p style={{ marginTop: 32, fontSize: 13 }}>La progression est enregistrée localement sur cet appareil. Elle ne se synchronise pas entre appareils et peut être effacée par le navigateur.</p>
    </main>
  );
}
