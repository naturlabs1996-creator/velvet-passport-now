# PARIS 05 — REPRISE INTÉGRALE DE LA RÉALISATION AUDIOVISUELLE

**Décision de production : 23 octobre 2026 — REBUILD / NOT DEMO READY.**

## Verdict et périmètre

Les films FR/EN du run `40025579787` et leurs lots d'écoute **ne sont ni une démonstration ni des masters admissibles**. Les 38 plans et 19 présences d'archives par langue ont produit des cartes et images hors contexte, des plages statiques de plusieurs minutes, un manque structurel d'images et l'absence du sujet annoncé par la voix. Les tests précédemment réussis vérifiaient les flux et les durées, **pas la qualité de réalisation**. Ne plus les qualifier de « prêts ».

**Conserver et ne pas retraiter inutilement** la narration Chatterbox dont la qualité vocale a été appréciée. Les pistes originales et l'insert Sebaï restent les références audio. Refaire la direction artistique, les images, le découpage, le montage et la concordance FR/EN à partir du texte effectivement prononcé.

## Direction de film

Une **promenade historique cinématographique** (non une conférence illustrée, non un diaporama de cartes, non une succession de cartons métalliques).

- Pour chaque phrase qui invite à *regarder une photographie précise*, montrer **le document exact à cet instant** ; même règle pour lieu, façade, plan, personne, date et événement. Ne jamais remplacer implicitement une photographie requise par un portrait, une carte ou un monument sans rapport.
- Remplir les passages explicatifs par des images authentiques avec précision d'époque, légende honnête et source, des vues actuelles autorisées, détails de documents, plans annotés seulement lorsqu'ils sont pertinents, ou un traitement graphique documentaire conçu explicitement pour le passage — **pas un carton générique répété**.
- Mouvements subtils et justifiés : recadrages de détails, approche d'une inscription, retours à l'original, transitions de quartier. Une longue narration exige une progression visible ; **pas une image fixe pendant 120 secondes ni un carton pendant huit minutes**.
- Le plan Turgot 1739 **ne figure pas dans les premières secondes par défaut**. Une carte ancienne n'est montrée que quand le texte la rend intelligible (rue, époque, perspective), avec titre/date/légende visibles.
- Pour Appert, présenter la carte de visite et son verso quand ces objets sont nommés, le photomontage des neuf personnalités du Rijksmuseum **RP-F-2007-161** quand il est mentionné, puis les photomontages des *Crimes de la Commune* en signalant clairement qu'il s'agit de **compositions mises en scène**. Ne pas substituer une photographie de rue à l'œuvre d'Appert.
- Pour Laïd Sebaï, **pas de faux portrait, pas de hall inventé** : il faut une représentation sourcée et autorisée de l'adresse, et des documents de contexte pertinents (événements de 1975–1977) avec attribution exacte. La porte actuelle au 23 rue Louis-le-Grand n'a toujours **aucune photographie autorisée ingérée**. L'adresse 23 bis n'est pas une micro-localisation démontrée. En l'état, cette partie est un **blocage créatif**, pas une invitation à remplir huit minutes de cartes-titres.
- Ne jamais faire passer une photo de l'Hôtel Meurice pour une scène de la Kommandantur de l'Opéra en 1944. Les photographies LAPI/Paris Musées aux droits retenus restent exclues.
- Les deux langues nécessitent leur **propre calage aux paroles**. Interdiction de dériver les temps EN du ratio des durées FR.

## Nouvelle chaîne, à la Toyota : qualité en amont

1. **Scripts audio figés** : deux masters exacts FR et EN, insert compris. Débit et interprétation sauvegardés.
2. **Bibliothèque visuelle** : chaque ressource possède ID, fichier exact, résolution exploitable, empreinte SHA-256, source primaire/notice, époque, lieu, sujet et statut de droits. Les images manquantes sont enregistrées et restent bloquantes si elles sont explicitement demandées par la narration.
3. **Storyboards par chapitre** : INTRO, STOP-01, transition, Sebaï, Joséphine, 1944, duel, OUTRO. Décrire l'image réelle ou le traitement documentaire requis pour chaque passage significatif du texte, et non simplement au commencement d'un chapitre.
4. **Edit decision list (EDL)** : chaque plan `start_seconds/end_seconds`, texte prononcé attaché, asset ID exact, découpage/crop, mouvement, légende, crédit et justification. Mesurer la synchro FR et EN sur **leurs propres audios** ; aucun temps inventé. La grille inclut les transitions sans cues VISUAL explicites.
5. **Asset gate + scène gate** : pas d'image hors sujet, pas de carte introduite prématurément, pas de cue « voyez la photo » sans la photo exacte, pas de plan statique long non intentionnel, pas de substitution non documentée, pas de droits incertains représentés comme autorisés.
6. **Réalisation du premier bloc court** : intro + premier extrait Appert seulement lorsque la couverture est complète ; inspection **image ET son à l'écran** avant d'appliquer un modèle aux 11 chapitres. Pas de nouveau rendu complet de 61 minutes pour masquer des trous.
7. **Montage bilingue complet** : fabrication après validation du bloc témoin FR ; synchroniser indépendamment l'EN sur la voix anglaise. Ne pas convertir un modèle français incohérent en deux langues.
8. **Inspection professionnelle** : visionnement réel des raccords/pertinence/rythme/absence de faux-semblants, écoute humaine, relecture des sous-titres et des prononciations, licences commerciales documentées, transcription du verdict. Les tests techniques automatisés ne sont que des préconditions.

## Verrous non négociables

- Pas de reconstitution photographique d'archives par IA ; pas d'image historique inventée.
- Pas de publication commerciale sans revue des droits, preuve des sources et approbation humaine.
- Pas de nouvelle production FR/EN dite « prête » tant que le plan de couverture audiovisuelle et le calage image-parole ne sont pas complets.
- Un sujet annoncé par la voix qui est absent à l'écran est un défaut **bloquant**, pas un défaut cosmétique.
- Ne jamais faire croire qu'une animation de carte ou un long carton de remplacement équivaut à un vrai plan documentaire.
- L'absence d'une pièce chez Bertha doit apparaître avant le lancement du moteur. Sinon **la ligne s'arrête sur ce point**, on ne livre pas un mauvais produit.

## Traçabilité

- Ancienne réalisation rejetée : `40025579787` (FR+EN).
- QA éditoriale négative confirmée : `40034724808`.
- Photomontage exact Appert identifié et téléchargé : Rijksmuseum `RP-F-2007-161`, fichier de l'artifact `12535889502`, original https://id.rijksmuseum.nl/200489498 ; **à valider visuellement et placer au bon instant**.
- `docs/pilots/paris-05-fr-v4-tts-and-cues.json` contient le texte intégral et les cues d'origine ; `docs/production/paris05-measured-master-chapter-timecodes.json` décrit les chapitres audio.
- `docs/production/paris05-visual-ingest-status.json` décrit les 18 archives ingérées mais pas une autorisation éditoriale finale.

**Statut actuel : PREPRODUCTION VISUELLE EN RECONSTRUCTION ; DÉMO NON AUTORISÉE.**
