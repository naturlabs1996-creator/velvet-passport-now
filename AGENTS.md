## 12 NOVEMBRE 2026 — ASSEMBLAGE MULTI-SCÈNES VÉRIFIÉ, PAS DE FINAL STOP04

**Une seule chaîne source-first à utiliser désormais :** [moteur de gabarit](scripts/production/velvet_gabarit_maitre.py) → [assembleur image/son](scripts/production/velvet_integrated_factory.py) → [orchestrateur multi-scènes](scripts/production/velvet_scene_batch.py) → [test CI obligatoire](.github/workflows/velvet-integrated-factory-ci.yml). Pour le STOP 04, lire [le manifeste réel des 23 scènes actives et 30 plans](docs/production/workprints/STOP04_SOURCE_FIRST_23_SCENES_20261112.json). **V6/V7 rejetées et S13 supprimée**, ne pas les utiliser comme médias.

**Preuves de production :** S14→S15 = 36,218 s et S20→S21 = 39,696 s, en 1920×1080, photo originale+voix Chatterbox et documentaire 1944 avec son propre son. Le fondu S20→S21 est 1,2 s. Contrôle audio documentaire après réencodage : corrélation interne S15=0,99606, S20=0,98261 ; deux décodages vidéo complets réussis. Les deux MP4 de contrôle sont dans Drive : [S14-S15](https://drive.google.com/file/d/1aujDB7B4Y02QihtHn0CRjgJ6tar6neyz/view) et [S20-S21](https://drive.google.com/file/d/1gAKNseojLG9bH2IsDxghH-g3gi4zgIaZ/view). **Sous-titres incomplets, pas de PASS_LOCK.**

**Goulot :** sur 30 plans attendus, 12 sources originales locales (10 photos+2 extraits filmés) et 8 WAV Chatterbox natifs existent, mais seulement S14/S15/S20/S21 sont montables en QA avec source+son. Les photos S23×3 sont retrouvées mais cues exacts non minutés ; aucune génération de faux timings. Les 18 plans absents doivent être récupérés en lot, les autres voix auditées, puis les sous-titres alignés sur les WAV avant export complet. Aucune diffusion publique automatique. **Le batch QA ne produit jamais le final** : production bloque avant qu'une scène soit omise. Le gain de temps reste à mesurer sur le premier STOP complet.

---

# MISE À JOUR — 12 novembre 2026 — ASSEMBLEUR INTÉGRÉ TESTÉ SUR S20

**Source de fabrication obligatoire avant tout nouveau rendu QA :** `scripts/production/velvet_integrated_factory.py`, sous contrôle de `.github/workflows/velvet-integrated-factory-ci.yml` et `tests/test_velvet_integrated_factory.py`. Le prototype a construit un bloc S20 source-first de 21,421 s à 1920×1080, avec photo approuvée, WAV Chatterbox S20 T1 et 16 s de documentaire au son original; cache testé. Ce test local n'est **ni un STOP 04 complet ni une validation commerciale**. La génération finale doit rester BLOQUÉE tant que source originale, droits, voix, sous-titres réellement alignés, QA mobile et approbation humaine manquent. Les V6/V7 restent rejetées et ne doivent jamais être utilisées comme images sources. **Workflow GitHub CI ajouté mais exécution GitHub non encore vérifiée.** Le cadrage maître 860+220 s'applique lorsque des sous-titres réellement vérifiés existent; sans sous-titres en QA, aucun bandeau vide. Reste à mettre à niveau les manifestes des 23 scènes actives et leurs transitions.

---

## CHAÎNE AUDIOVISUELLE UNIQUE V2 — IMPÉRATIF DE FABRICATION (12 NOVEMBRE 2026)

**NOUVEAU POINT D'ENTRÉE TECHNIQUE À UTILISER AVANT TOUT MONTAGE :** [Velvet Unified Pipeline V2](docs/production/VELVET_UNIFIED_PIPELINE_V2.md) et `scripts/production/velvet_unified_pipeline.py`. Le gabarit maître vidéo V1 demeure la référence de cadrage, importée par ce script. Cette règle s'applique à STOP 04, STOP 05, puis à TOUS les 65 autres parcours, même après changement de conversation ou d'agent.

- **Commande pilote :** `python scripts/production/velvet_unified_pipeline.py audit --manifest <manifest> --root <media_root> --out <report_dir>`. Dans le même programme : `draft-subs` sur WAV réel (brouillons NON approuvés) et `render` des plans originaux à 1080p avec cache SHA, voix et archives sonores distinctes, fondus approuvés.
- **Source-first sans exception :** ne jamais prendre les MP4 STOP04 V6/V7 rejetés comme visuels; jamais de crop, sous-titres minutés par estimation, bande vide pendant un commentaire ou son d'archives remplacé. 1920×860 + bande 220 px quand paroles; 1920×1080 sans bande seulement si plan réellement sans paroles.
- **Barrière finale :** refus automatique pour source/SHA/voix/durée/droits/synchronisation/plan/QA/approbation absents. Un MP4 `PRIVATE_QA_NOT_RELEASE` n'est PAS un film final. Aucun téléchargement, classement Mastodon, feu vert juridique ni diffusion publique ne peut être inféré de l'exécution du script.
- **Contrôle obligatoire dans GitHub :** `.github/workflows/velvet-unified-pipeline-v2-ci.yml` et `velvet-master-contract-ci.yml`. Les deux surveillent le code/manifeste et protègent le contrat; **seul l'audit physique des vrais originaux dans leur stockage permet le PASS réel**.
- **STOP04 test réel :** 24 numéros de scènes dont S13 supprimée, 23 actives/30 plans, 12 sources SHA vérifiées, 18 fichiers originaux absents du paquet local; scène S20 QA 21,42 s depuis photo réelle + Chatterbox native100 T1 + archive 16 s au vrai son. Tests logiciels passés; **film final toujours REFUSÉ** tant que les sources restantes et sous-titres/droits/QA ne sont pas vérifiés.

**La production à l'échelle des 65 parcours doit être pilotée par CE programme et non les anciens assembleurs 1280p/2 ips, réservés au maintien de compatibilité.**

---

# AUTOMATISATION VIDÉO MASTER — TOUS LES 66 PARCOURS (11 novembre 2026)

**LIRE AVANT TOUT MONTAGE, Y COMPRIS DANS UNE NOUVELLE CONVERSATION OU PAR UN NOUVEL AGENT :** [contrat de production automatique](docs/production/VELVET_AUTOMATISATION_DE_PRODUCTION_MASTER.md) et [gabarit maître vidéo](docs/production/VELVET_MASTER_GABARIT_VIDEO_V1.md). Le gabarit **velvet-master-frame/v1** est obligatoire pour STOP 04, STOP 05 et les 65 parcours suivants. Il ne peut jamais être remplacé par une description vague dans un chat.

- **Source-first obligatoire :** images/films originaux vérifiés par SHA-256, jamais les MP4 V6/V7 rejetés, aucun crop ni allongement artificiel.
- **Image parlée :** 1920×860 + 220 px de sous-titres réels synchronisés; **sans paroles :** 1920×1080, aucune bande vide. Format 4:3 intégral avec bandes latérales.
- **Audio :** les voix Chatterbox WAV approuvées; film documentaire avec son original seul si LOCK. Pas de sous-titres à durées estimées, ni de voix de substitution.
- **À chaque modification de parcours dans GitHub :** le workflow [velvet-master-contract-ci.yml](.github/workflows/velvet-master-contract-ci.yml) doit passer. Le contrôle statique ne remplace pas la QA sur les vrais médias; toute publication reste interdite tant que droits, audit source, synchronisation et approbation humaine ne sont pas tous positifs.
- **État actuel :** seul le socle photo + cache + audit et un ancien assembleur de workprint existent. Leur intégration audiovisuelle complète reste à fabriquer et à mesurer. Pas d'export final revendiqué pour STOP 04.

---

# Velvet Passport — règles obligatoires pour les agents de recherche et de production

## Prévol obligatoire du banc audiovisuel — Atelier Roger (26 octobre 2026)
**Avant toute session de fabrication** d'un parcours : vérifier réellement la disponibilité des logiciels (Kdenlive, MLT, FFmpeg, Python), des masters FR/EN, des médias originaux avec SHA-256, des licences, du catalogue Mastodon et des contrôles QA/NOW. Ne jamais chercher les outils au milieu du montage. Utiliser le paquet `VELVET_ATELIER_ROGER_PREFLIGHT_66_PARCOURS_2026-10-26.zip` sauvegardé dans l'espace Drive Velvet et la fiche `docs/production/VELVET-ATELIER-ROGER-PREFLIGHT-66-2026-10-26.md`. Le résultat doit rester **BLOCKED** si un élément obligatoire manque; l'absence de Kdenlive/MLT n'interdit pas des workprints privés FFmpeg, mais interdit de déclarer la QA native Kdenlive terminée. Suivre les minutes réellement validées et les parcours complets, pas les recherches ou les prototypes.

**LOCK 2026-10-24 — portée : Paris, Montréal, Québec et toutes futures villes / tous les 66 parcours.**

## Règle numéro 1 : la bibliothèque MASTODON
**Dès qu'une image ou une pièce documentaire UTILE est découverte ou reçue : l'enregistrer immédiatement dans Mastodon, avant de poursuivre la recherche.**

Applicable aux images envoyées dans un chat, portraits de protagonistes, cartes, cadastres, plans, photographies actuelles ou historiques, manuscrits, actes, rapports, pages de livre, extraits de journaux, sons et vidéos retenus pour un parcours.

1. **Acquérir** le document original non retouché ; ne pas seulement consigner l'URL.
2. **Dédupliquer**, attribuer un ID stable, classer `VILLE → PARCOURS → STOP → STORY → ASSET`, et indexer les autres utilisations éventuelles.
3. **Cataloguer** titre, sujet/personnes, lieux, période, organisme/cote/URL source, auteur, date, fiabilité et incertitudes, rôle exact dans le texte.
4. **Conserver** l'original et les dérivés séparément ; enregistrer dimensions, taille et SHA-256.
5. **Vérifier physiquement** l'écriture, puis la relecture du fichier et de la fiche dans Mastodon ; produire un reçu avec `asset_id`, `catalog_record_id`, `storage_bucket`, `storage_path`, `sha256`, `file_verified_at`, `catalog_verified_at`.
6. **Documenter les droits** sans les deviner. Des droits non vérifiés n'empêchent pas la conservation privée à statut FOUND / REVIEW_PENDING, mais bloquent la commercialisation.
7. **Échec** = `INGEST_BLOCKED` + raison + tâche de récupération immédiate. Une conversation, un lien, un Master, un commit ou un artifact GitHub ne sont PAS des preuves d'archivage Mastodon.

## En cas d'interruption de Supabase ou de la connexion
Sur une machine de production **disposant réellement du fichier**, déposer l'original dans la file persistante `scripts/production/mastodon_reliable_queue.py` et conserver la preuve locale ; voir [MASTODON-STORAGE-RELIABILITY-2026-10-24.md](docs/production/MASTODON-STORAGE-RELIABILITY-2026-10-24.md). Le mécanisme de reprise évite un abandon silencieux, mais tant que l'ingestion Mastodon et la lecture de son catalogue n'ont pas été confirmées, marquer `INGEST_BLOCKED / STORED_CATALOG_PENDING`, jamais `FOUND`. Si ce dispositif n'est pas connecté à l'environnement de recherche, signaler le blocage : une consigne GitHub ne déclenche pas d'upload de ChatGPT toute seule.

## Aucun silence sur les pièces manquantes
Chaque recherche documente ce qui est : `DISCOVERED`, `FOUND_IN_MASTODON`, `INGEST_BLOCKED`, `RIGHTS_HOLD`, `PRODUCTION_READY`. N'annoncer `FOUND_IN_MASTODON` qu'avec un reçu vérifié. Ne jamais remplacer en silence un document manquant par une image hors sujet ou générée par IA.

**Tout stop destiné à la production** : liste exhaustive des images attendues par segment/phrase/audio FR+EN. Le montage final est bloqué si un asset obligatoire manque de la bibliothèque, si son identité est douteuse ou si ses droits commerciaux ne sont pas validés. Même un montage techniquement réussi ne vaut pas QA audiovisuelle.

## Rattrapage de l'historique
Rapprocher systématiquement les Masters, conversations, fichiers, URL, artifacts GitHub et dossiers de recherche de Paris / Montréal / Québec avec Mastodon. Ne jamais décréter qu'un fichier est perdu tant que les sources n'ont pas été parcourues. Ne jamais modifier un LOCK historique pour masquer un manque documentaire.

Voir :
- [Doctrine Mastodon LOCK](docs/production/MASTODON-DOCTRINE-ACQUISITION-RECOVERY-LOCK-2026-10-24.md)
- [Audit et réconciliation](docs/production/MASTODON-AUDIT-RECONCILIATION-2026-10-24.md)
- [Suivi des corrections](https://github.com/naturlabs1996-creator/velvet-passport-now/issues/11)

**N'interpréter jamais une instruction dans ce fichier comme une capacité d'ingestion automatique : si l'accès Mastodon est indisponible, le signaler et bloquer, sans déclarer l'opération terminée.**
