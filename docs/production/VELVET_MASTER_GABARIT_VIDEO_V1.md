# VELVET PASSPORT NOW — GABARIT MAÎTRE VIDÉO V1 (TOUS LES PARCOURS)

**Statut : règle transversale de fabrication, source unique du cadrage.** 11 novembre 2026. Applicable au STOP 04, au STOP 05 et aux **65 autres parcours** annoncés. Ce document et `velvet_gabarit_maitre.py` sont un **standard de production**, et **ne certifient pas rétroactivement les films existants**.

## 1. Contrat visuel obligatoire

- Sortie : **1920 × 1080, 25 images/s**. Image source originale intégrale ; aucun crop/cover/étirement, aucune extraction d'images d'un MP4 QA rejeté, aucune photographie IA.
- **Paroles audibles** : image/film en `contain` dans **1920 × 860**, bande sous-titres **1920 × 220** en dessous. Police **Inter SemiBold 72 px**, blanc, deux lignes maximum, temps calés sur l'**enregistrement effectivement entendu**. Pas de bande de 220 px vide pendant un commentaire non transcrit.
- **Plan réellement sans paroles ni sous-titre** : visuel `contain` dans **1920 × 1080**, aucune bande de sous-titres pré-réservée. La hauteur du plan reste stable pendant les pauses : ne pas alterner zoom/cadrage d'une seconde à l'autre.
- **Format historique 4:3** : bandes **latérales** normales, ratio et bords intacts. Pour les rares images ultra-panoramiques, une marge verticale est physiquement inévitable : elle doit être mesurée et justifiée, jamais comblée par une découpe.
- La **hauteur maximale utile** est choisie en calculant `min(largeur_zone/largeur_originale, hauteur_zone/hauteur_originale)`. Centrer; les marges latérales résiduelles sont neutres. Les bords d'origine sont conservés à 100 %.
- Film documentaire commenté : **son historique seul**, sans narration Velvet Passport superposée. Sous-titrer fidèlement le commentaire avant de réserver la bande dans une livraison définitive.

## 2. Séquence de fabrication réutilisable pour les 65 autres parcours

1. **INGEST** : intégrer les véritables images, photographies et films ; noter fichier original, source, droits, SHA-256, route/STOP/scène/plan. Ne jamais partir d'un ancien export QA.
2. **LOCK ÉDITORIAL** : texte exact, ordre des plans, médias approuvés, transitions et choix de timbre sans rouvrir les décisions déjà prises.
3. **LOCK AUDIO** : récupérer les WAV definitifs et originaux documentaires ; vérifier chaque phrase et l'absence de syllabes perdues.
4. **SYNC** : sous-titres SRT/ASS calés mot par mot sur la voix réelle; seulement alors déterminer les bornes absolues et locales des plans et du film.
5. **RENDU** : appliquer ce gabarit identique aux photos et aux films du STOP entier. Filtre FFmpeg `scale=...:force_original_aspect_ratio=decrease,pad=...` avec `mode=spoken`/`silent` ; jamais de crop.
6. **BARRIÈRE** : refuse final si une source manque, SHA invalide, texte/timing non validés, bande vide lors de paroles, photo coupée, source QA recyclée, audio d'archives remplacé ou droits non vérifiés.
7. **QA GLOBALE** : plan par plan puis film complet (audio, bordures, sous-titres, transitions), **visionnage sur téléphone**. `PASS_LOCK` seulement après cette vérification, jamais sur la seule base d'un décodage réussi.

## 3. Contrôle réel du STOP 04 — état au 11 novembre 2026

D'après la liste de montage éditoriale : **24 numéros de scène, S13 supprimée (23 actives), 30 plans prévus**, dont **12 médias source physiquement disponibles et identifiés par SHA** dans notre paquet source-first : **10 photographies et 2 extraits de documentaire 1944**. **18 plans n'ont pas leur fichier source original dans ce paquet** ; cela ne veut pas dire que les originaux n'existent pas ailleurs, mais ils ne sont pas encore des entrées exploitables. 

Les **12 cadres de contrôle** ont été rendus à la taille maximale dans le mode sous-titré, source entière et 0 coupe. Les **deux films de 1944** restent préservés avec leur son original ; leurs sous-titres historiques sont encore à compléter. Ce sont des **aperçus QA de cadrage, pas un MP4 continu**.

**S20 :** nouvelle voix native Chatterbox V3 **prise 1** retenue, ne pas la remplacer. Le rendu S20 isolé antérieur reste non validé sur le plan visuel (bande de sous-titres vide sur l'extrait commenté de 16 secondes). Le gabarit évite la répétition de ce défaut. Garder le fondu S20→S21 approuvé de 1,2 s.

**V6/V7 : rejetées comme sources de production**. Un diagnostic de leurs marges est permis, mais leurs images, leurs temps de sous-titres approximatifs et leur montage ne sont pas réutilisables. **Aucun nouveau MP4 FINAL du STOP04 n'est créé** par la mise en place du gabarit.

## 4. Mode d'emploi pour la prochaine production

- Code universel : `velvet_gabarit_maitre.py` (Python 3 + Pillow + FFmpeg/ffprobe).
- 65 autres parcours : copier le **schéma** du manifeste et renseigner uniquement les sources et décisions propres à chaque parcours, **sans copier les médias d'un autre itinéraire**.
- `python velvet_gabarit_maitre.py audit --manifest STOP04_MANIFEST_SOURCE_FIRST.json --root sources --output STOP04_AUDIT_GABARIT_MASTER.json` : retourne code **2** et refuse l'export si des preuves manquent.
- `python velvet_gabarit_maitre.py photo-qa --source photo-originale.jpg --output controle.jpg --mode spoken` : **aperçu technique** seulement, avec bande de contrôle explicitement indiquée comme non synchronisée.
- `python velvet_gabarit_maitre.py archive-qa --source film-1944.mp4 --at 1.5 --output controle.jpg --mode spoken` : contrôle image du film source. Son original préservé dans la source ; aperçu JPEG sans son.
- `python velvet_gabarit_maitre.py filter --mode spoken --srt SOUS_TITRES_VERIFIES.srt` : obtention du filtre FFmpeg qui conserve les proportions et insère la bande sous-titrée ; **ne pas utiliser un SRT estimé**.
- `python -m unittest -v test_gabarit_repo.py` : tests indépendants des médias, puis validation particulière à chaque STOP.

## 5. Gouvernance et anti-oubli

**Un seul gabarit technique global**, conservé dans le dépôt `velvet-passport-now` et dans Google Drive à la racine `Velvet Passport NOW`. **Un seul MASTER éditorial par parcours** : les 65 autres parcours réutilisent le moteur commun et leur propre manifeste, non 65 copies divergentes du code. Le MASTER `PARIS05_ACTIF_UNIQUE.md` porte le lien vers cette norme globale. Aucun fichier LOCK n'est écrasé par l'introduction de ce standard.
