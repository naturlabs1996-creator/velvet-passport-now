# Velvet Passport — chaîne audiovisuelle unique V2

**Standard permanent pour Paris 05, STOP 04, STOP 05 et les 65 autres parcours.** Le cadre est le [gabarit maître V1](VELVET_MASTER_GABARIT_VIDEO_V1.md), chargé techniquement depuis `scripts/production/velvet_gabarit_maitre.py`. Le programme d'exécution est **`scripts/production/velvet_unified_pipeline.py`**. Les anciens assembleurs `build_route.py` (1280x720, 2 images/s) et `velvet_film_factory_fastpath.py` sont **compatibilité/archives seulement** et ne peuvent plus autoriser une livraison Velvet finale.

## Commande unique, trois fonctions

```bash
python scripts/production/velvet_unified_pipeline.py audit --manifest MANIFEST.json --root dossier_medias --out rapport
python scripts/production/velvet_unified_pipeline.py draft-subs --manifest MANIFEST.json --root dossier_medias --language fr --out brouillons
python scripts/production/velvet_unified_pipeline.py render --manifest MANIFEST.json --root dossier_medias --scope S20 --out controle_prive
python scripts/production/velvet_unified_pipeline.py render --manifest MANIFEST.json --root dossier_medias --final --out livraison
```

- **AUDIT** : valide l'identité de chaque original (SHA-256), la présence de voix, l'intégrité des films, les durées, l'absence de doublons, et les conditions bloquantes. Aucune durée, image, phrase, licence ou autorisation n'est inventée.
- **DRAFT-SUBS** : appelle `draft_subtitles.py` / faster-whisper sur les **vrais WAV**, produisant des fichiers `*.draft.srt` ; **jamais** `subtitle_human_verified=true` automatiquement. Si le moteur n'est pas installé, commande en erreur explicite.
- **RENDER** : prépare les clips en parallèle, avec cache SHA partagé, puis assemble les plans dans leur ordre approuvé. Les fondus croisés de l'image **et du son** ne sont appliqués que si le manifeste comporte une transition explicite verrouillée. La voix réelle n'est pas ralentie. L'archive conserve son son original seul quand elle est en mode `archive_original_only`.
- **RENDER --FINAL** : interdit la fabrication si un élément, un droit, un alignement des sous-titres, une lecture audio, un original, un plan ou l'approbation humaine finale manque. Aucun rendu partiel ne peut être déclaré FINAL. Il faut ensuite un contrôle du fichier exporté et un visionnement mobile avant diffusion.

Le mode privé QA peut produire un film de contrôle seulement lorsque ses médias et ses pistes audio existent vraiment. S'il manque les sous-titres d'un extrait parlé, le programme inscrit un avertissement **QA — SOUS-TITRES NON VALIDÉS** au lieu de produire une bande vide ou de prétendre que tout est synchronisé.

## Contrat image et audio unique

- 1920×1080, 25 ips, **zéro crop / zéro stretch / zéro plan d'un MP4 QA rejeté**.
- Paroles audibles : photo / film conservés intégralement dans 1920×860, bande de sous-titres 220 px, police de référence Inter 72 px. Sous-titres uniquement fondés sur les paroles réellement audibles et validés par un humain.
- Plans sans paroles : `contain` dans 1920×1080, sans bande sous-titres vide. Un cadre stable est conservé durant chaque plan.
- Sources 4:3 : marges latérales autorisées, aucune coupe de l'archive. Sources ultra-panoramiques : marges verticales inévitables signalées.
- Source audio voix : fichier WAV et son SHA, décalage (`offset`) et durée contrôlés. Aucune voix de remplacement générée sans choix explicite du moteur et de la référence.
- Source archive : segment original ou fenêtre source avec audio source seul, pas de voix Velvet ajoutée.
- Aucun transfert Mastodon, aucune validation des droits ni publication n'est revendiqué par l'exécution d'une commande.

## Format du manifeste

`schema: "velvet-unified-av/v2"`, `global_video_template: "velvet-master-frame/v1"`, `route_id`, `stop_id`, `scenes[]`, `expected_plan_ids[]`, et indicateurs obligatoires de release.

Chaque plan : `id`, `kind: photo|archive_film`, `source` local relatif, `sha256`, `duration` **mesurée**, `absolute_start` réel après synchronisation, `spoken`, `audio` (mode `voice|archive_original_only|silence`, WAV et SHA si voix), `captions` (texte avec début/fin **sur cet audio**), `subtitle_human_verified`, `rights`, `visual_approved`, `plan_qa_pass`, `timing_verified`. Les transitions sont déclarées `transition_out: {"type":"crossfade", "seconds":1.2, "editorial_lock":true}` uniquement quand validées.

Les fichiers source et voix sont **externes au dépôt public**, à charger depuis l'archive Velvet / Mastodon / Drive authentifiée dans un dossier local. Jamais de liens publics « présumés » équivalents à des fichiers acquis.

## STOP 04 — test physique d'intégration, 12 novembre 2026

- EDL : 24 numéros de scènes, dont S13 supprimée, **23 scènes actives, 30 plans**.
- **12 médias physiquement contrôlés** : 10 photographies originales et 2 clips d'archive de 1944, tous SHA valides ; **18 médias exacts absents** du paquet local, pas nécessairement perdus ailleurs.
- **S20 workprint QA** rendu de zéro depuis la photo originale, la prise 1 Chatterbox native 1,00 (LOCK) et 16 secondes de film de 1944 avec le vrai son : **21,42 secondes, 1920×1080, 25 ips**. La bande affiche explicitement l'absence de sous-titres documentaires vérifiés. **Ne pas considérer cette vidéo QA comme le film final, ni comme une approbation de sa synchronisation complète.**
- Cache : deuxième rendu réutilisant les 2 clips de S20, sans les réencoder. Les temps dépendent du matériel, des sources et des scènes ; aucune promesse de cadence exponentielle n'est établie.
- Tests unitaires de source, SHA, non-recadrage, refus de publication, chemins protégés, fondus A/V et cache : exécutés localement.
- **`--final` STOP 04 : REFUSÉ comme prévu**. Causes restantes : sources manquantes, durées voix/image non validées, sous-titres documentaires non transcrits, droits et QA humaine.

## Gouvernance anti-oubli / 65 parcours

- `AGENTS.md` doit diriger toute nouvelle session ou agent vers **ce script** et ce document avant tout montage.
- CI : `.github/workflows/velvet-unified-pipeline-v2-ci.yml` vérifie les tests du gabarit et de l'assembleur à chaque changement de code/manifeste pertinent ; `velvet-master-contract-ci.yml` reste obligatoire.
- Un seul code central ; chaque parcours ne fournit que ses médias, voix, textes, minutages et decisions LOCK dans un manifeste distinct. Le cache de clips s'appuie sur les SHA et les paramètres exacts, jamais sur les vieux MP4 QA.
- Ce n'est pas encore une ingestion Mastodon/Drive sans intervention, ni un remplacement du contrôle historique et artistique. La performance bout en bout doit être mesurée sur STOP 04 finalisé, puis 2–3 autres parcours avant déploiement en série.
