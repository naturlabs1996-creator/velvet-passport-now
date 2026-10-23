# VP-PAR-05 — DOSSIER ADMINISTRATIF DE CLÔTURE
Date : 2026-10-23 | FR + EN

## Décision
**PRODUCTION TECHNIQUE : CLOSE. RECHERCHE ICONOGRAPHIQUE : CLOSE. DROITS ET AUTORISATION COMMERCIALE : HOLD.**

Les deux films privés sous-titrés sont produits et ont passé les contrôles mécaniques indépendants. Les 13 cases d'approbation humaine/commerciale dans `paris05-commercial-release-evidence.json` restent explicitement non approuvées. Aucune signature n'est présumée.

## Pièces au dossier
- Vidéo FR privée avec sous-titres : run 39971437794, artifact 12509346897, durée cible 61:34.30.
- Vidéo EN privée avec sous-titres : run 39971437794, artifact 12509407040, durée cible 62:30.76.
- Contrôle mécanique FR/EN réussi : run 39972792697, artifacts FR 12509482758 / EN 12509857488.
- Sous-titres SRT/VTT : run 39960369921, artifacts FR 12504752777 / EN 12505757867.
- Image search lock : docs/production/PARIS05-IMAGE-SEARCH-LOCK-2026-10-23.md.
- Inventaire de 18 archives : docs/production/paris05-visual-ingest-status.json (RIGHTS REVIEW PENDING).
- Quatre Paris Musées exclus : PH10999, PH11026, PH35284, PH34929.
- Gate publication : scripts/production/paris05_release_gate.py (doit rester bloquant sans preuves).

## Travaux administratifs acceptés comme terminés
1. Numérotation et traçabilité des productions bilingues.
2. Archivage des rapports de QA mécanique.
3. Liste des 18 images, exclusions et remplacements décidés ; interdiction de nouvelle recherche en montage.
4. Liste de contrôle de publication établie, sans faux feu vert.
5. Blocage par défaut de la distribution commerciale.

## Documents de preuve encore requis avant toute vente
- Relecture et corrections des SRT FR/EN, avec références de validation.
- Signature d'écoute humaine de chaque film et de synchronisation image/voix.
- Vérification de chaque image **effectivement présente dans le master destiné à la vente** : source, légende, identité, date, licence, attribution.
- Retrait effectif de toutes les images et façades sans droits suffisants, remplacement documentaire conforme et production d'un nouveau master si nécessaire.
- Preuve des autorisations commerciales de la voix FR et de la voix EN (notamment référence p232).
- Crédits vérifiés et décision explicite de l'éditeur sur les masters finaux.

## Règle d'exécution
Ne pas réouvrir les recherches d'images. Appliquer uniquement les substitutions documentaires prédécidées. Ne pas déclarer publiable une prévisualisation privée. Aucun achat ni contact de licence sans instruction expresse. Les validations humaines et contractuelles ne peuvent pas être remplacées par un test GitHub vert.

## Décision opérationnelle
Statut **CLOSED_FOR_TECHNICAL_ASSEMBLY / COMMERCIAL_HOLD** ; passage à publication seulement lorsque les 13 preuves référencées dans le gate sont fournies et le gate réussit.
