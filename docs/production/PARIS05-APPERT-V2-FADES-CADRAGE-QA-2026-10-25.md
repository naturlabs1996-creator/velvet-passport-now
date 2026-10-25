# Velvet Passport — Paris 05 / Appert — V2 réelle, fondus et cadrage — 25 octobre 2026

## Livrables matériels
- Film V2 FR: `VELVET_PARIS05_APPERT_V2_FONDU_CADRAGE_FR_2026-10-25.mp4`, 7 126 589 octets, 1920×1080, 25 ips, 1008 images, **40,320 s**, SHA256 `480405f232b73dd79b426efdacdc6e10d87575d3dbdb348d44b78afac063594c`.
- Kit projet Kdenlive: `VELVET_PARIS05_APPERT_V2_KDENLIVE_EDITABLE_FR_2026-10-25.zip`, 19 017 209 octets, SHA256 `a970b6029e0888b10d889d899029c783276e155cc3a291719e3c43835c0fa6cb`. Contient projet `.kdenlive` adapté d'un précédent XML, piste vidéo sans son, WAV original FR distinct, source Rijksmuseum, composition photo plein cadre, script de reconstruction des fondus et planche QA.
- Les deux fichiers ont été téléversés vers le dossier Drive de sauvegarde Velvet https://drive.google.com/drive/folders/1UjDt8EGMjTq6byewythwTl8GmmnMMPv7, **retéléchargés et SHA256 revérifiés identiques** (ZIP CRC OK).

## Correction demandée par le client
1. Six cadrages/titres superflus supprimés de la séquence test. Un plan sur le **photomontage réel complet** du Rijksmuseum `RP-F-2007-161`.
2. Tous les personnages apparaissent intégralement; **aucune tête coupée** dans les photogrammes test (0,16 / 2 / 20,16 / 35 / 39,65 s).
3. Très lent travelling numérique (amplification maximale 3,5%) pour éviter statisme et découpe grossière.
4. **Fade in visuel 1,0 s**, **fade out visuel 1,32 s**. **Pas de fade audio**: la voix est un extrait du master validé, qui se poursuit dans la narration intégrale du parcours.
5. Aucune nouvelle image IA. Aucun plan d'immeuble : hors-sujet pour cette séquence, conformément à la demande du client.

## Limites restantes, sans tromperie
- Le projet Kdenlive est **éditable et structure XML validée**, mais **l'ouverture dans l'application Kdenlive n'a pas été testée**, le logiciel n'étant pas installé sur cet environnement.
- Les fondus et le mouvement sont **rendus dans la piste vidéo précomposée**. Pour les modifier, reconstruire le clip via `RECONSTRUIRE_FONDUS.sh` fourni et remplacer la piste vidéo dans Kdenlive. Les fondus ne sont pas des transitions indépendantes du projet.
- QA technique **décodage intégral sans erreur** et durées/empreintes réussies; QA éditoriale humaine **à confirmer**. Pas de validation de diffusion, pas de reçu Mastodon.
- Il s'agit toujours de **40 secondes du stop Appert**, pas des 10 minutes ni du film Paris 05 intégral.

## Étape suivante
Passer au **reste de la narration Appert**, en recherchant les vrais médias pertinents. Ne pas redémarrer les recherches de façade déjà verrouillées. Intégration FR puis EN et contrôle AV avant publication.
