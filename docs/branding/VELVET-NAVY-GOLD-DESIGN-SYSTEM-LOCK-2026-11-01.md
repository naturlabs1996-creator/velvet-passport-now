# Velvet Passport — identité visuelle permanente : BLEU NUIT + OR

**Décision utilisateur : 1er novembre 2026.**  
**Périmètre :** site Velvet Passport / Paris NOW, application NOW, visionneuse de films, modules de parcours, écran d'activation, pages documentaires et panneaux auxiliaires.  
**Sont exclus :** Parent Ready, Red Elephant, laboratoire vocal, documents historiques, médias photographiques, audio de narration et logique de paiement.

## Couleurs maîtresses (source de vérité : app/globals.css)

| Jeton CSS | Valeur | Usage |
|---|---|---|
| `--vp-navy-deep` | `#071626` | Fond profond, barre de navigation, viewer |
| `--vp-navy` | `#0D233A` | Fond du site |
| `--vp-navy-surface` | `#17324B` | Cartes et panneaux |
| `--vp-navy-raised` | `#21405C` | Surfaces surélevées/états actifs |
| `--vp-gold` | `#CBA34B` | Lignes, bordures, CTA principaux |
| `--vp-gold-highlight` | `#E1BF73` | Accents typographiques légers seulement |
| `--vp-text` | `#F4F4F0` | Texte principal sur bleu |
| `--vp-muted` | `#C2CFDB` | Texte secondaire sur bleu |
| `--vp-border` | `rgba(203,163,75,.42)` | Séparateurs dorés |
| `--vp-ice` | `#E8EFF6` | Panneaux clairs secondaires, jamais beige |
| `--vp-ink` | `#0B2239` | Texte foncé sur or et gris bleu pâle |

## Règles permanentes

1. **Bleu nuit visible sur chaque page**, sans substitution par un noir uniforme ou brun.
2. **Lignes et filets dorés** dans l'interface des films, cartes et éléments de navigation. L'or des appels à l'action doit être suffisamment soutenu, pas un jaune crème.
3. Le clair n'est pas interdit à l'intérieur de formulaires/cartes, mais il devient **bleu glacé**, pas beige ou jaune paille.
4. **Conserver l'accessibilité** : texte clair sur bleu foncé et bleu foncé sur or, contrastes vérifiés sur mobile et bureau.
5. **Le viewer adopte la même palette**, y compris langue, chapitres, contrôles et cadre, FR/EN.
6. Ne jamais recoloriser les **photographies, archives historiques, étiquettes d'époque ou images de films**. Le thème s'applique au cadre du lecteur et à l'habillage, pas au contenu documentaire lui-même.
7. Préserver les couleurs d'**urgence médicale ou d'avertissement** : rouge, vert, ambre restent des signaux sémantiques clairement distincts de la marque.
8. Toute nouvelle page, app, viewer ou module Velvet Passport doit réutiliser les jetons `--vp-*` plutôt que des couleurs codées localement.
9. Aucun déploiement de production sans test de compilation et revue visuelle (mobile + desktop). Un build réussi ne prouve pas l'accessibilité ni la conformité commerciale.
10. Si le MP4 est destiné à être exporté hors site, son **habillage vidéo** bleu/or est une étape de montage distincte du CSS du viewer; ne pas confondre les deux.

## Mise en œuvre

Branche de préparation : `design/velvet-navy-gold-unified-2026-11-01`.  
Cette première révision modifie les feuilles de style uniquement, sans toucher aux textes, images, audios ni services externes. Revue de la version Preview et tests des pages publiques/privées nécessaires avant fusion dans `main`.
