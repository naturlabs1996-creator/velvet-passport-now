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