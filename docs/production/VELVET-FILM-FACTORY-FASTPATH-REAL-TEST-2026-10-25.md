# Velvet Passport — première chaîne de fabrication automatisée testée, Paris05 / Appert

**Reçu daté 25 octobre 2026 · portée : automatisation technique V1, pas film final.**

## Résultat physique
- **Assemblage automatisé du montage privé existant** Appert FR, **5 clips**, narration **WAV originale**, en un MP4 de **195,76 secondes**, **1920×1080, 25 fps, H.264 + AAC**, audio et vidéo décodables.
- **SHA-256 du MP4 rendu par la chaîne automatisée** : `319a02359ee8577ef03f368a3fd87d2adee0ed2d6f609d67faefd9cd4f22a087`.
- La fonction `FAST_PASSTHROUGH` a concaténé les clips compatibles **sans les réencoder**; l'audio WAV a été muxé sans réenregistrement de voix.
- **Script exécutable en dépôt :** `scripts/production/velvet_film_factory_fastpath.py`, avec schéma JSON à durée/frame exacte, source + SHA + cue, vérifications médias, rendu privé, format normalisé si nécessaire, fades optionnels, reçu et garde de diffusion.
- **Test de sécurité local réellement exécuté** : réussite du rendu privé sur les cinq clips; échec attendu de `--publish` (droits, reçu Mastodon, synchro et QA bilingue manquants), refus des fichiers altérés, des raccords lacunaires, des chemins hors dossier et des champs manquants.
- **CI GitHub** : `tests/test_velvet_factory_fastpath.py` et `.github/workflows/velvet-film-factory-fastpath-test.yml`. Le test CI emploie une carte grise synthétique **pour la qualité logicielle uniquement**, jamais comme image historique.
- **Kit exécutable autonome** `VELVET_PASSPORT_FACTORY_PILOT_2026-10-25.zip` avec les 5 clips existants, WAV, les JPEG sources, manifeste, script, contrôles et documentation. **63 656 304 octets**, SHA-256 `12225e543574b0b5c9d954e01c4da0f57a4444f9c8195ff71db33379c618efdc`. Copié et retéléchargé depuis Google Drive : **même SHA-256, ZIP CRC OK**.
- **Copie indépendante sécurisée** : https://drive.google.com/drive/folders/1UjDt8EGMjTq6byewythwTl8GmmnMMPv7

## Exécuter après décompression
```bash
python velvet_film_factory.py --manifest paris05_appert_3min16.production.json --check
python velvet_film_factory.py --manifest paris05_appert_3min16.production.json --out sortie_privee.mp4
python test_factory.py
# Doit refuser la publication publique :
python velvet_film_factory.py --manifest paris05_appert_3min16.production.json --check --publish
```

**Important :** la commande installée directement dans GitHub s'appelle `velvet_film_factory_fastpath.py` (code fonctionnel identique; arguments `--manifest`, `--out`).

## Limites / blocages non résolus
1. Le projet éditorial de 66 parcours n'est **pas** devenu une usine complète simplement par la vérification de l'assembleur. Il manque les images de nombreux passages et leur minutage exact (séparément FR/EN).
2. Le moteur n'invente aucune photographie, aucun timecode ni droits; **Mastodon SQL reste non certifié**. Le dispositif d'urgence Google Drive n'est pas Mastodon.
3. Il n'existe pas encore de film Paris05 FR/EN intégral validé. Le lecteur de films NOW existe et reste correctement fermé aux utilisateurs tant que les validations ne sont pas réunies.
4. Le projet natif Kdenlive doit être ouvert et testé dans le logiciel (absent de la machine de création); cette chaîne FFmpeg est le générateur rapide **en amont de la finition**.
5. Les cinq clips réassemblés sont le **même contenu de 3 min 15 s** : **ce test ne constitue pas de nouvelles minutes du film**. Il prouve l'étape répétitive automatisable.

## Prochaine dépendance non automatisable par ce seul moteur
Un **manifeste exact complet, riche en médias réels et autorisés** pour les 11 chapitres de Paris05. Une fois ce manifeste certifié, le moteur peut accélérer le rendu et automatiser les vérifications. La certification historique et le QA humain restent obligatoires. **Ne pas publier sans PASS de Gate0 et du film complet.**
