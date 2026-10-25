# Paris 05 — Kdenlive, repères son FR Ernest Appert (QA du 25/10/2026)

**Statut : PREPARATION KDENLIVE / AUCUN RENDU NI TIMELINE CERTIFIEE.** Le travail a été effectué à partir des enregistrements originaux validés; pas de synthèse ou réécriture des narrations.

## Nouveaux livrables
- Paquet : `VELVET_PARIS05_KDENLIVE_MARQUEURS_FR_APPERT_QA_2026-10-25.zip`
- Taille ZIP : **4 421 octets**; SHA-256 : **`8bfa357d9cec96199bb7b4b34b09d3c31e5432fb45774252bb67387d60387e73`**.
- Une copie sur Google Drive, dans la sauvegarde Velvet : https://drive.google.com/drive/folders/1UjDt8EGMjTq6byewythwTl8GmmnMMPv7
- **Backup confirmé par retour depuis Drive et comparaison SHA-256 identique + ZIP CRC OK.** Ceci ne constitue pas un reçu d'ingestion Supabase Mastodon.

### Contenu
1. `KDENLIVE_FR_STOP01_APPERT_MARQUEURS_ASR_A_VERIFIER.json` — **15 marqueurs** à importer dans Kdenlive sur le clip autonome `PARIS05-FR-STOP-01_APPERT-EXACT-PCM24.wav`, format natif `[{"pos":...,"comment":...,"type":1}]`.
2. `FR_APPERT_REPERES_ASR_17.csv` — **17 repères documentaires** dérivés de l'alignement faster-whisper de GitHub Actions **39889321388**, dont 16 horodatages numériques et 15 positions uniques (0s doublé).
3. `SHOTLIST_27_ET_FOURCHETTES_ASR_NON_VALIDEES.csv` — suivi des **27 plans** INTRO + Appert, aucune limite temporelle d'image faussement déclarée approuvée.
4. `MANIFEST_QA.json`, `LIRE_AVANT_IMPORT_KDENLIVE.md`.

### Import et restrictions
- Le maître FR contient INTRO de 0 à 120,92 s, puis STOP-01 de 120,92 à 600,96 s. **Les positions du JSON sont relatives au WAV STOP-01 autonome**, et non au master de 61 minutes. Ne jamais importer sur le mauvais clip.
- Tous les repères portent une mention `ASR À VÉRIFIER` : exactitude humaine à confirmer à l'oreille avant de synchroniser les images.
- **Aucun marqueur EN** (alignement indépendant requis). Aucun visuel fictif, aucun faux portrait, aucun remplacement du verso Rijksmuseum par le verso distinct Carnavalet.
- Pour la photo Wikimedia du bâtiment au 21 rue Louis-le-Grand envoyée par l'utilisateur : l'immeuble est bien identifié; **date, original et licence propres à cette photo restent non authentifiés**. Les lots Commons Rue Quatre Septembre datés 2021-06-14, 2023-06-21, 2025-04-21, 2025-10-05 et 2026-04-18 récupérés et comparés ne correspondent pas au cadrage exact de l'utilisateur; ne leur attribuer ni le cliché, ni l'année.
- Le **photomontage exact du Rijksmuseum RP-F-2007-161** (recto) et la **photo PD de la plaque Louis Dumas** sont des sources physiquement récupérées; le verso exact du Rijksmuseum demeure indisponible.
- Mastodon Supabase ne répond pas à l'interrogation SQL; stockage/catalogue **non certifiés**, gate audiovisuel toujours verrouillé.
- Kdenlive/MLT non installés dans l'environnement ayant créé ces fichiers : la compatibilité du JSON repose sur la documentation du format et doit être testée dans la vraie installation Kdenlive avant approbation.

## Sources
- Alignement ASR : https://github.com/naturlabs1996-creator/velvet-passport-now/actions/runs/39889321388
- Format source Kdenlive : https://fossies.org/dox/kdenlive-26.08.1/markerlistmodel_8hpp_source.html ; https://docs.kdenlive.org/en/cutting_and_assembling/guides.html
- Storyboard de 45 plans : `docs/production/paris05-kdenlive-first-sequences-exact-shotmap-2026-10-24.json`
- Enregistrements FR/EN : `docs/production/PARIS05-KDENLIVE-START-PRODUCTION-RECEIPT-2026-10-24.md`

**DOCTRINE : précision sonore d'abord, images appropriées et droits ensuite, contrôle humain en dernier. Aucun montage de remplissage.**
