# PARIS 05 — TECHNICAL CLOSEOUT / COMMERCIAL HOLD

Date: 2026-10-23  
Route: VP-PAR-05  
Decision: **TECHNICAL BILINGUAL REVIEW BUILD COMPLETE**; **NOT AUTHORIZED FOR COMMERCIAL PUBLICATION**.

## Verified builds
- FR captioned private video: GitHub Actions run 39971437794 / artifact 12509346897 (success).
- EN captioned private video: GitHub Actions run 39971437794 / artifact 12509407040 (success).
- Both MP4s contain selectable mov_text subtitle track, copied video/audio streams; original audio masters have not been overwritten.
- Subtitle source job run 39960369921, artifacts 12504752777 (FR) and 12505757867 (EN).
- Image research locked at docs/production/PARIS05-IMAGE-SEARCH-LOCK-2026-10-23.md; reopening prohibited without material new evidence.
- Publication gate: scripts/production/paris05_release_gate.py; evidence template docs/production/paris05-commercial-release-evidence.json (all checks currently FALSE).

## Remaining real release blockers — do not disguise as technical failure
1. Confirm that retained historical images have valid commercial-use licensing and contextual/identity accuracy; remove or editorially replace any that do not. 18 source candidates remain REVIEW ONLY; four Paris Musées images excluded.
2. Actually implement the approved documentary fallbacks within a distribution master; current private films intentionally show review placeholders and should **not** be represented as final consumer releases.
3. Proofread FR and EN automatically generated subtitles, especially names and dated events. Generated SRT/VTT are review drafts.
4. Human full-film listening and image/audio sync QA FR/EN; EN visual timing is provisional in review build.
5. Document commercial permissions for both voice models, particularly the EN reference voice.
6. Explicit publisher release approval.

The commercial publication gate remains CLOSED. The technical phase should not be repeated. Next action is not archival exploration; it is fulfillment/verification of the above 6 blockers and creation of rights-cleared final masters. No public deployment authorized by this document.


## Actualisation — montage historique enrichi (23 octobre 2026)

La version purement graphique ne remplace pas le film historique. Nouveaux masters de contrôle **avec archives** :
- **FR** : run `40025579787`, artifact `12532158154`.
- **EN** : run `40025579787`, artifact `12532527156`.
- **Contenu de chaque film** : 38 plans, dont 19 apparitions d'archives documentées et 19 substitutions graphiques assumées ; aucune image en attente affichée comme une archive authentique.
- **Inspection automatique indépendante FR/EN** : run `40025724428` — succès pour les deux versions.
- **Métadonnées** : source, licence déclarée, empreinte SHA-256 contrôlée par image effectivement employée ; certaines notices Wikimedia indiquent « domaine public » sur la fiche sans URL de licence distincte. Cela ne remplace pas la validation humaine/juridique.
- **Prudence** : image générique `PARIS-1944` conservée hors montage faute de confirmation indépendante suffisante du statut de l'auteur.
- **EN** : timing interne des images reste proportionnel aux chapitres, non synchronisé à la phrase par reconnaissance vocale anglaise.
- **Commercial** : aucun feu vert automatique ; le fichier `paris05-commercial-release-evidence.json` conserve ses autorisations manquantes et reste opposable.

La prochaine QA porte sur l'écoute intégrale, les sous-titres (noms propres, dates), le calage EN, la validité des droits pour chaque image effectivement retenue et les voix.


## RECTIFICATIF CRITIQUE — REJET DES FILMS, LE 23 OCTOBRE 2026

**Verdict du visionnement par le commanditaire : REJET TOTAL, Y COMPRIS EN TANT QUE DÉMO.**

La détection de pistes MP4, la vérification des empreintes de fichiers et des durées ne constituent **pas** une inspection éditoriale ou un contrôle de synchronisation. Les mentions antérieures `READY_FOR_HUMAN_LISTENING_REVIEW` sont insuffisantes et ne doivent plus être présentées comme une approbation de la qualité visuelle.

Défauts observés et rapportés : (1) image statique prolongée pendant la narration d'ouverture ; (2) carte de Turgot 1739 hors du contexte narré en ouverture/transition ; (3) absence au moment attendu d'une photographie explicitement décrite d'Ernest Appert ; (4) chapitre Laïd Sebaï sans photographie ; (5) images globalement hors sujet / non synchronisées.

**Cause démontrée dans le code** : `scripts/production/build_paris05_fr_image_edl.py` attribuait d'office `TURGOT-LOUIS-1739` à la première image de `INTRO` et un `None` au cue `STOP-01` index 8 (« neuf personnalités politiques »). Le script `paris05_curated_historical_render.py` construit seulement 38 images pour environ 61/62 minutes, remplaçant 19 par des cartons génériques ; l'anglais dérive ses temps d'un ratio FR/EN sans contrôle mot-à-mot.

Le visuel EXACT des neuf personnalités, **Rijksmuseum RP-F-2007-161**, était documenté dans la shotlist mais non téléchargé ; rattrapage : fichier effectivement récupéré dans l'artifact `12535889502`, workflow `40034625984`, **non encore intégré dans un film corrigé**. Référence : https://id.rijksmuseum.nl/200489498. Une seconde requête Rijksmuseum `200332472` avait donné 404 et a été écartée ; le montage Appert/Roquette déjà ingéré reste distinct.

**État opérationnel** : films des runs `40025579787` et lots d'écoute `40027134815` **rejetés sur le plan éditorial et visuel**, malgré leur intégrité technique. Interdiction de les présenter comme films prêts, démonstrations ou showroom. L'audio vocal reçoit un avis favorable du commanditaire et doit être conservé.

Une nouvelle porte qualité `scripts/production/paris05_editorial_quality_gate.py` vérifie des défauts objectifs : intro hors sujet, montage neuf Appert absent, stop Sebaï visuellement vide, volume de plans dramatiquement insuffisant, plans figés et calage EN fictif. Corriger les sources et établir une correspondance **texte prononcé → image exacte → temps réel** AVANT tout nouveau rendu de démo. Aucun feu vert commercial ou artistique n'est acquis.
