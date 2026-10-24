# MASTODON — DOCTRINE D'ACQUISITION ET DE RÉCUPÉRATION (LOCK)
**En vigueur : 24 octobre 2026 — durable / toutes villes / 66 parcours Velvet Passport et extensions futures.**
**Statut : règle opérationnelle obligatoire ; l'automatisation et le rattrapage historique nécessitent une QA distincte.**

## 1. Principe non négociable
**Recherche utile → enregistrement immédiat dans MASTODON → preuve d'ingestion → seulement ensuite poursuite normale de la recherche.**
La conversation, un résultat web, un dossier de téléchargements, un artifact GitHub Actions, une shotlist et un Master de reprise **ne sont pas** Mastodon.
Ne jamais annoncer « enregistré dans Mastodon » avant d'avoir vérifié le fichier **et** sa fiche cataloguée. Un lien ou un ID inventorié ne remplace pas un original conservé.

## 2. Réception / inscription immédiate
Pour toute image ou pièce documentaire utile (photographie, portrait, carte, plan, manuscrit, acte, presse, audio, vidéo) :
1. Vérifier l'identité du document et les doublons (empreinte SHA-256 ; plusieurs usages possibles d'un même original).
2. Attribuer un **identifiant stable** et rattacher à `VILLE → PARCOURS → STOP → STORY → ASSET`. Les pièces transversales conservent un original unique et plusieurs rattachements.
3. Déposer l'**original non modifié** en stockage pérenne privé Mastodon ; relever le chemin réel, la taille, le format, la date et le SHA-256 ; relire pour confirmer l'intégrité.
4. Créer la fiche : titre, description/sujet, auteur si connu, date, organisme, cote/URL, licence/droits (ou `UNKNOWN`), contexte exact, degré de certitude, relations et versions.
5. Produire le **reçu de bibliothèque** : `asset_id`, `storage_bucket`, `storage_path`, `sha256`, `file_verified_at`, `catalog_record_id`, `catalog_verified_at`, stop(s) liés ; consigner l'opérateur et la provenance.
6. Si une donnée historique ou juridique manque, archiver **immédiatement** avec `FOUND / REVIEW_PENDING`, **sans** déclarer `RIGHTS-CLEARED` ou `PRODUCTION-READY`.

**Exception/échec :** si le fichier ou l'accès Mastodon manque, produire `INGEST_BLOCKED`, identifier précisément la pièce et la cause, empêcher son utilisation en production et traiter le blocage. Ne pas transformer cet échec en réussite verbale.

## 3. États distincts — aucune confusion
- `DISCOVERED` : aperçu, référence ou candidat dans recherche/conversation (non archivé).
- `INGEST_BLOCKED` : acquisition ou inscription réelle non terminée ; preuve insuffisante.
- `FOUND` : original + fiche **physiquement vérifiés dans Mastodon**, métadonnées possiblement provisoires.
- `VERIFIED` : provenance, identité et contexte documentaire contrôlés.
- `RIGHTS-CLEARED` : droits de reproduction commerciale explicitement examinés.
- `PRODUCTION-READY` : original et dérivés accessibles, droits, qualité et correspondance au passage narratif approuvés.

Un LOCK historique/éditorial ne constitue **jamais** un reçu d'archivage ni une autorisation commerciale.

## 4. Garde de montage / JIT
Avant le premier montage final d'un stop : une **liste exhaustive** de visuels attendus est liée à chaque phrase, sujet ou cue audio FR/EN. Chaque entrée possède son asset Mastodon et le reçu d'intégrité vérifié.
Si une image nécessaire n'existe pas ou si l'usage est non autorisé : `STOP / BLOCKED` ; pas de diaporama fictif, de carte hors sujet, d'image fabriquée, de remplissage typographique présenté comme produit final, ni de saut silencieux.
Le rendu MP4 et les pistes audio doivent subir une inspection end-to-end ; comparer exactement au manifeste du stop avant autorisation de diffusion.

## 5. Rattrapage rétrospectif — Paris, Montréal, Québec
Ne **pas** refaire inutilement les recherches/LOCKS. Réconcilier les Masters, conversations, documents, URLs, dépôts GitHub, artifacts encore disponibles et Mastodon pour chaque stop :
- `EXPECTED` / `LOCATED_ONLY` / `DOWNLOADED_NOT_MASTODON` / `INGEST_BLOCKED` / `MASTODON_RECEIPT_VERIFIED` / `MISSING_SOURCE` ;
- documents primaires, visuels, plans, sources, droits, versions, incertitudes ;
- source canonique, ID de parcours/stop, absence de doublons, liens vers la narration et priorité ;
- statut **vérifié avec preuves**, jamais inféré à partir d'une simple mention.

**Paris 05 — urgence :** le registre GitHub `docs/production/paris05-visual-ingest-status.json` indique 18 visuels acquis dans **des artifacts GitHub Actions** (statut `INGESTED_REVIEW_ONLY`), ce qui ne prouve **pas** leur présence dans Mastodon. Le fichier `docs/production/paris05-visual-coverage-and-gaps.json` décrit le stop Sebaï sans asset disponible au moment de son édition. Rechercher aussi les photographies de protagonistes remises le 23 octobre 2026 ; leur archivage dans Mastodon est **non vérifié**. Les versions récentes et les preuves d'archives sont prioritaires sur les anciens registres.

**Montréal / Québec :** confronter chaque stop aux Masters et audits existants ; ne pas déclarer perdu un dossier parce qu'il n'est pas encore retrouvé. Respecter la chronologie des décisions et signaler les contradictions de canon sans les résoudre en inventant.

## 6. Mesure et responsabilité
Rapport de clôture **par stop et par ville** : pièces attendues, originales archivées avec reçu, liens seulement, manquantes, droits en attente, incidents, correctifs. Objectif : **100 % des pièces utiles archivées** et **100 % des pièces de production prêtes** avant montage final ; les deux métriques sont différentes.
La règle est pérenne, mais sa réalisation technique ne peut être déclarée automatique qu'après tests réels d'écriture et lecture sur Mastodon, y compris pour les documents reçus en conversation.
