## CHAÎNE AUDIOVISUELLE UNIQUE V2 — IMPÉRATIF DE FABRICATION (12 NOVEMBRE 2026)

**NOUVEAU POINT D'ENTRÉE TECHNIQUE À UTILISER AVANT TOUT MONTAGE :** [Velvet Unified Pipeline V2](docs/production/VELVET_UNIFIED_PIPELINE_V2.md) et `scripts/production/velvet_unified_pipeline.py`. Le gabarit maître vidéo V1 demeure la référence de cadrage, importée par ce script. Cette règle s'applique à STOP 04, STOP 05, puis à TOUS les 65 autres parcours, même après changement de conversation ou d'agent.

- **Commande pilote :** `python scripts/production/velvet_unified_pipeline.py audit --manifest <manifest> --root <media_root> --out <report_dir>`. Dans le même programme : `draft-subs` sur WAV réel (brouillons NON approuvés) et `render` des plans originaux à 1080p avec cache SHA, voix et archives sonores distinctes, fondus approuvés.
- **Source-first sans exception :** ne jamais prendre les MP4 STOP04 V6/V7 rejetés comme visuels; jamais de crop, sous-titres minutés par estimation, bande vide pendant un commentaire ou son d'archives remplacé. 1920×860 + bande 220 px quand paroles; 1920×1080 sans bande seulement si plan réellement sans paroles.
- **Barrière finale :** refus automatique pour source/SHA/voix/durée/droits/synchronisation/plan/QA/approbation absents. Un MP4 `PRIVATE_QA_NOT_RELEASE` n'est PAS un film final. Aucun téléchargement, classement Mastodon, feu vert juridique ni diffusion publique ne peut être inféré de l'exécution du script.
- **Contrôle obligatoire dans GitHub :** `.github/workflows/velvet-unified-pipeline-v2-ci.yml` et `velvet-master-contract-ci.yml`. Les deux surveillent le code/manifeste et protègent le contrat; **seul l'audit physique des vrais originaux dans leur stockage permet le PASS réel**.
- **STOP04 test réel :** 24 numéros de scènes dont S13 supprimée, 23 actives/30 plans, 12 sources SHA vérifiées, 18 fichiers originaux absents du paquet local; scène S20 QA 21,42 s depuis photo réelle + Chatterbox native100 T1 + archive 16 s au vrai son. Tests logiciels passés; **film final toujours REFUSÉ** tant que les sources restantes et sous-titres/droits/QA ne sont pas vérifiés.

**La production à l'échelle des 65 parcours doit être pilotée par CE programme et non les anciens assembleurs 1280p/2 ips, réservés au maintien de compatibilité.**

---

# VELVET PASSPORT — RÈGLE AUTOMATIQUE DE PRODUCTION (66 PARCOURS)

**Référence permanente pour tous les agents et pour les 65 parcours après Paris 05.** Source de vérité technique : `docs/production/VELVET_MASTER_GABARIT_VIDEO_V1.md`. Un seul code de gabarit partagé, pas 66 copies. Les décisions éditoriales restent propres au MASTER de chaque parcours.

## Entrée obligatoire avant chaque montage

1. Charger ce document, le **gabarit maître** et `AGENTS.md`. Charger le manifeste du parcours et son MASTER de narration/images approuvées.
2. Les images proviennent des **originaux** avec identifiant + SHA-256; aucun ancien MP4 de contrôle n'est accepté comme visuel. Ne jamais inventer une archive ou couper une photo.
3. Mode **parlé** : cadre 1920x860 et bande de sous-titres 1920x220, texte réellement synchronisé avec la voix audible; pas de bande vide pendant un commentaire non transcrit.
4. Mode **sans paroles** : cadre 1920x1080. Ratio source préservé; bandes latérales acceptées pour 4:3, marges verticales seulement si l'original très large l'impose physiquement.
5. Films d'archives : source authentique, durée verrouillée, audio original SEUL s'il s'agit du choix éditorial; pas de narration superposée. Pas de sous-titres calculés au nombre de caractères.
6. Voix : Chatterbox V3 à partir des **WAV approuvés**, sans substitution de voix ni ancien ralentissement numérique. Pour STOP 04, **S20 T1 native 1.00 est LOCK**; les autres prises doivent faire l'objet de QA éditoriale.
7. Export : vérifier **chaque plan** : source, authenticité, droits, SHA, audio, syllabes, sous-titres, ordre narratif, pas de recadrage, pas de bandes réservées inutilement, contrôle mobile. Diffusion impossible sans validation humaine finale.

## Quels outils sont déjà disponibles ?

- `scripts/production/velvet_gabarit_maitre.py` : audit sources, géométrie, aperçu photo/film et filtre 1920x1080.
- `scripts/production/velvet_film_factory_fastpath.py` : assembleur FFmpeg de workprint privé depuis séquences minutées; **son cadre de rendu doit encore être intégré au gabarit récent**, ce n'est pas le moteur final complet.
- `scripts/production/build_route.py` : assembleur bilingue de preuve technique historique; **son ancien cadrage 1280x720 à 2 fps n'est pas conforme**, ne pas l'utiliser directement pour les prochains films sans intégration du nouveau gabarit.
- `scripts/production/velvet_master_contract.py` : vérifie automatiquement que tous les manifests de parcours utilisent le gabarit et bloque les demandes de publication sans preuves.
- `.github/workflows/velvet-master-contract-ci.yml` : exécute ces contrôles lors des modifications du dépôt (routes, production, tests), **sans génération TTS et sans publication**.

## Étapes encore à construire pour une chaîne de production réellement automatique

1. **Raccorder l'assembleur au gabarit maître** et aux pistes audio sources, y compris films originaux de 1944, sous-titres et transitions, sans casser les anciens LOCK.
2. **Importer les médias depuis le registre approuvé** et conserver un cache trans-parcours avec SHA. Aucune récupération d'URL seule ne vaut ingestion du fichier.
3. **Aligner la voix définitive avec les sous-titres** par un outil de transcription/alignement fiable puis contrôle humain sur les erreurs; jamais des durées estimées.
4. **Reconstituer le STOP 04** depuis ses véritables sources, pas ses V6/V7 rejetées; contrôle des 23 scènes actives / 30 plans éditoriaux et des droits; la scène S13 est supprimée.
5. **Mesurer la cadence** et tester sur deux ou trois STOP/parcours supplémentaires. Ne pas promettre un gain exponentiel ou une usine de 65 films tant que le temps de production de bout en bout n'a pas été mesuré.

## Automaticité et limites honnêtes

Le contrôle GitHub s'exécute lorsque les fichiers concernés sont modifiés sur GitHub. Il évite de perdre le contrat et signale un manifest non conforme. **Il ne peut pas déclencher automatiquement un montage à partir d'une conversation, récupérer les fichiers Drive privés, certifier les droits d'un musée, écouter une voix à la place d'un humain ou publier le film.** Ces étapes ont besoin de connexions de stockage et d'un programme d'assemblage final. Aucune action payante ou publication automatique n'est autorisée par cette règle.