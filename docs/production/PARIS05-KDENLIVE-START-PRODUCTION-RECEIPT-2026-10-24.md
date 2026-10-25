# VELVET PASSPORT — Paris 05 — séance de fabrication Kdenlive : reçu technique 2026-10-24

## Décisions conservées
- **Kdenlive = éditeur retenu** pour Paris 05 puis les 65 autres parcours.
- **Film long rejeté** : aucun recyclage des coupes visuellement trompeuses, des images absentes, du plan Turgot 1739 en ouverture, ou de faux portraits.
- **Aucun export de film final/démo validé** : Kdenlive/MLT non installés dans le conteneur de production et plusieurs images/provenances/droits encore manquants; Mastodon SQL inaccessible.
- **FR maître préservé**, EN non approuvé à l'écoute; sauvegardes = sécurité technique, pas validation éditoriale.

## Actifs matériels réellement préparés et revérifiés

### Images historiques — kit de 20 images
- ZIP : `VELVET_PARIS05_KDENLIVE_GATE0_ASSETS_2026-10-24.zip`
- **53 797 538 octets**, SHA-256 `edb1548d9ff24cc6f862f41ba88e3ef83f1813e3bd715ae86f45891438fad165`, 33 membres de ZIP, CRC OK.
- **20/20 images JPEG originales** intactes, inventoriées SHA-256, provenance et droits non inventés.
- Inclus : 27 plans éditoriaux INTRO/APPERT indexés (offsets au script FR, **pas** des timecodes de la voix).
- Copie vérifiée par retéléchargement depuis Google Drive : identique au ZIP local SHA-256.
- Fichier autonome à importer dans le chutier Kdenlive, **pas** projet `.kdenlive` prêt.

### Voix complètes, originales, insert Sebaï intégré
Archives GitHub Actions `39954802793` :
1. FR : ZIP `PARIS05-FR-SEBAI-INTEGRATED-REVIEW-AUDIO-artifact.zip`, **206 163 420 octets**, SHA-256 `ce3bb7d41b84befebab089d3447f26cd6723221b2fbe0fc3cc4f450e91ebd350`. WAV source `PARIS05-FR-MASTER-WITH-SEBAI-INSERT-REVIEW.wav`: **3694,30 s**, 24000 Hz, 24 bits PCM, mono.
2. EN : ZIP `PARIS05-EN-SEBAI-INTEGRATED-REVIEW-AUDIO-artifact.zip`, **227 038 889 octets**, SHA-256 `a767d88a18f12726b1c2cff86d273c036e69350aec54105721bcc62e4c3104f5`. WAV source `PARIS05-EN-MASTER-WITH-SEBAI-INSERT-REVIEW.wav`: **3750,76 s**, 24000 Hz, 24 bits PCM, mono.
3. Deux archives trop volumineuses pour upload Drive direct. Séparation **sans altération** en **5 parties FR + 5 parties EN** de 45 MiB maximum; conservation privée sur Drive avec `SPLIT_MANIFEST.json` et `REASSEMBLE.py`. **10/10 parties téléchargées de nouveau depuis Drive; chaque partie SHA-256 vérifié, et reconstitution des 2 hashes ZIP originaux vérifiée**. Les ZIP sources d'origine ont passé le contrôle CRC.
4. Sauvegarde de la voix **techniquement vérifiée** : **pas de reçu Mastodon**, **pas d'approbation EN**.

### Bandes Kdenlive du premier bloc, extraites à l'échantillon près (sans réencodage)
- FR pack ZIP `VELVET_PARIS05_KDENLIVE_AUDIO_FIRST_BLOCK_FR_2026-10-24.zip`, **33 904 977 octets**, SHA-256 `11596939e6aea933ac0bb9ad2ca5429796b39e326c8a8e658a33dc21c0c8ac4d`.
  - FR INTRO **120,92 s**, SHA-256 WAV `56e90ba5cb3f05105573549372c0e99073a0981652163b322a3ded0eddab783c`.
  - FR STOP-01 APPERT **480,04 s**, SHA-256 WAV `e7dd257a936e99381651b5a459ac1b0d08a15224c0f7e0ce3211dfac8aec8140`.
