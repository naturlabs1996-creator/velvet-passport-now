# Atelier Roger — outils à contrôler avant chaque parcours (LOCK, 26 octobre 2026)

**Aucune nouvelle session de montage sans inventaire des logiciels et présence réelle des médias.**

## Contrôle effectivement exécuté pour VP-PAR-05
- **OK :** Python, FFmpeg, FFprobe, Node.js, npm, Git.
- **OK :** maîtres audio intégrés **FR 3694,30 s** et **EN 3750,76 s**, ouverture des archives WAV et contrôle des durées.
- **OK :** paquet Kdenlive du workprint Appert de **3 min 15 s** ; ZIP intègre ; manifeste SHA-256 conforme ; chemin de chaque média référencé présent ; XML de projet bien formé.
- **Manque dans l'environnement d'assemblage actuel :** **Kdenlive** et **MLT melt**. Aucun test de véritable réouverture de projet dans Kdenlive ni rendu MLT réussi à ce stade. Installer et vérifier sur une machine/régie disposant des logiciels, ou poursuivre seulement des **workprints FFmpeg internes**. Ne pas annoncer un film prêt à publier.
- **HOLD :** les 11 chapitres ne sont pas tous montés/illustrés, Mastodon/Storage et leurs reçus ne sont pas entièrement certifiés, et les droits et contrôles audiovisuels commerciaux ne sont pas approuvés.
- **NOW :** le lecteur bilingue et le contrôle d'accès existent, mais la publication demeure verrouillée.

## Outil exécutable, rapport et guide
Le paquet `VELVET_ATELIER_ROGER_PREFLIGHT_66_PARCOURS_2026-10-26.zip` comprend `preflight.py`, `LIRE_AVANT_DEMARRAGE.md`, `velvet_preflight_result.json`, un contrôle de non-régression et sa sortie. Son exécution sur les vrais fichiers a retourné volontairement **code 2 = BLOCKED** ; les ressources audio et les 13 fichiers du projet de test sont vérifiés. Copie indépendante téléversée dans le dossier de sauvegarde privé Google Drive [Velvet Passport](https://drive.google.com/drive/folders/1UjDt8EGMjTq6byewythwTl8GmmnMMPv7) et **retéléchargée identique** (SHA-256 du ZIP : `362d270e8b28400e3e206e9e2d17774c296270c5a80ee12d682760973eec0e65`).

## Discipline
1. Avant toute opération de production, inventorier matériel/logiciels/source/QA.
2. Pour tout outil manquant : **installer, obtenir ailleurs ou choisir une alternative sûre avant le montage** ; jamais « découvrir » le manque au milieu du parcours.
3. Aucun photomontage artificiel, portrait inventé ou image hors texte.
4. Un logiciel présent sur un autre poste ne justifie pas de le déclarer installé **ici**.
5. Exiger la présence du kit documentaire complet, puis montage FR/EN, QA, NOW.
6. Mesure de progrès : **minutes de films validées et parcours finis**, pas nombre de recherches ou de fichiers.
