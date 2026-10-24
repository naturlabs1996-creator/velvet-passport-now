# MASTODON — Fiabilité du stockage et reprise après panne
Date : 24 octobre 2026. **Statut : protections préparées, tests hors ligne ; PAS encore un pipeline Mastodon opérationnel de bout en bout.**

## Diagnostic réel
- L'API de gestion Supabase retourne `Velvet Passport test` (`ywcmmujuhtmredzvjhrg`) à l'état `ACTIVE_HEALTHY`.
- L'inspection des tables par connecteur SQL a plusieurs fois expiré. Une interruption du connecteur n'est **pas** une preuve de panne du service Storage.
- Aucun inventaire du bucket privé `mastodon-originals` n'a encore été confirmé par lecture du stockage réel.
- Ce document ne doit donc jamais servir à déclarer qu'un original est déjà archivé.

## Protections déjà codées dans ce dépôt
Fichier : `scripts/production/mastodon_reliable_queue.py`.
- **Spool local persistant** (SQLite avec WAL + synchronisation durable et fichier original immuable par SHA-256) avant toute transmission.
- Dossiers privés (droits Unix 0700, registre 0600) ; pas de contenu historique envoyé au dépôt GitHub.
- **Chemins de stockage versionnés par empreinte** : pas d'upsert destructeur, pas de remplacement silencieux.
- Transfert REST pour fichiers <= 6 MiB ; **TUS reprenable** en blocs de 6 MiB pour les fichiers plus grands, sur l'hôte direct de Supabase Storage.
- Retentatives bornées en cas de réseau/HTTP 429, 503, etc. ; URL de reprise TUS mémorisée.
- **Lecture privée de l'original après transfert et contrôle SHA-256**. Les échecs restent dans `RETRY_PENDING`; les originaux restent dans le spool.
- Après transfert vérifié, statut **`STORED_CATALOG_PENDING`** : le catalogage Mastodon n'a pas encore été prouvé par lecture de la fiche. N'affirmer jamais `FOUND` sur cette seule base.
- `push` refuse de démarrer sans URL projet et jeton privé dans des variables d'environnement.

## Utilisation technique, uniquement sur machine de confiance et disque persistant
Ne PAS utiliser le dossier temporaire d'un runner GitHub Actions comme stockage principal.

```bash
python3 scripts/production/mastodon_reliable_queue.py enqueue \
  --file /chemin/prive/original.jpg \
  --asset-id VP-PAR-05-SEBAI-VIS-001 \
  --city PAR --route VP-PAR-05 --stop STOP-SEBAI --story STORY01 \
  --title "Photographie documentaire" --source "URL ou cote d'archive"
python3 scripts/production/mastodon_reliable_queue.py status
```

Pour transférer, il faut un accès privé au projet configuré **sur le serveur/machine autorisée**, jamais dans du code public. Injecter `MASTODON_STORAGE_TOKEN` depuis un coffre à secrets et `MASTODON_SUPABASE_URL` depuis la configuration privée, puis lancer `push`. Ne jamais afficher ni commiter les valeurs des secrets.

## Vérifications restantes avant mise en service
1. Rétablir une lecture des tables/catalogue et du bucket privé Supabase ; distinguer timeout du connecteur vs indisponibilité réelle du Storage.
2. Inspecter noms/colonnes et droits des tables Mastodon ; implémenter l'inscription au catalogue en opération idempotente, puis la relecture de la fiche, avant de délivrer un reçu Mastodon.
3. Tester avec un vrai original non sensible : enqueue, transfert, interruption simulée, reprise, téléchargement SHA, fiche/relations, et preuve relue ; supprimer l'objet de test par procédure autorisée après constat, si nécessaire.
4. Alimenter la file automatiquement à partir des recherches, des fichiers remis en conversation et des imports ; sans cela le script est seulement un outil manuel, non une garantie de capture.
5. Héberger la file sur un volume permanent avec **seconde sauvegarde chiffrée indépendante**. Un disque unique ne protège pas contre la perte physique.
6. Exploiter le worker de reprise de façon périodique via une tâche d'exploitation dédiée ; surveiller le nombre d'entrées `RETRY_PENDING`, `STORED_CATALOG_PENDING` et les délais depuis la réception.
7. Vérifier les quotas, journaux de stockage, politiques d'accès (RLS) et coûts potentiels ; ne pas élargir l'accès à un bucket d'archives privées pour corriger une erreur de permission.
8. Tester la conservation après déconnexion prolongée, deux acquisitions identiques, conflit de version, panne d'un service et rotation de secret.

## QA vérifiable
`.github/workflows/mastodon-spool-integrity.yml` lance `scripts/production/mastodon_queue_selftest.py` : simulation sans réseau de redémarrage, timeout, HTTP 503, reprise TUS, vérification des empreintes et interdiction du faux statut `archived`.

**Objectif réaliste :** interruption réseau possible, mais **aucune perte silencieuse**, reprise contrôlée, alerte visible et absence de certificat d'archivage sans fichier **et** fiche réellement relus. Zéro panne absolue ne peut pas être promis.
