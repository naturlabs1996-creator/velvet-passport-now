# Velvet Passport — Paris 05 — Ernest Appert : V2 fondus, plans recadrés

## État au 25 octobre 2026 — V2 exportée, contrôlée, sauvegardée

Le client a rejeté le cadrage V1 parce que certains plans superflus coupaient les têtes des personnes photographiées. Il a approuvé les fondus discrets comme style Velvet Passport.

**Livrables :**
- `VELVET_PARIS05_APPERT_EXTRAIT_V2_FONDUS_FR_2026-10-25.mp4` — 40,32 s, vidéo 1920×1080, 25 fps, H.264, audio original FR mixé en AAC, **SHA-256 a879033553f0dee477ed995da6b9ee4ef35f315f95cf0f8af8681495b8963e4d**.
- `VELVET_PARIS05_KDENLIVE_APPERT_V2_FONDUS_EDITABLE_2026-10-25.zip` — paquet Kdenlive, images intégrales A et B, 3 clips de montage éditables (avant + transition + après), voix originale WAV, photo source Rijksmuseum, manifeste SHA et guide, **SHA-256 a3ae4d3fdba74d93dfb6e84c05710ae27d611d93b6f1f170e45e83a413ddca02**.

**Corrections appliquées :** 
1. Suppression des gros plans tronquant les personnages. Photo entière du photomontage des neuf hommes, Rijksmuseum RP-F-2007-161, conservée dans les deux cadrages.
2. Plans superflus supprimés : seulement **deux présentations complètes de la même photographie**, avec 1,2 s de fondu enchaîné.
3. **Fondu d'entrée vidéo** de 1,0 s et **fondu de sortie** de 1,2 s. Mix de la voix légèrement fondu aux limites (0,25 s entrée et 0,5 s sortie); WAV original séparé **inchangé**.
4. Aucun visuel du 21 rue Louis-le-Grand ajouté, conformément à la priorité **film, pas une recherche architecturale**.
5. La séquence utilise toujours l'extrait de voix choisi en V1; ses frontières et l'alignement mot/image demandent écoute humaine.

**QA effectuée** : fichier H.264 décodé jusqu'à la fin, durée 40,32 s, vignette à 15 s vérifiée visuellement (aucune tête coupée), ZIP CRC intègre; copies Drive des deux fichiers retéléchargées et les deux SHA-256 égaux aux originaux.

**Sauvegarde :** dossier [MASTODON — Sauvetage provisoire](https://drive.google.com/drive/folders/1UjDt8EGMjTq6byewythwTl8GmmnMMPv7).

**LIMITES / HARD GATE :** 
- Le `.kdenlive` est un XML structuré contenant 3 clips à transitions précomposées, non un fondu paramétrable d'origine dans l'interface. La validation d'ouverture native dans Kdenlive **n'a pas encore été réalisée**, logiciel indisponible dans l'environnement de création. L'image source et le son original sont également inclus pour réédition.
- L'extrait **n'est pas** un film Paris05 complet ou validé; droits commerciaux et ingestion Mastodon Supabase non certifiés; QA éditoriale humaine en attente.
- Ne pas monter les 66 parcours sur le gabarit avant approbation du bloc témoin; ne pas produire de plans superflus.
