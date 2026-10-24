# VELVET PASSPORT — Source RTL sur les deux frères / dossier Curiel–Sebaï
**Contrôle : 24 octobre 2026**. Index de source éditoriale, **pas une ingestion Mastodon**, **pas de licence de reproduction audiovisuelle**.

## Référence directe
- **Émission** : RTL, *L'Heure du crime*, « L'INTÉGRALE – Henri Curiel : le mort de l'ascenseur » (présentateur Jean-Alphonse Richard).
- **Page hébergée par RTL sur Dailymotion** : https://www.dailymotion.com/video/xa0sg5a
- **Lien partagé par utilisateur** : https://share.google/PFmNx25H0Fn2oajdd (redirection non vérifiable depuis outil; le titre correspond à la page officielle Dailymotion).
- **Examen** : lecture de la transcription horodatée publiée sur Dailymotion, **pas écoute indépendante de l'enregistrement**.
- **Voix attribuées par la transcription** : Jean-Alphonse Richard, le journaliste Yves Bordenave (Le Monde), William Bourdon, etc. Les étiquettes de locuteur et noms transcrits doivent être revérifiés avant attribution verbatim.
- **Provenance de noms** : Mediapart, Karl Laske, 26 août 2023, nom écrit **Marc Ducarre**, ex-inspecteur du contre-espionnage, cité dans l'enquête sur Curiel/Goldman : https://www.mediapart.fr/journal/france/260823/assassinats-de-pierre-goldman-et-henri-curiel-marc-ducarre-un-drole-de-contre-espion

## Passages RTL utiles / fidélité à la source
| Timecode | Ce que rapporte l'émission | Niveau |
|---|---|---|
| 11:45–11:58 | Expertise établissant la réutilisation du même pistolet 11,43 mm après meurtre de Sebaï | Fait rapporté ; croiser Le Monde, 12 mai 1978 |
| 23:59–24:31 | Détail d'une agression/braquage en 1978 et allusion au « Charlie » des récits posthumes | Récit journalistique et hypothèse d'identité |
| 24:31–25:15 | Garde à vue du **21 octobre 2020**, interrogatoire de l'ancien agent DST, dénégation et remise en liberté sans poursuites immédiates | Émission RTL, distinguer de 1978 |
| **26:12–26:44** | **L'invité affirme explicitement l'existence d'un frère différent**, militant **PFN**, entendu à **Toulon en 1978** à propos d'un attentat contre un local PCF | SOURCE RTL sur existence de deux frères distincts; ne pas présenter « responsable d'attentat » comme condamnation |
| 27:01–27:26 | Hypothèse d'une transmission d'informations DST permettant de localiser Curiel. **L'invité rappelle la présomption d'innocence et la dénégation.** | Soupçon, pas responsabilité prouvée |
| 32:03–32:13 | La transcription automatique dit « Bruno Ducar » pour l'ex-inspecteur | **CONTRADICTION DE TRANSCRIPTION**, pas nouveau prénom vérifié |
| 36:12–36:20 | La transcription dit « Jean Ducard, Marc Ducard » | **CONTRADICTION DE TRANSCRIPTION**, pas nouveau prénom vérifié |
| 39:35–40:12 | Émission fait état de déclassifications de pièces de renseignement 2025–2026 | À croiser avec les avis publiés CSDN / presse documentée |

## ALERTE majeure sur les noms
La **transcription automatique du même épisode** utilise « Marc Ducard » au sujet de l'ancien agent DST à 24:22 ET au sujet du frère PFN à 26:22, puis « Bruno Ducar » vers 32:06 et « Jean Ducard » vers 36:12. Il est donc **incorrect de conclure que le frère s'appelle Marc**, **Bruno** ou **Jean** à partir de cette transcription seule. Le nom orthographié **Marc Ducarre** (ex-DST) est indépendamment corroboré par le titre et l'introduction de Mediapart, 26/08/2023. L'identité nominale du frère demeure **HOLD**.

La ressemblance de deux personnes sur des photos ne permet **aucune authentification d'identité**. Le fichier signalé par l'utilisateur `1000013340.png` demeure **REJECTED_MISATTRIBUTED** pour le portrait de l'ex-agent DST, indépendamment du nom du frère : `docs/production/paris05-sebai-excluded-misattributed-images-2026-10-24.json`.

