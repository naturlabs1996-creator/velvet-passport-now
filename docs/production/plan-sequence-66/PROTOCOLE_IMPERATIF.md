# VELVET PASSPORT NOW — LOI DE MONTAGE / PLAN-SÉQUENCE D’ABORD

**Version : 1.0 — 1er novembre 2026**

## Décision permanente de production

**AUCUN FILM, AUCUN RENDU D’ESSAI, AUCUN ASSEMBLAGE AUTOMATISÉ ET AUCUN MONTAGE KDENLIVE avant approbation écrite du plan-séquence pour la langue concernée.**
Ce protocole vise **66 parcours** (Paris 30, Montréal 20, Québec 16), dont **65 autres parcours après Paris 05**. Il s’applique aux 65 à venir, à toutes les reprises de Paris 05 et à leurs versions françaises et anglaises. Aucun plan ne peut être simplement « imaginé » pendant le montage. Le projet existant n’est pas publié par ce dispositif.

## Ordre exclusif des opérations

**A — Sources → B — Plan-séquence → C — Relecture et validation du plan → D — Montage privé → E — QA audio/vidéo → F — Autorisation commerciale indépendante.**

Ne jamais inverser B/C et D. Revenir à B dès qu'un texte, un visuel, son emplacement ou son minutage change. Les autorisations antérieures deviennent caduques si le fichier manifeste change.

## Ce que doit contenir CHAQUE plan

1. ID du parcours, de son chapitre et du plan, numéro et ordre immuables dans la version.
2. **Texte parlé exact**, intégral sur la plage ; segment de silence explicitement indiqué, jamais un mot tronqué.
3. **Début et fin exacts** dans le WAV master original, avec minutage vérifié à l’écoute (pas seulement estimation ASR). Timecodes FR/EN **indépendants** et audio non réenregistré sans décision.
4. **Photographie / gravure / archive exacte** choisie et visible sur la planche, nom de fichier, SHA256, source, cote, description. Aucune image générée artificiellement du passé.
5. Phrase précise justifiant la correspondance narration/image, identité historique/provenance et statut des droits.
6. Mode d'affichage `CONTAIN_SANS_COUPE` (pas de tête/document coupé, pas d'étirement), mouvement discret ou fixe, fondus, durée de maintien et légende.
7. **Sous-titre exact**, prévisualisation mobile, validation du début et de la fin.
8. Statut séparé **à placer → candidate → proposée → APPROUVÉE**, ainsi que validation du raccord vocal et de l’image par le propriétaire.
9. Aucune image répétée involontairement. Une réutilisation intentionnelle exige une justification écrite.

## Trois éléments obligatoires AVANT LE PREMIER RENDU

- Le manifeste JSON **complet** et son tableau photo-à-photo avec les sous-titres et minutages.
- La **planche contact numérotée** de *toutes* les images exactes (une vignette lisible par plan) et les liens vers les fichiers originaux.
- Le **fichier d'approbation distinct** signé par décision explicite de l'utilisateur (parcours, langue, date et empreinte SHA256 du manifeste). Une nouvelle version invalide cette empreinte et oblige une nouvelle validation.

## Règles de vérification

Le validateur refuse le montage si : plan absent, image/source/physique/empreinte absente, transcription non vérifiée, minutage estimatif, plan non approuvé, trou de couverture de la narration, image répétée sans justification, langue manquante, WAV différent, sous-titre non contrôlé ou manifest modifié après approbation.

Pour la **publication**, il exige également les preuves de droits commerciaux pour chaque image. Le contrôle automatique vérifie les déclarations et fichiers ; il ne peut certifier la vérité d'une attribution historique ni remplacer la relecture humaine. Cette vérification doit être intégrée dans **chaque** outil de rendu de l’usine : Python/FFmpeg, Kdenlive et CI. Un script externe qui l'ignore peut encore produire un MP4 ; le branchement global doit être vérifié séparément.

### Commandes du portail de production

```bash
python3 scripts/plan_sequence_gate.py init --route PAR-06 --city Paris --out plans/PAR-06.json
python3 scripts/plan_sequence_gate.py check --manifest plans/PAR-06.json --lang fr --assets-root /CHEMIN/MEDIAS --seal approvals/PAR-06.json --stage montage
# CI et scripts de rendu doivent interrompre l'exécution si la commande ci-dessus échoue.
python3 scripts/plan_sequence_gate.py check --manifest plans/PAR-06.json --lang fr --assets-root /CHEMIN/MEDIAS --seal approvals/PAR-06.json --stage publication
```

### Scellement après approbation (pas automatique)

Après validation explicite par l'utilisateur, un responsable édite `approvals/PAR-06.json` :

```json
{
  "parcours_id": "PAR-06",
  "langues_approuvees": ["fr"],
  "approbateur": "NOM DE LA PERSONNE AYANT RÉELLEMENT APPROUVÉ",
  "date_iso": "2026-11-01T00:00:00-04:00",
  "manifest_sha256": "EMPREINTE SHA256 RÉELLE DU FICHIER MANIFESTE"
}
```

La date et le nom ci-dessus sont un **exemple non signé**. Aucun approbateur ni autorisation n'est présumé. Ne jamais préremplir un sceau valide pour un parcours non revu.

## État initial / registre

- `REGISTRE_66_PARCOURS.csv` : 66 lignes, **tous bloqués avant montage** tant que leur propre plan n'est pas approuvé.
- `plans/PAR-05.json` est un gabarit bloqué, **ne remplace pas** le plan Appert réel de 38 plans retrouvé dans le dossier précédent.
- `plans/*.json` pour les 65 autres parcours : brouillons vides à renseigner depuis les narrations et originaux réels ; **aucun minutage, texte ou image inventé**.
- L'extrait V8 / les 38 fiches Paris 05 ne constituent pas un feu vert pour assembler Paris 05.

## Contrat d'affichage avant validation

Une fiche lisible ou page par plan : **n° plan → photo exacte visible → texte parlé exact → timecode d'entrée/sortie FR/EN → sous-titre → source et droits → cadrage/animation → statut et remarque de validation**. Une planche générale et les originaux restent accessibles. Une simple liste de thèmes ou de photos « utiles » **n'est pas** un plan-séquence.