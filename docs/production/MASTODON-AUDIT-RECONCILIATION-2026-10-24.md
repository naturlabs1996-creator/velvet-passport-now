# MASTODON — AUDIT ET RÉCONCILIATION DOCUMENTAIRE
Date d'ouverture : 24 octobre 2026. Portée : Paris, Montréal et Québec; 66 parcours au total. **Audit partiel, pas certificat de complétude.**

## État vérifié dans le dépôt GitHub
- Paris 05 : **18** images documentées comme acquises dans des artifacts GitHub Actions (statut `INGESTED_REVIEW_ONLY`, registre daté du 22 octobre).
- Paris 05 : **5** autres pistes iconographiques répertoriées dans le dossier de reprise professionnelle; droits et archivage non confirmés.
- Sebaï : **4** pistes de portraits dans le registre (3 URL candidates, 1 non localisée) ; identité/droits non confirmés. Les photographies fournies dans les conversations le 23 octobre doivent être récupérées et comparées.
- Appert : le document exact Rijksmuseum `RP-F-2007-161` est mentionné comme téléchargé dans un artifact distinct; il n'est pas démontré physiquement présent dans Mastodon.
- Paris 05 : **28 identifiants distincts de candidats documentaires** à réconcilier dans les registres consultés, pas 28 originaux certifiés. Le storyboard de reconstruction consulté compte **45 plans décrits, dont 30 sans identifiant d'asset attaché** (plusieurs correspondent à des traitements graphiques, à distinguer des images réellement obligatoires).
- Paris 05 : le registre de couverture comprend **11 segments** ; `STOP-SEBAI-1977` n'avait **aucun asset d'image intégré** dans ce registre. Ne pas en déduire qu'aucune photo utile n'a jamais été fournie.
- Montréal : un Master « Cape et épée » du 2 octobre relie 4 stops du premier parcours aux dossiers historiques, mais la présence des originaux dans Mastodon n'est **pas auditée**.
- Québec : l'audit du 13 octobre recense 16 parcours dans un registre initial et 68 lignes de travail, avec des décisions postérieures à réconcilier. Ce sont des entrées de dossiers/stops, **pas** des originaux d'archives vérifiés.

## Limitation critique
**Aucune inspection en lecture du stockage privé Mastodon ni du catalogue Supabase n'a abouti à ce jour.**
La connexion Supabase a expiré. Les nombres **réellement archivés** dans chacune des villes sont donc **INCONNUS**, et non zéro. Ne jamais écrire 0/28 enregistrés ou annoncer un import réussi.

## Réconciliation à exécuter, sans refaire les recherches
1. Inventorier en lecture réelle `mastodon-originals` et les fiches de catalogue ; contrôler leur nombre et les chemins.
2. Joindre pour chaque pièce un reçu Mastodon (ID, chemin, SHA-256 et lecture effective du fichier).
3. Comparer les 28 candidats Paris 05, les fichiers reçus le 23 octobre, les Masters Paris 1–30 et les listes de plans/images. Récupérer les fichiers externes avant expiration des artifacts et leurs sources d'origine.
4. Confronter ensuite chaque stop Montréal et Québec aux fichiers disponibles et aux sources primaires. Les cas avec seulement titre/URL sont `LOCATED_ONLY` ; ne pas les déclarer perdus.
5. Reprendre chaque fichier trouvé mais non archivé : ingestion immédiate dans Mastodon, classement CITY/ROUTE/STOP/STORY/ASSET, original+SHA, notice, droits/identité provisoires si nécessaire.
6. Réconcilier les variantes et les doublons ; préserver le dernier LOCK valable et les anciennes versions comme traces, sans écraser les corrections.
7. Contrôler la couverture image/phrase/audio dans le storyboard et les deux langues ; libérer le montage seulement lorsque les pièces requises, leur identité et leurs droits sont validés.

## Règle permanente ajoutée à Velvet recherches
Voir `AGENTS.md` et `MASTODON-DOCTRINE-ACQUISITION-RECOVERY-LOCK-2026-10-24.md`. Aucune découverte documentaire utile ne reste dans un chat ou un dossier temporaire. Si l'enregistrement échoue, statut `INGEST_BLOCKED`, et le travail de production dépendant de la pièce s'arrête.

## Outil
`python scripts/production/audit_mastodon_reconciliation.py --output /tmp/mastodon-audit.json`
Constitue un registre **en lecture seule** des candidats Paris 05 ; ne vérifie pas automatiquement Supabase. L'option `--require-complete` bloque volontairement en l'absence de lecture Mastodon en direct.

## Statut de fin de première passe
**POLITIQUE ENREGISTRÉE DANS GITHUB ; INDEX PARTIEL MIS EN PLACE ; RESTAURATION / INGESTION PHYSIQUE NON ENCORE EFFECTUÉE.**
