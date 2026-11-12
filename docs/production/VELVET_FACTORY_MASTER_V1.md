# VELVET FACTORY — Gabarit maître de production (V1)

**Projet : Velvet Passport NOW — 65 parcours futurs et tous les STOP.**

Cette chaîne est **réutilisable**, mais **ne constitue pas un film terminé**. Elle transforme le traitement répété des plans en opérations contrôlées par un seul manifeste. Elle ne génère ni images IA, ni paroles, ni sous-titres approximatifs. STOP 04 est encore **bloqué pour export final**.

## Ce qui est réellement implémenté

1. **Un moteur unique** pour n'importe quel parcours : un manifeste JSON liste toutes les scènes et leurs plans (photos, films, narrations, sous-titres, transitions, droits et décisions approuvées).
2. **Zéro recadrage** : 1920 × 1080 ; la photo/vidéo est ajustée proportionnellement en `contain`. Lorsqu'une parole est sous-titrée : 1920 × 860 + bande distincte de 220 px. Lorsqu'un plan ne contient réellement aucune parole : 1920 × 1080 sans bande noire réservée.
3. **Cache partagé basé sur SHA-256** : une photo déjà préparée n'est pas recalculée si elle revient dans un autre parcours au même format. Traitement parallèle de plusieurs plans.
4. **Deux modes séparés** : prévisualisations QA (permet de chercher les photos manquantes, sans déclarer un film final) et export contrôlé (refuse un manque d'audio, des sous-titres non synchronisés, un fichier source absent, des droits non validés, un doublon non approuvé ou une ancienne vidéo rejetée).
5. **Audio original des films d'archives** : `archive_original_only`; les éventuelles paroles d'archives exigent des sous-titres fiables. Aucune bande de 220 px vide pendant un commentaire filmé.
6. **Raccords cut / fondu** image et son, avec durées explicitement approuvées, sans durée inventée. Validation technique par un vrai rendu MP4 sur deux plans de test.
7. **Export par plan** possible lorsqu'un plan est verrouillé, sans attendre que tous les autres le soient. **Export du parcours complet** possible uniquement après validation de tous les plans, des voix, des sous-titres, des droits et de la QA.

## Commandes utiles

```bash
pip install Pillow
# ffmpeg et ffprobe doivent être installés
python vp_factory.py preview-batch \
  --manifest STOP04_MANIFEST_FACTORY_QA.json \
  --root sources \
  --output qa_output --workers 4

# Audit final strict : refuse actuellement STOP 04, à juste titre.
python vp_factory.py audit \
  --manifest STOP04_MANIFEST_FACTORY_QA.json \
  --root sources --output qa_output

# Lorsque les plans auront leurs vrais fichiers audio, sous-titres et LOCK :
python vp_factory.py render-plan \
  --manifest ROUTE_FINALISEE.json --root sources \
  --plan-id S20-P01 --output exports
python vp_factory.py render-route \
  --manifest ROUTE_FINALISEE.json --root sources \
  --output exports --workers 3

# Pour plusieurs parcours : un JSON par parcours, cache partagé
python vp_factory.py batch-previews \
  --manifest-dir manifests/ --root sources \
  --output audit_lots/ --workers 4
```

**À noter** : `render-route` n'est pas un bouton magique. La validation préalable exige des durées établies par la narration enregistrée, les vrais sous-titres ASS, l'identité des sources et les transitions autorisées. Aucun verrou ne doit être coché simplement pour contourner le contrôle. La QA humaine demeure nécessaire.

## Test STOP 04 du 11 novembre 2026

- 24 numéros de scène ; **S13 supprimée**, donc 23 scènes actives.
- 10 photographies sources existantes sur 7 scènes + 2 extraits documentaires authentiques = **12 plans prévisualisés**. Ces images sont dans le paquet de sources propres déjà conservé dans Google Drive : `STOP04_SOURCES_PROPRES_SANS_RABOUTAGE_2026-11-10.zip`. Ce gabarit de code ne contient pas leurs originaux.
- Première préparation des 12 plans : **0,52 s** (4 workers sur l'environnement de test); ré-exécution identique : **0,01 s** par réutilisation du cache. Ces chiffres mesurent **la préparation des images**, pas la durée d'export complet ni celle de l'écoute.
- Lot de démonstration de deux manifestes/24 plans : seconde exécution **0,046 s** lorsque le cache est rempli (même machine, même corpus). Le deuxième manifeste était une **copie de test**, pas un nouveau parcours produit.
- **8 tests automatiques réussis** : géométrie portrait/paysage, plein cadre silencieux, refus d'audio absent, refus de doublon, interdiction d'export incomplet, encodage MP4 réel, fondu réel image+audio.
- **88 blocages** sur l'audit final strict STOP 04, notamment l'absence de plans pour plusieurs scènes, les voix/sous-titres et les droits. **Pas de film complet rendu.**

## Scènes et droits

Le manifeste exemple n'est pas un nouveau MASTER éditorial. Il lit les sources connues du STOP 04. Il conserve les zones encore incomplètes en `null` ou `false`. Les permissions d'images muséales et la synchronisation de la bande filmée nécessitent leur propre validation. Ne pas réintroduire les V6/V7 comme sources d'images.

## Chatterbox

Le moteur de voix **Chatterbox Multilingual V3** et les pistes natives existent déjà dans le dépôt et dans Google Drive. Cette chaîne n'en lance pas une nouvelle génération à l'aveugle; elle attend des pistes WAV sélectionnées et validées. La prise S20 T1 native 1.00 est retenue. Les autres prises ont des états de vérification individuels dans le MASTER actif.

## Déploiement aux 65 autres parcours

Chaque parcours reçoit **un seul manifeste** et réutilise ce code intact, avec ses fichiers originaux. Mettre les manifestes dans un dossier permet un audit / pré-cadrage en lot. Un changement validé du moteur se propage ainsi aux parcours suivants sans reprendre chaque projet à la main. La cadence réelle d'export + contrôle humain **n'a pas encore été mesurée** sur un STOP entier ; annoncer une « accélération exponentielle » serait prématuré. Le gain proviendra surtout de l'absence de reprises, du cache et du parallélisme.

## Liens de production permanents

- MASTER actif : https://drive.google.com/file/d/1kim5eBSjCNNUnXjG4MszMySEsbT5LJfb/view
- Paquet source STOP 04 : https://drive.google.com/file/d/1spaKrTYFVya9JrDKWykctG3DHHUBwtC-/view
- Voix Chatterbox natives : https://drive.google.com/file/d/1yCFLnaAu7EksaU8Lx7Rw9V7oYcY82AgA/view
- Code Chatterbox existant : https://github.com/naturlabs1996-creator/velvet-passport-now

**Statut : MOTEUR TECHNIQUE QA TESTÉ, NON DÉPLOYÉ, NE MODIFIE PAS LES FILMS APPPROUVÉS.**
