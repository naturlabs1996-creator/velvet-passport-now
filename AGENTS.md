# Velvet Passport — règles obligatoires pour les agents de recherche et de production
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
