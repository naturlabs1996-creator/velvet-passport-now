# VELVET PASSPORT NOW — KDENLIVE : VERROU DE RÉALISATION PARIS 05
**Décision utilisateur : 24 octobre 2026.** Référence: checkpoint Paris 05 et 66 parcours.

## Outil officiel du montage
- **Éditeur retenu : Kdenlive**, projet natif `.kdenlive` éditable (format XML fondé sur MLT).
- Kdenlive est le **banc de montage audiovisuel et de QA humaine**. Mastodon est le **catalogue de référence des originaux, provenance et droits**; Google Drive constitue à ce jour une sauvegarde de certains originaux récupérés, pas la preuve d'une ingestion Mastodon.
- Un projet Kdenlive stocke généralement des **liens vers des fichiers médias**, pas les médias eux-mêmes. Il doit donc être livré avec son dossier d'assets ou via l'archive du projet Kdenlive, plus un manifeste de dépendances relu. Un `.kdenlive` nu n'est pas un Master téléversable complet.
- Spécifications de sortie (dimensions, FPS, profils, niveaux, musique et crédits) : à verrouiller en cohérence avec les médias originaux et la destination de distribution **avant** le premier rendu. Ne pas supposer la version installée de Kdenlive; sa compatibilité doit être vérifiée sur le poste exécutant le montage.

## Séquence maître — Paris 05 seulement, puis 65 autres
1. **Preflight documentaire :** inventorier précisément chaque image/graphisme nécessaire à une phrase, son original, identité, source, droits, SHA-256, relation `story ↔ cue ↔ asset` et présence physique dans Mastodon avec reçu. Tout manque = STOP sur la séquence concernée; ne pas insérer de remplaçant silencieux.
2. **Préserver le patrimoine sonore :** conserver les masters français et anglais, avec insert Sebaï déjà intégré dans les audios finaux attestés par le Master d'octobre 2026. **FR validé qualitativement; EN existant non automatiquement approuvé.** Ne pas régénérer ou toucher au WAV FR validé.
3. **Assembler seulement le bloc témoin** INTRO → Ernest Appert avec les archives réellement adaptées. Préparer dans Kdenlive des dossiers bin propres : `01-FR-AUDIO`, `02-EN-AUDIO`, `03-ARCHIVES`, `04-PLANS-ACTUELS`, `05-GRAPHIQUES`, `06-SOUS-TITRES`, `07-METADATA`. Conserver l'original en lecture seule; travailler sur dérivés si nécessaire.
4. **Synchroniser à la voix réelle :** chaque visuel reçoit `spoken_text`, `asset_id`, `fr_in/out`, `en_in/out`, période, crédit et justification. FR et EN nécessitent **des alignements indépendants**, jamais une proportion temporelle.
5. **Direction artistique :** plans signifiants, cadrages motivés et mouvement mesuré, aucune carte de 1739 hors contexte, pas de faux portraits, pas d'image de l'inspecteur DST Marc Ducarre, aucune photo IA se prétendant une archive. Photomontage Appert de neuf personnages affiché **exactement** au passage où il est décrit.
6. **QA du bloc témoin dans Kdenlive :** inspecter image et son ensemble, vérifier sens historique/rythme/légendes/noms/droits/voix/sous-titres; arrêter si un seul plan narré n'a pas son visuel honnête et approprié.
7. **Master gabarit :** seulement après approbation humaine, sauvegarder le `.kdenlive` et tous médias et métadonnées sous forme **autonome et téléversable**, avec vérification de réouverture sur une autre machine et contrôle des dépendances. Le faire ensuite évoluer en projet FR complet et projet EN indépendamment synchronisé, avant réplication des 65 autres parcours.

## Livrables de qualité et exigences d'audit
- `PARIS05-DEMO-FR.kdenlive` **après** montage et vérification d'ouverture; aucun faux projet de démonstration présenté comme utilisable.
- Dossier média de travail correspondant / archive projet transportable, manifeste SHA-256 et table cue→visuel.
- Premier rendu de contrôle **court** seulement après satisfaction des prérequis; `TECHNICAL_PASS`, `EDITORIAL_PASS`, `RIGHTS_PASS` et `HUMAN_AV_PASS` sont distincts.
- Pas de rendu long 61–62 min tant que la séquence témoin n'est pas professionnellement validée.

## État vérifié à la décision
- Des narrations Paris 05 FR et EN ont été produites; anciens films longs rejetés.
- **20 images** Paris 05 ont été récupérées et sauvegardées sur Google Drive avec ZIP relus, dont les pièces Appert.
- Storyboard de première passe : **45 plans**, 15 plans avec visuel candidat récupéré, **30 manques/travail de conception**, seulement 4 chapitres abordés sur 11.
- Catalogue privé Mastodon Supabase : dernière interrogation SQL = timeout, malgré statut de gestion `ACTIVE_HEALTHY`. **Non certifié**, aucune inscription automatique attestée.
- Gate Paris05 `scripts/production/paris05_professional_preflight.py` **échoue à juste titre**; n'exécuter aucun montage final automatisé sur ce signal.
- **Kdenlive et MLT ne sont pas installés dans l'environnement de travail contrôlé lors de la décision** (seul ffmpeg détecté) : création/validation d'un vrai projet `.kdenlive` opérationnel reste à faire sur un environnement équipé.
- Le dépôt GitHub ne contient **aucun projet natif `.kdenlive` existant vérifié** à la dernière inspection. Ne jamais écrire « projet prêt » à partir de cette doctrine seule.

## Sources de fonctionnement Kdenlive
- https://docs.kdenlive.org/en/project_and_asset_management/file_management/project_files.html — les `.kdenlive` sont XML/MLT et référencent les fichiers médias.
- https://docs.kdenlive.org/en/project_and_asset_management.html — projet, assets et archive.
- https://docs.kdenlive.org/en/effects_and_filters/subtitles.html — sous-titres et import/export.
- https://docs.kdenlive.org/en/project_and_asset_management/project_settings.html — profil, cadence et propriétés projet.

**LOCK : KDENLIVE = ENVIRONNEMENT CIBLE DU MONTAGE; AUCUN RENDU NI CERTIFICAT PAR SIMPLE DÉCLARATION.**
