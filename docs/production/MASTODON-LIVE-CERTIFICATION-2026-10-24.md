# MASTODON — CERTIFICATION LIVE (24 octobre 2026)
## Verdict: NOT CERTIFIED — fail-closed
**L'autorisation de publier ou de prétendre une acquisition/backup automatique n'est pas accordée.**

### Observations live
- Projet Supabase `ywcmmujuhtmredzvjhrg` (Velvet Passport test): management API `ACTIVE_HEALTHY`.
- `list_tables` sur `storage` et `vp_now_test`: `Connection terminated due to connection timeout`, même après vérification du projet.
- `restore_project`: refus car projet déjà `ACTIVE_HEALTHY`; aucune action destructrice tentée.
- Anciennes Supabase Edge functions `mastodon-ingest-paris-1-5` et `mastodon-ingest-paris-final-replacements`: corps de réponse `disabled`, HTTP 410; elles ne constituent pas l'ingestion automatique.
- Vercel project: `velvet-passport-now` identifié `prj_umQjXMWO2SJQwqamk3wi5VxTHPl7`, équipe `team_kDS81PCclJf1RPkVQPVmpqzP`.
- Tentative de création d'un Blob Vercel **privé**, indépendant de Supabase: `403 forbidden` (permissions insuffisantes). **Aucune sauvegarde secondaire créée**.
- Spool fiable préparé dans `scripts/production/mastodon_reliable_queue.py`; tests hors ligne réussis, mais **ni liaison à toutes les recherches ni tests live Storage/catalogue**.

### Gates requis pour la vraie certification
- [ ] Lecture effective du catalogue et de `mastodon-originals`, y compris comptage et chemins vérifiés.
- [ ] Test d'une pièce pilote: acquisition automatique lors d'une découverte/recherche, SHA-256, original en Storage, fiche cataloguée, relecture de chacun.
- [ ] Simuler timeout/reprise pendant l'ingestion sans perte ni fausse confirmation.
- [ ] Second fournisseur privé réellement accessible et configuré; copie indépendante, checksum distant, restore testé; pas seulement un dossier sur le même Supabase ni des artifacts GitHub temporaires.
- [ ] Surveillance récurrente, alertes réelles, analyse d'erreurs et suppression contrôlée des tests.
- [ ] Audit droits d'accès/RLS et clés; aucune clé de privilège dans navigateur ou dépôt public.
- [ ] Réconciliation historique Paris/Montréal/Québec avec reçus physiques.

### Interventions nécessaires
- Support Supabase sur la connexion Postgres/hibernation contradictoire : https://app.supabase.com/support/new ; inclure projet `ywcmmujuhtmredzvjhrg`, symptôme timeout du catalogue.
- Autorisation d'administration Storage Vercel pour création de Blob privé dans l'équipe, ou désignation d'un autre compte/fournisseur de sauvegarde indépendant.
- Brancher un serveur ou worker **persistant et privé** à la file d'ingestion; pas de scripts temporaires GitHub comme stockage principal.

**Règle permanente :** pas de certificat positif sans sauvegarde indépendante restaurable ET inscription Mastodon réellement relue. Les statuts à appliquer sont `STORAGE_UNVERIFIED`, `INGEST_BLOCKED`, `BACKUP_UNCONFIGURED`.

---

## ADDENDUM DE RÉCUPÉRATION EFFECTIVE — 24 OCTOBRE 2026

**Correction de l'état de la copie indépendante pour Paris 05 uniquement :** quatre ZIP contenant **20 fichiers images** (artifacts `12470696663`, `12470502716`, `12535889502`, `12545161463`), volume ZIP total **53 365 203 octets**, ont été transférés dans le dossier Google Drive privé `Velvet Passport NOW / MASTODON — Sauvetage provisoire des archives 2026-10-24`. Les quatre ZIP ont été *retéléchargés* depuis Drive; empreintes SHA-256 identiques aux ZIP initiaux, contrôle CRC sans anomalie. Le Master R2 et le manifeste des 20 images y sont également déposés.

**CERTIFIÉ SUR CE PÉRIMÈTRE :** sauvegarde indépendante et restauration-test de ces quatre lots; aucun artifact GitHub original n'a été supprimé.

**TOUJOURS NON CERTIFIÉ :** sauvegarde automatique de tous les assets, capacité de restauration de l'ensemble du catalogue, lecture Supabase live, ingestion Mastodon, droits commerciaux, disponibilité complète des 66 parcours. La décision générale `NOT CERTIFIED` reste inchangée.

Références : `docs/production/MASTODON-PARIS05-INDEPENDENT-BACKUP-VERIFIED-2026-10-24.md` et `docs/production/paris05-first-sequences-reconciliation-2026-10-24.json`.

**Couverture des 45 plans storyboardés :** 15 plans possèdent un asset candidat physiquement présent dans cette sauvegarde indépendante (8 IDs uniques), 30 plans ont encore un asset ou traitement non produit/identifié. Aucune autorisation de montage final ou de commercialisation.