## Chronologie à NE PAS confondre
1. **2 décembre 1977** : assassinat de Laïd Sebaï à Paris.
2. **4 mai 1978** : assassinat d'Henri Curiel à Paris.
3. **1978** : selon RTL, garde à vue **du frère PFN** à Toulon, dans une affaire distincte (attentat contre un local PCF); la culpabilité n'est pas jugée dans la source fournie.
4. **21 octobre 2020** : selon RTL, garde à vue de **l'ancien inspecteur DST** dans le cadre des investigations Curiel; libération sans poursuites immédiates; il niait toute participation.
5. **2025–2026** : actes de déclassification utiles à l'instruction Curiel.

**Alerte qualité supplémentaire** : la transcription RTL situe parfois Sebaï en « janvier » au tout début, ce qui contredit le **2 décembre 1977** documenté. Ceci montre qu'on ne peut pas la considérer comme transcription de référence finale pour nos dates et noms.

## Usage Velvet et statut Mastodon
- À verser comme **SOURCE_FOUND / CATALOG_PENDING** dans la bibliothèque lorsque Supabase est disponible : URL, titre, type audiovisuel, index timecodé, fiche source.
- Enregistrer les **métadonnées et repères** dans le dépôt; ne pas copier/publier l'intégralité de l'audio ou de la vidéo RTL sans droits.
- **Règle irrévocable** : pas de visage attribué à l'ex-DST; photo antérieure bloquée, aucune image de substitution.
- Cette source peut nourrir une révision **proposée** de la narration, mais **ne réécrit pas les WAV FR/EN verrouillés** sans décision éditoriale.
- **Absence de preuve d'ingestion Mastodon** : statut `INGEST_BLOCKED` tant que Supabase SQL/catalogue n'a pas pu être relu.


## ADDENDUM — 24 octobre 2026 : lecture littérale du panneau photographié et correction de raisonnement
Nouvelle vérification de la photographie d'identité policière remise par l'utilisateur (`1000013340.png`, SHA-256 `1f892f203e6c8ec1371634d9cd0c65d2ae4ab3284eb6bbd379e40d916af6c72d`). **Transcription visible du panneau, sans identification de la personne photographiée :** « M. DUCARRE », « Marc », « 17/02/54 » (lecture probable), « SENS », « N°10 ».

- **La date 17/02/54 ne prouve pas que la photo a été prise en 1954, en 1978 ou en 2020.** Il pourrait s'agir d'une date de naissance, hypothèse non documentée.
- **RTL dit explicitement « 66 ans »** au sujet de l'ancien inspecteur entendu le **21 octobre 2020** ([Dailymotion, transcription 24:31–24:38](https://www.dailymotion.com/video/xa0sg5a)), compatible avec une naissance en 1954. Cette compatibilité **ne prouve pas l'identité du portrait**, mais empêche de le réfuter au seul motif de son ancienneté apparente.
- La transcription RTL parle d'un **frère** au **PFN** entendu en **1978** (26:12–26:44), mais elle transcrit « Marc » pour les deux et introduit d'autres prénoms ailleurs : **on ne peut pas attribuer ce portrait à un frère défini à partir du seul son transcrit, de la plaque, ou d'une ressemblance**.
- Un ancien agent DST pouvait être photographié dans un autre contexte, notamment administratif ou policier. Une pratique habituelle de discrétion professionnelle n'équivaut **pas** à une impossibilité absolue de cliché public ou retrouvé.
- **Statut de production** : pièce exacte **HOLD_UNVERIFIED_ATTRIBUTION** (jamais publiée); son hash et son nom de fichier restent interdits à Paris05. Ne pas bloquer toute photographie contenant le patronyme Ducarre dans l'avenir : un original indépendamment sourcé pourrait être recevable après droits et QA.
- **Mastodon physique** : changement de statut/suppression de lien **non vérifiés** faute de réponse SQL. Le registre de rejet GitHub n'est pas la preuve d'une mutation du stockage.
