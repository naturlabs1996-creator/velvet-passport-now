# VP-PAR-NOW-05 — Rapport de validation éditoriale du Master V4
Date : 2026-10-18
Statut global : **REVIEW ÉDITORIAL — pas de génération audio**
Master audité : docs/pilots/paris-05-recording-master-fr-v4-editorial-assembly.json

## Contrôle structurel
- 11 segments présents dans l’ordre : INTRO, STOP-01 Appert, TRANSITION-01-SEBAI, STOP-SEBAI-1977, TRANSITION-01-02, STOP-02 Joséphine, TRANSITION-02-03, STOP-03 Opéra, TRANSITION-03-04, STOP-04 Beaufort–Nemours, OUTRO.
- 5 stops narratifs, 4 transitions, 1 introduction, 1 conclusion.
- Mots estimés par stop : Appert 1227 ; Sebaï 1876 ; Joséphine 1250 ; Opéra 1299 ; Beaufort–Nemours 2292.
- Environ 125 mots/minute à vitesse réduite, hors pauses et sons : durées projetées d'environ 9,8 ; 15,0 ; 10,0 ; 10,4 ; 18,3 minutes, respectivement. Ce sont des **estimations**, pas une mesure sur WAV.
- Signalisation [LOOK], [AMBIENCE], [PAUSE], [VISUAL] présente dans les scènes longues. Directives à filtrer du texte prononcé avant TTS et transmettre en métadonnées.

## Texte approuvé : ne pas altérer
- STOP-01 Appert : LOCK utilisateur; l'actuel GitHub est une reconstitution longue d'un texte approuvé dans la conversation, comparaison octet par octet avec bloc original non encore effectuée.
- TRANSITION-01-SEBAI : LOCK utilisateur, historique de texte édité dans la conversation.
- STOP-04 Beaufort/Nemours : LOCK utilisateur; scène du duel conservée mot pour mot selon modification éditoriale (Nemours tire, Beaufort pistolet trois balles, Villars/Héricourt, Ris, Élisabeth).
- Sources primaires confirmant le duel : mémoires Grande Mademoiselle https://penelope.uchicago.edu/mlle/chapitre14/chap14.html ; Voltaire https://fr.wikisource.org/wiki/Le_Si%C3%A8cle_de_Louis_XIV/5 .

## Joséphine — adresse corroborée le 18 octobre 2026
- **Confirmation secondaire précise** : Yves Stavridès, « Les mystères de la Laiterie de la reine », *L'Express*, 21 août 2003, https://www.lexpress.fr/culture/art/les-mysteres-de-la-laiterie-de-la-reine_495564.html . L'article désigne explicitement **Paris, 16 rue Louis-le-Grand**, pour la vente commencée **le 24 mars 1819 et jours suivants** de bas-reliefs de la Laiterie de la reine issus des collections de Joséphine.
- L'ouvrage biographique anglais précédemment cité situe la vente « at Malmaison », mais ne concorde pas sur le lieu; il peut y avoir imprécision ou conflation entre provenance des objets et lieu d'adjudication.
- **Décision : blocage H1 d'adresse levé sous réserve de consultation du catalogue primaire**; le stop est **REVIEW**, non LOCK (le nouveau texte n'est pas approuvé et tous ses détails ne sont pas vérifiés).
- Priorité archives : retrouver la page de titre et les conditions de vente du catalogue de mars 1819 afin de consolider la preuve primaire.

## STOP-03 Opéra
- Date et nom de Michel Guillois, blessure de Pierre Gormond, éléments du contexte confirmés par Musée de la Résistance en ligne : https://www.museedelaresistanceenligne.org/media.php?expo=&media=5192
- La narration distingue avec prudence les éléments rapportés par la fille de Guillois de ceux établis séparément.
- **REVIEW**, pas LOCK : détails du véhicule et des archives photo doivent être associés aux images authentifiées avec droits vérifiés.

## STOP-SEBAI-1977
- **REVIEW**, pas LOCK : assemblage narratif reconstruit; revérifier phrases du metteur en scène contre version éditée originale. La piste de l'erreur de personne et les divergences d'ascenseur sont formulées comme hypothèse et désaccord de sources.
- 1975 / novembre 1977 / Curiel / balistique différenciés; éviter de présenter revendications Delta comme démonstration de culpabilité.
- Vérifier âge, date/heure, claims, et l'accès exact 23 / 23 bis sur presse originale.

## Transitions et marche
- INTRO/TRANSITION-01-02/TRANSITION-02-03/TRANSITION-03-04/OUTRO proviennent encore de V3 et ne portent **aucun LOCK**.
- Vérification GPS/micro-loc, transitions sans doublon, durée de marche, points sûrs d'arrêt et accessibilité **non encore effectuées**.
- Passage TRANSITION-03-04 annonce « marché pratiquement désert » et « choisi pour cela » : interprétation non étayée; retirer ou attribuer avant approbation.
- Plusieurs répétitions de phrases-chutes entre stop et transition, à ajuster uniquement sur parties non verrouillées.

## Release
- LOCK confirmé : 3 segments (STOP-01, TRANSITION-01-SEBAI, STOP-04), sous réserve de fidélité aux derniers blocs approuvés.
- REVIEW/HOLD : 8 segments.
- Pas de WAV généré; QA 300 sec/stop non mesurable à cette étape.
- Avant audio : consulter si possible le catalogue primaire STOP-02; faire approuver nouveaux passages; valider assets et micro-locs; rendre Chatterbox; mesurer WAV>=300 sec/stop; QA FR puis EN.

## Décision
NE PAS déclarer « master final validé ». Ceci est un assemblage complet de travail dont l'adresse Joséphine est désormais corroborée par *L'Express*, avec des validations éditoriales encore requises.
