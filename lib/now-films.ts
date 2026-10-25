import master from "../docs/production/paris05-now-integrated-film-manifest.json";
import releaseEvidence from "../docs/production/paris05-commercial-release-evidence.json";

export type FilmLanguage = "fr" | "en";
export type FilmChapter = {
  id: string;
  titleFr: string;
  titleEn: string;
  fr: { startSeconds: number; endSeconds: number; durationSeconds: number };
  en: { startSeconds: number; endSeconds: number; durationSeconds: number };
  visualQAApproved: boolean;
  rightsQAApproved: boolean;
};

const RELEASE_CHECKS = [
  "fr_audio_listening_approved",
  "en_audio_listening_approved",
  "fr_subtitles_proofread",
  "en_subtitles_proofread",
  "fr_video_qa_approved",
  "en_video_qa_approved",
  "mastodon_assets_physical_receipts_verified",
  "stop_to_asset_image_cues_complete",
  "retained_visuals_identity_and_context_verified",
  "retained_visuals_commercial_rights_verified",
  "all_unlicensed_visuals_replaced",
  "fr_voice_commercial_rights_verified",
  "en_voice_commercial_rights_verified",
  "credits_and_attributions_verified",
  "publisher_explicit_release_approval",
] as const;

function safeMediaUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function getNowFilm(routeId: string) {
  if (routeId !== "VP-PAR-05") return null;
  const evidence = releaseEvidence.evidence as Record<string, { approved?: boolean; reference?: string | null }>;
  const failed = RELEASE_CHECKS.filter((name) => {
    const check = evidence[name];
    return check?.approved !== true || !check.reference?.trim();
  });
  const chapters = master.chapters as FilmChapter[];
  const media = {
    fr: safeMediaUrl(process.env.NOW_FILM_PAR05_FR_URL),
    en: safeMediaUrl(process.env.NOW_FILM_PAR05_EN_URL),
  };
  const subtitles = {
    fr: safeMediaUrl(process.env.NOW_FILM_PAR05_FR_VTT_URL),
    en: safeMediaUrl(process.env.NOW_FILM_PAR05_EN_VTT_URL),
  };
  const approved = Boolean(releaseEvidence.commercial_release_allowed)
    && Boolean(master.releaseApproved)
    && Boolean(master.mediaAssetsApproved)
    && chapters.length === 11
    && chapters.every((chapter) => chapter.visualQAApproved && chapter.rightsQAApproved)
    && failed.length === 0;
  const ready = approved && Boolean(media.fr && media.en && subtitles.fr && subtitles.en);
  return {
    id: master.routeId,
    titleFr: "Les coulisses de l’Opéra",
    titleEn: "Behind the Opéra",
    state: ready ? "PUBLISHED" as const : "PRODUCTION_HOLD" as const,
    ready,
    chapters,
    durationSeconds: { fr: master.media.fr.durationSeconds, en: master.media.en.durationSeconds },
    // Never expose unreviewed media locations, even when configured.
    media: ready ? media : { fr: null, en: null },
    subtitles: ready ? subtitles : { fr: null, en: null },
    // Technical operators may inspect their local release evidence; never leak individual
    // failures or private URLs to NOW consumers.
  };
}
