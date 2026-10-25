# VELVET PASSPORT — PARIS 05 — reprise rapide de production — 25 octobre 2026

**Constat : 66 parcours prévus, zéro film intégral livré/QA.** Priorité absolue : finir Paris 05 avant d'étendre la méthode aux 65 autres. Interruption des enquêtes périphériques d'architecture et des démos de 40 s.

## Ce qui a été produit réellement
1. **INTRO FR monté (120,920 secondes) :** `VELVET_PARIS05_INTRO_FR_MONTAGE_2MIN_2026-10-25.mp4`, **11 plans** issus d'archives existantes, voix PCM 24-bit FR originale sans réenregistrement, fondus vidéo doux, 1920×1080 25 ips, H.264/AAC.
   - SHA-256 `6b50326d560e85668ce5bf33b05770a7b34d9622db96ac3208c8b9d20881f568`, 31 642 771 octets.
   - QA ffmpeg : décodage complet sans erreur, durée audio/vidéo vérifiée.
   - **NON APPROUVÉ** : image↔parole minutée à l'écoute, droits commerciaux, sens des images; certaines cartes textuelles relèvent du graphisme éditorial, non d'archives.
2. **Projet de montage Kdenlive FR INTRO+APPERT 10:00,96**, `VELVET_PARIS05_KDENLIVE_TIMELINE_FR_10MIN_AVEC_SOURCES_2026-10-25.zip`, 59 932 549 octets, SHA-256 `e8e4da19926c158e9ea903a598fec35116f690611aa51b2c55c34683982a1b4b`.
   - Timeline XML `.kdenlive` / 14 sources éditables, 11 clips d'introduction individuels, **WAV originaux FR INTRO 2:00,92 et STOP-01 8:00,04** sur pistes indépendantes.
   - Appert V2 (40,32 s), véritable photomontage exact Rijksmuseum RP-F-2007-161, positionné vers 5 min 26,88 sur la timeline FR (repère ASR, **à confirmer**).
   - **439,72 secondes de lacunes vidéo visibles sur la timeline**, non maquillées, car les autres visuels/cues/rights ne sont pas prêts. La piste sonore continue; ne jamais publier cette timeline comme film.
   - ZIP CRC validé, XML parsé sans erreur et 14 chaînes médias présentes. **OUVERTURE DANS L'APPLICATION KDENLIVE NON TESTÉE** faute de logiciel MLT/Kdenlive installé dans l'environnement.
3. **Sauvegarde Drive indépendante confirmée par retéléchargement et hash exact**, dans https://drive.google.com/drive/folders/1UjDt8EGMjTq6byewythwTl8GmmnMMPv7 :
   - MP4 unique.
   - ZIP 60 Mo scindé sans altération en `...zip.part001` et `...zip.part002`, manifeste `BACKUP_MANIFEST.json`; 2 parties relues et reconstituées avec empreinte ZIP identique.
   - **Ces copies ne sont pas des reçus d'ingestion Mastodon**.
4. Film complet Paris 05 : **NON LIVRÉ**, aucun arrêt intégral approuvé, audio EN techniquement récupéré mais version EN de ce bloc **non montée**.

## Instructions sans détour
- Livrer des **segments complets**, pas des démonstrations isolées à répétition.
- Visuels exacts et droits/contrôles sérieusement tenus. Pas de faux portraits, ni de carte Turgot 1739 hors propos.
- Nettoyer les trous visuels dans la timeline de 10 minutes à partir des **images Appert pertinentes réellement disponibles**, sans donner l'illusion qu'un master long est prêt; caler à l'écoute en FR.
- Corriger les défauts à l'échelle du film : image entière, aucun haut de tête coupé, fondus veloutés, voix FR originale.
- Ensuite EN séparément synchronisé puis stop Sebaï → Joséphine → 1944 → duel.
- **Mastodon SQL indisponible**, donc catalogage physique non certifié, publication bloquée.

## Verdict opératoire
`INTRO_FR_WORKPRINT_RENDERED_120S` / `KDENLIVE_10MIN_AUDIO_TIMELINE_BUILT_XML_ONLY` / `DRIVE_READBACK_PASS` / `VIDEO_QA_PENDING` / `FILM_COMPLETE_FALSE`.
