# Paris 05 — indépendance des archives : sauvegarde vérifiée (24 octobre 2026)

## Résultat
**Quatre ZIP de sources iconographiques** ont été récupérés via les artifacts GitHub Actions encore disponibles et copiés dans Google Drive sous le répertoire privé `Velvet Passport NOW / MASTODON — Sauvetage provisoire des archives 2026-10-24`.

Chaque ZIP a été **retéléchargé de Google Drive** puis comparé localement à son fichier d'origine : SHA-256 identique pour 4/4 ZIP, structure ZIP contrôlée (CRC / `testzip`). Ensemble : **20 images distinctes**, **53 365 203 octets** de ZIP conservés. Les `provenance.json` sont conservés dans chaque archive ; leurs SHA internes ont été contrôlés contre chaque image.

## Reçus de sauvegarde — ZIP original vs copie récupérée de Drive
| Artifact GitHub | Nombre d'images | Taille ZIP (octets) | SHA-256 ZIP |
|---|---:|---:|---|
| `12470696663` | 15 | 37195083 | `7bebb3cb6c24b9a86ecc16829120d38fc4973eaecd22d030c3019726b2ceaee3` |
| `12470502716` | 3 | 14912516 | `7819256f4446f1e3321716bcfc51ee914fe12ddc0cc761d21d505ad2289d6e12` |
| `12535889502` | 1 | 157181 | `c8fdcd84bcac39831dea6fb66d8fc371abaabaaab63a0ea802bbd7b899dc5fcf` |
| `12545161463` | 1 | 1100423 | `bf30ffcda6ebdca01949a5381eb7fb8600491cd059cc4292fad8eb45f0dbbd8f` |

Registre exhaustif des 20 fichiers, dimensions, hashes et provenance : `MASTODON_PARIS05_GOOGLE_DRIVE_BACKUP_RECEIPTS_2026-10-24.json` (enregistré dans le même dossier privé Drive ; NE PAS le confondre avec une fiche du catalogue Mastodon).

## Inspection éditoriale documentée
- Image `APPERT-NEUF-1867.jpg` (Rijksmuseum `RP-F-2007-161`) : inspection réelle effectuée ; on voit neuf hommes autour d'une table. **Candidat cohérent avec la phrase de narration concernée**, pas encore testé dans le film monté.
- Image `APPERT-CARTE-MARCHAIS-PH19727-90.jpg` : portrait imprimé d'une femme attribué à Appert, légende imprimée dans le bas ; **ne contient PAS le verso exact avec `24 rue Taitbout` et `Ci-devant, 21 rue Louis-le-Grand`**. Ne pas employer comme substitut.
- Tous les visuels demeurent **REVIEW ONLY** pour la conformité commerciale et la synchronisation narrative. Plusieurs autres images du lot ne doivent pas être présentées comme des témoins des scènes spécifiques évoquées.

## Ce que ce résultat certifie / ne certifie pas
✅ **CERTIFIÉ** : quatre copies ZIP privées présentes chez un fournisseur indépendant de Supabase et **relues avec égalité exacte des empreintes**.

❌ **NON CERTIFIÉ** : fichiers physiquement enregistrés dans `mastodon-originals`; fiches Mastodon relues et liées aux stops; sauvegarde *automatique* de toute découverte nouvelle; droits commerciaux; publication Paris 05; sauvegarde/restauration complète du catalogue SQL.

## Prochaine exécution
- Continuer l'ingestion réelle dès que l'accès Supabase fonctionne : vérifier stockage, fiches, importer si absent, relire SHA-256.
- **Ne pas refaire les téléchargements** qui sont déjà sauvegardés ; utiliser ces ZIP comme source de restauration.
- Préserver les données de droits en revue et ne pas déclarer `PRODUCTION-READY`.
