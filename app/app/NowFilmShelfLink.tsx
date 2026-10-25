"use client";
import { useEffect, useState } from "react";
import styles from "./page.module.css";

export default function NowFilmShelfLink({ preview }: { preview: boolean }) {
  const [published, setPublished] = useState(false);
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    fetch("/api/now/films/VP-PAR-05", { cache: "no-store", signal: controller.signal })
      .then((response) => { if (mounted) setPublished(response.ok); })
      .catch(() => { if (mounted) setPublished(false); });
    return () => { mounted = false; controller.abort(); };
  }, []);
  if (!preview && !published) return null;
  return <a href="/app/films" className={styles.cinemaLink}>
    <span className={styles.cinemaIcon} aria-hidden="true">▣</span>
    <span><strong>VELVET CINÉMA · PARIS 05</strong><small>{published ? "Watch the bilingual historical journey →" : "INTERNAL PREVIEW · FILM IN PRODUCTION"}</small></span>
    <b aria-hidden="true">→</b>
  </a>;
}
