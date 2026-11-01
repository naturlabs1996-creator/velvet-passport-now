# VELVET PASSPORT UNCOVERED — Règle durable des parcours utilisables depuis les guides PDF

**Décision éditoriale : 2026-11-01.**  
**Statut : principe produit LOCK / intégration aux PDF non encore exécutée.**  
**Priorité de réalisation inchangée : finaliser Paris 05 puis les 65 autres parcours NOW.**  
**Périmètre :** toute la collection de guides Uncovered, y compris guides déjà vendus et futurs Montréal / Québec, **sans ouvrir de chantier de recherche maintenant**.

## Problème résolu au niveau produit

Le lecteur d'un guide Uncovered n'a pas à inventer son itinéraire à partir d'adresses éparses. Le guide acheté doit fonctionner seul, **sans second achat, sans Paris NOW, sans compte et sans obligation d'utiliser une application dédiée**. L'application NOW peut proposer ultérieurement une expérience enrichie, jamais la fonctionnalité indispensable.

## Livrable inclus dans chaque guide

1. **Index des lieux** avec adresse contemporaine, micro-localisation exacte (façade, cour visible, plaque, angle, ancien emplacement), coordonnées vérifiées, histoire associée et éventuelles restrictions d'accès.
2. **Parcours à pied éditorialisés** de quartier, thématiques ou géographiques selon la réalité des arrêts : point de départ, ordre cohérent, distances et durées de marche **calculées ou vérifiées**, indication du dernier arrêt et d'un éventuel retour. Ne pas imposer la visite de tous les lieux le même jour.
3. **Carte d'ensemble et numérotation** lisibles dans le PDF lui-même, avec une version imprimable et un texte de navigation minimal, indépendants d'un lien tiers.
4. **Un bouton/lien cliquable « Ouvrir le parcours à pied »**, ouvrant une URL Maps officielle, et **un QR code du même lien**, testé sur Android/iOS. Les QR codes complètent les liens, ils ne remplacent pas leur version cliquable.
5. **Un lien de navigation par arrêt**, « M'y rendre », pour commencer au stop voulu, retrouver l'itinéraire après une interruption ou adapter la visite à ses contraintes.
6. **Itinéraires en tronçons** si nécessaires pour garantir toutes les étapes sur mobile. Chaque tronçon a son propre lien et le début du tronçon suivant répète le dernier arrêt du précédent.
7. Mentionner la date de vérification des accès, sans promettre qu'une cour, cave ou propriété privée est visitable. **Ne jamais suggérer une entrée non autorisée.**
8. **Lien de maintenance stable** éventuellement hébergé par Velvet Passport, permettant de corriger les liens à l'avenir sans rendre invalide l'URL imprimée sur le PDF. Ce mécanisme n'est pas encore développé; ne pas l'annoncer comme livré.

## Méthode technique de départ — zéro nouvelle application

Utiliser les **Google Maps URLs** officielles `https://www.google.com/maps/dir/?api=1` avec `origin`, `destination`, `travelmode=walking` et `waypoints` si nécessaires. Les coordonnées numériques validées réduisent les erreurs de géocodage, mais doivent être contrôlées sur la carte **et dans la rue** lorsqu'un arrêt est historiquement complexe.

**Limite officielle :** jusqu'à **3 waypoints** intermédiaires dans les navigateurs mobiles et **9 autrement**; certains produits Google Maps peuvent ignorer les waypoints. Concevoir chaque lien de tronçon pour **au plus 5 arrêts au total** (origine + 3 étapes + destination), et fournir également les liens individuels par arrêt. Si une application ne respecte pas les étapes, le PDF numéroté reste la référence; tester le rendu réel avant diffusion. Les URL sont limitées à **2 048 caractères**. Cette fonction ne nécessite pas de clé Google Maps API pour utiliser des Maps URLs. Sources :
- https://developers.google.com/maps/documentation/urls/get-started
- https://developers.google.com/maps/architecture/maps-url

Exemple **de structure uniquement, pas un itinéraire historique réel** :
```text
https://www.google.com/maps/dir/?api=1&origin=<LAT1%2CLON1>&destination=<LAT5%2CLON5>&waypoints=<LAT2%2CLON2>%7C<LAT3%2CLON3>%7C<LAT4%2CLON4>&travelmode=walking
```

Les PDF ne doivent **pas** inclure des captures non autorisées de fonds cartographiques tiers. Préférer plan original/licencié/autorisé ou liste schématique et liens interactifs.

## Contrôles bloquants avant publication / mise à jour Etsy

- Chaque lieu historiquement attesté; micro-localisation compatible avec l'espace public accessible au promeneur.
- Navigation piétonne testée dans les deux langues proposées, sur smartphone et au minimum dans un navigateur sans l'app Maps.
- Tous les arrêts figurent effectivement dans les liens et dans le bon ordre; décompositions en tronçons sans trou.
- PDF avec lien cliquable, QR scannable et parcours lisible sans connexion.
- Accessibilité des lieux, propriété privée, légalité, sécurité du parcours et alternatives d'observation explicites.
- Pour guides déjà commercialisés : créer une mise à jour ou un compagnon de parcours, et définir la diffusion aux acheteurs selon les possibilités réelles d'Etsy; ne pas promettre une notification automatique sans vérification.

## Limite de mission

**Document de décision seulement**. Aucun nouveau guide Montréal/Québec lancé, aucune recherche historique lancée, aucune page commerciale modifiée, aucune carte ou code QR publié. Les données manquantes (arrêts validés, accessibilité, durées piétonnes) doivent être collectées lorsqu'on reprendra ce lot après l'achèvement prioritaire de Paris 05 et la progression des 65 autres NOW.
