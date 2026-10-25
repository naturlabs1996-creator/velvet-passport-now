"use client";

import { useRef, useState } from "react";
import type { FilmChapter, FilmLanguage } from "../../../lib/now-films";
import styles from "./films.module.css";

export default function FilmPlayer({
  chapters, media, subtitles,
}: {
  chapters: FilmChapter[];
  media: Record<FilmLanguage, string>;
  subtitles: Record<FilmLanguage, string>;
}) {
  const [language, setLanguage] = useState<FilmLanguage>("fr");
  const [selected, setSelected] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const pendingSeek = useRef<number | null>(null);

  function changeLanguage(next: FilmLanguage) {
    if (next === language) return;
    const time = video.current?.currentTime ?? 0;
    const currentIndex = Math.max(0, chapters.findIndex((c) => time >= c[language].startSeconds && time < c[language].endSeconds));
    const chapter = chapters[currentIndex] ?? chapters[0];
    const elapsed = Math.max(0, time - chapter[language].startSeconds);
    pendingSeek.current = chapter[next].startSeconds + Math.min(elapsed, Math.max(0, chapter[next].durationSeconds - 0.1));
    setLanguage(next);
    setSelected(currentIndex);
  }

  function jump(index: number) {
    const chapter = chapters[index];
    if (!chapter) return;
    pendingSeek.current = null;
    if (video.current) video.current.currentTime = chapter[language].startSeconds;
    setSelected(index);
  }

  function loaded() {
    if (pendingSeek.current !== null && video.current) {
      video.current.currentTime = pendingSeek.current;
      pendingSeek.current = null;
    }
  }

  return (
    <section className={styles.player} aria-label="Velvet Passport documentary film">
      <div className={styles.language} aria-label="Narration language">
        <span>{language === "fr" ? "NARRATION" : "NARRATION"}</span>
        <button onClick={() => changeLanguage("fr")} aria-pressed={language === "fr"}>FR</button>
        <button onClick={() => changeLanguage("en")} aria-pressed={language === "en"}>EN</button>
      </div>
      <video
        ref={video}
        key={language}
        src={media[language]}
        controls
        preload="metadata"
        playsInline
        className={styles.video}
        onLoadedMetadata={loaded}
        onTimeUpdate={() => {
          const t = video.current?.currentTime ?? 0;
          const i = chapters.findIndex((chapter) => t >= chapter[language].startSeconds && t < chapter[language].endSeconds);
          if (i >= 0 && i !== selected) setSelected(i);
        }}
      >
        <track kind="subtitles" label="Français" srcLang="fr" src={subtitles.fr} default={language === "fr"}/>
        <track kind="subtitles" label="English" srcLang="en" src={subtitles.en} default={language === "en"}/>
      </video>
      <div className={styles.chapters}>
        <h2>{language === "fr" ? "Chapitres" : "Chapters"}</h2>
        <ol>
          {chapters.map((chapter, index) => {
            const sec = chapter[language].startSeconds;
            const stamp = String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(Math.floor(sec % 60)).padStart(2, "0");
            return <li key={chapter.id}>
              <button className={selected === index ? styles.active : ""} onClick={() => jump(index)} aria-current={selected === index ? "true" : undefined}>
                <span>{stamp}</span><b>{language === "fr" ? chapter.titleFr : chapter.titleEn}</b>
              </button>
            </li>;
          })}
        </ol>
      </div>
    </section>
  );
}
