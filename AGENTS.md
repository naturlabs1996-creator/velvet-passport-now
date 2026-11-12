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
