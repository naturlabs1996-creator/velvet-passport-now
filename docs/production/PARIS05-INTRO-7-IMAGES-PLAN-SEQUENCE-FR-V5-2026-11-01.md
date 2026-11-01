# Velvet Passport — Paris 05 — plan-séquence INTRO FR V5, 7 images

**Date :** 1er novembre 2026  
**Périmètre :** INTRO seulement, jusqu'au départ vers le 21 rue Louis-le-Grand.  
**Statut :** PLAN EDITORIAL ET CUES AUDIO MESURÉS / MEDIA, DROITS ET QA VISUELLE À VALIDER.  
**Source mesurée :** [GitHub Actions 41324574410](https://github.com/naturlabs1996-creator/velvet-passport-now/actions/runs/41324574410) (artefact `PARIS05-INTRO-V5-FR-7-IMAGES-EXACT-CUES-QA`).  
**Master audio de destination :** [V5 FR 11 segments avec sept raccords approuvés](https://github.com/naturlabs1996-creator/velvet-passport-now/actions/runs/41267746528), artefact `PARIS05-FR-V5-APPROVED-PRONUNCIATIONS-PRIVATE-QA`.

## Timecodes exacts des sept images

Le découpage suit les **débuts de phrases mesurés sur le WAV** ; les intervalles sont contigus et demi-ouverts `[IN, OUT)`. Les noms visuels proviennent de l'ordre éditorial choisi lors de la conversation; ils ne prouvent pas que les fichiers sources exacts ont été récupérés ou que leur usage commercial est autorisé.

| # | IN FR V5 | OUT FR V5 | Durée | Visuel | Repère audio exact au IN |
|---|----------|-----------|-------|--------|--------------------------|
| 1 | 00:00.00 | 00:11.45 | 11.45 s | Opéra Garnier, photographie historique | « Bienvenue dans les coulisses de l’Opéra. » |
| 2 | 00:11.45 | 00:35.21 | 23.76 s | Rue historique « Février » (identité/photographie à confirmer) | « Des rues secondaires. » |
| 3 | 00:35.21 | 00:56.03 | 20.82 s | Carte ancienne (période et adéquation historique à contrôler) | « Pendant la Révolution française, elle devient la rue des Piques. » |
| 4 | 00:56.03 | 01:36.35 | 40.32 s | Mosaïque des sept personnages | « Nous commencerons avec un photographe… » |
| 5 | 01:36.35 | 01:40.19 | 3.84 s | Façade architecturale Apple | « Regardez les façades. » |
| 6 | 01:40.19 | 01:51.51 | 11.32 s | Immeuble W au crépuscule | « Les étages. » |
| 7 | 01:51.51 | 02:02.98 | 11.47 s | Plaque rue Louis-le-Grand | « Notre première histoire commence… », puis « Maintenant, dirigeons-nous vers le 21, rue Louis-le-Grand. » |

**Coupe d'introduction :** exactement **02:02.98** (122.980 secondes). La séquence `STOP-01` suit immédiatement dans le master V5 ; elle ne fait pas partie de ces sept plans.

## Contraintes de réalisation verrouillées

1. **Sept images seulement** pour cette introduction. Chacune est montrée une fois, exactement dans cet ordre. Aucune réapparition de mosaïque après 01:36.35.
2. **Mosaïque 00:56.03–01:36.35** : la quitter à la première syllabe de « Regardez les façades. »
3. Les plans 5 et 6 montrent les façades, les étages et les différences d'échelle ; le plan 7 garde la plaque jusqu'à la fin de la phrase d'orientation.
4. **Préserver toute la photographie** sans recadrage destructeur ni haut du sujet coupé. Utiliser des bandes latérales noires ou discrètes, et éventuellement de l'animation douce limitée à l'image non tronquée. Ne pas agrandir une image basse résolution jusqu'au flou.
5. **Aucune modification du WAV** à cause des durées visuelles ; sous-titres synchronisés au master FR V5 **corrigé**, et non repris aveuglément du V4.
6. **Pas de répétition d'image, pas de patch visuel artificiel, pas de portrait inventé, pas de substitution d'archive par une image IA**. Les images doivent conserver leurs dates/identités et licences vérifiables.
7. Dans une version Kdenlive, exporter une première **prévisualisation privée** à 1920×1080, 25 ips, en synchronisant à la voix, avant toute qualification commerciale. Cadrage et transitions doux n'autorisent pas à déplacer les points narratifs mesurés.
8. Le texte final V5 est **« Maintenant, dirigeons-nous vers le 21, rue Louis-le-Grand. »** Il conclut l'introduction ; ne pas anticiper « Nous voici à notre premier arrêt » qui ouvre `STOP-01`.

## Mesures et réserve

- Source WAV INTRO V5 avant le remplacement de la phrase « La rue Louis-le-Grand… » : **122.740 s**.
- La phrase de référence vocale déjà approuvée remplace cette seule phrase, avec le raccord prévu par la chaîne V5.
- Décalage mesuré dû à cette insertion : **+0.240 s**, donc INTRO corrigée **122.980 s**.
- Découpage à partir de **29 pauses numériques de 420 ms** entre **30 phrases**, et validation des indices de phrases dans le texte V5.
- Ce sont des **points de montage audio objectivés**, pas une certification visuelle. L'identité physique des sept médias, leur licence, leurs propriétés graphiques, la synchronisation des sous-titres et le visionnage humain restent à contrôler.
- Le **master complet FR V5 dure 1 h 01 min 48,1 s**, mais cette table ne couvre que l'INTRO. Il serait erroné d'étirer sept images sur toute la narration.

**AVERTISSEMENT HISTORIQUE :** ne jamais faire passer une carte ancienne pour un plan de l'époque révolutionnaire si elle appartient à une autre période (par ex. la carte de Turgot de 1739). La vue doit être explicitement contextualisée.
