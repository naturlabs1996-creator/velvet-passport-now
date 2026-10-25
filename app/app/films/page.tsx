import Link from "next/link";
import { getPassAccess } from "../../../lib/pass-access";
import { getNowFilm } from "../../../lib/now-films";
import FilmPlayer from "./FilmPlayer";
import styles from "./films.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Films historiques | Velvet Passport NOW", robots: { index: false, follow: false } };

export default async function NowFilmsPage() {
  const access = await getPassAccess();
  const film = getNowFilm("VP-PAR-05");
  if (!access.allowed) return (
    <main className={styles.shell}>
      <Link href="/app" className={styles.back}>← Retour à NOW</Link>
      <h1>Velvet Passport · Films</h1>
      <p>Un accès NOW actif est nécessaire pour visionner les parcours.</p>
    </main>
  );
  if (!film) return null;
  return (
    <main className={styles.shell}>
      <Link href="/app" className={styles.back}>← NOW</Link>
      <div className={styles.kicker}>VELVET PASSPORT NOW · PARIS 05</div>
      <h1>Les coulisses de l’Opéra</h1>
      <p className={styles.subtitle}>Cinq histoires, une promenade. Un film documentaire bilingue, chapitre par chapitre.</p>
      {film.ready && film.media.fr && film.media.en && film.subtitles.fr && film.subtitles.en ? (
        <FilmPlayer
          chapters={film.chapters}
          media={{ fr: film.media.fr, en: film.media.en }}
          subtitles={{ fr: film.subtitles.fr, en: film.subtitles.en }}
        />
      ) : (
        <section className={styles.hold} aria-live="polite">
          <h2>Film en production</h2>
          <p>Les onze chapitres et leurs narrations française et anglaise sont structurés. Le film ne sera accessible qu'après validation du montage, des sous-titres et des droits des images et des voix.</p>
          {access.state === "preview" && <p className={styles.internal}>PRÉVISUALISATION INTERNE · Aucun média incomplet n'est diffusé aux voyageurs.</p>}
          <Link href="/app" className={styles.back}>Retour au parcours NOW</Link>
        </section>
      )}
    </main>
  );
}