- EN pack ZIP `VELVET_PARIS05_KDENLIVE_AUDIO_FIRST_BLOCK_EN_2026-10-24.zip`, **36 880 573 octets**, SHA-256 `a73b124b7c3b089ed5cc7e313dac516dff1c2cab3667ed9b65491716d021b311`.
  - EN INTRO **129,56 s**, WAV `f791805cda4934caee0a94b2365ef0446ad27e64fc0b4446234c9f1c7aff2b43`.
  - Après INTRO EN conserver **1,2 s de silence original**; STOP-01 EN démarre à **130,76 s**.
  - EN STOP-01 APPERT **477,40 s**, WAV `cdefd138f41915615398d8f5eb583a09068b796d7baa89827e9bf02da19bcda8`.
- **Les deux ZIP de premier bloc sont sauvegardés dans Drive et retéléchargés : SHA-256 identiques; archives CRC OK.**
- Cues images FR/EN **NON synchronisés**; chapter cuts vérifiés, pas ébauche de film présentée comme prête.

### Nouveau verso E. Appert authentique retrouvé — musée Carnavalet
- Musée Carnavalet / Paris Musées, carte **Marie Jeanne Moussu**, inventaire **PH19727-150**, photo du **verso** provenant de source institutionnelle publique : https://www.parismuseescollections.paris.fr/fr/musee-carnavalet/oeuvres/portrait-de-marie-jeanne-moussu-pris-a-la-prison-des-chantiers-a-versailles
- Fichier original récupéré : `APPERT-VERSO-CARNAVALET-PH19727-150-CANDIDATE.jpg`, **180 275 octets**, SHA-256 `0060eea66dc1258de4c22f6c9ad5f25083394c3ab61da8b878be1382366be7ab`.
- **Vérification visuelle humaine** : image représente effectivement le verso avec « 24, rue Taitbout » et « Ci-devant, 21, rue Louis-le-Grand »; en haut nom manuscrit « Lemoussu ».
- Page du musée annonce **CC0**; provenance et conditions pour montage commercial final encore à signer dans le registre interne.
- **ATTENTION** : **ce n'est PAS le verso du photomontage de neuf hommes RP-F-2007-161 conservé au Rijksmuseum** auquel la narration originale attribue la carte. Les images sont physiquement distinctes. Ce visuel ne peut être posé sur les cues 023–025 **sans attribution explicite honnête et décision éditoriale** (la narration dit « conservée au Rijksmuseum »).
- Artifact d'acquisition `12582931212`, run Github Actions `40151563988`; ZIP source `PARIS05-APPERT-VERSO-CARNAVALET-SOURCE-REVIEW.zip`, SHA-256 `ca7aecbba05d52faaccfbd021b2fb17587f17c342613fe2a61d6cd9d80741568`, **172 927 octets**. Sauvegarde Drive retéléchargée / SHA identique et ZIP CRC OK.

## Références d'exploitation
- Dossier Google Drive sécurisé: https://drive.google.com/drive/folders/1UjDt8EGMjTq6byewythwTl8GmmnMMPv7
- Storyboard enrichi **45 plans**: `docs/production/paris05-kdenlive-first-sequences-exact-shotmap-2026-10-24.json`.
- Preflight professionnel: `scripts/production/paris05_professional_preflight.py`.
- Précaution grave : un ZIP/Drive/GitHub n'est jamais un certificat d'ingestion live Mastodon Supabase.

## Prochain blocage exact
1. Catalogage physique Mastodon avec relecture des 20 photos + nouvel Appert, toujours bloqué par Supabase.
2. Photo authentique actuelle du **21 rue Louis-le-Grand**; ouverture actuelle pour rues; autre visuel du STOP-01.
3. Pour l'instant, **Rijksmuseum exact verso numérique manquant**; la carte Carnavalet est solution authentique mais ne peut être attribuée au Rijksmuseum.
4. Licences / droits commerciaux signés; cues réels image↔voix FR/EN; enfin véritable projet `.kdenlive` ouvert et contrôlé sur banc Kdenlive.
5. Dernier préflight GitHub `40137411333` : bloque le rendu long pour les bonnes raisons.

## VERDICT
`MEDIA_KIT_AND_AUDIO_BLOCKS_AND_INDEPENDENT_DRIVE_BACKUP_VERIFIED` — **AV READY = FALSE / MASTODON VERIFIED = FALSE / RELEASE LOCK = TRUE.**
