import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import styles from "./studio.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Production Studio | Velvet Passport NOW", robots: { index: false, follow: false } };
type Segment = { id: string; status: string };
type Language = { audio_master: string; listening_qa_passed: boolean; subtitle_file?: string | null; source_artifact?: { run_id: number; artifact_id: number } };
type RouteManifest = { route_id: string; title: string; segments: Segment[]; languages: { fr: Language; en: Language }; assets: { id: string; rights_status: string; use_in_export?: boolean }[]; rights_signoff: boolean; visual_qa_passed: boolean; release_requested: boolean; exports?: { fr?: string | null; en?: string | null } };
async function readManifest(): Promise<RouteManifest> {
  const file = path.join(process.cwd(), "docs/production/routes/VP-PAR-05.json");
  return JSON.parse(await fs.readFile(file, "utf8")) as RouteManifest;
}
function Status({ done, label }: { done: boolean; label: string }) {
 return <span className={done ? styles.done : styles.pending}>{done ? "✓ " : "○ "}{label}</span>;
}
export default async function StudioPage() {
 const route = await readManifest();
 const cleared = route.assets.filter(a => a.rights_status === "CLEARED_COMMERCIAL").length;
 const holds = route.assets.filter(a => a.rights_status === "RIGHTS_HOLD").length;
 return (
 <main className={styles.main}>
  <div className={styles.top}><div><p className={styles.eyebrow}>VELVET PASSPORT NOW / PRIVATE OPERATIONS</p><h1>Production Studio</h1><p>Production Engine™ · Bilingual audiovisual control</p></div><Link href="/app">← Traveler application</Link></div>
  <section className={styles.intro}><p className={styles.eyebrow}>ACTIVE PILOT</p><h2>{route.route_id} — {route.title}</h2><p>11 locked chapters · two independent language masters · commercial release gated</p><strong className={styles.warning}>NOT PRODUCTION-READY</strong></section>
  <section className={styles.grid} aria-label="Bilingual status">
   {(["fr","en"] as const).map(lang => {const d=route.languages[lang];return <article className={styles.card} key={lang}>
    <h3>{lang === "fr" ? "Français" : "British English"}</h3>
    <Status done={Boolean(d.source_artifact)} label="Master connected to GitHub Actions" />
    <Status done={d.listening_qa_passed} label="Listening QA" />
    <Status done={Boolean(d.subtitle_file)} label="Approved subtitles" />
    <Status done={Boolean(route.exports?.[lang])} label="Final audiovisual export" />
    {d.source_artifact && <a href={`https://github.com/naturlabs1996-creator/velvet-passport-now/actions/runs/${d.source_artifact.run_id}/artifacts/${d.source_artifact.artifact_id}`} target="_blank" rel="noopener noreferrer">Open source audio artifact ↗</a>}
   </article>})}
  </section>
  <section className={styles.card}><h3>Production release gates</h3><div className={styles.checks}>
   <Status done={route.segments.length === 11} label={`${route.segments.length}/11 chapter identifiers`} />
   <Status done={route.rights_signoff} label="Rights sign-off" />
   <Status done={route.visual_qa_passed} label="Historical image and timing QA" />
   <Status done={route.release_requested && Boolean(route.exports?.fr) && Boolean(route.exports?.en)} label="Bilingual publication authorization" />
  </div><p>Assets in manifest: {route.assets.length} · rights cleared for export: {cleared} · rights holds: {holds}. Items under HOLD are excluded.</p></section>
  <section className={styles.card}><h3>Production sequence</h3><ol>{route.segments.map((s,i)=><li key={s.id}><span>{String(i+1).padStart(2,"0")}</span><strong>{s.id}</strong><small>{s.status}</small></li>)}</ol></section>
  <footer>Read-only administrative dashboard · no automated publishing · GitHub is the authoritative job runner</footer>
 </main>);
}
