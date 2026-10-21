# Velvet Passport NOW — Narration-First Bilingual Standard (LOCK)

## Production rule
Every route is produced in **French and natural British English during the same production cycle**. Both scripts are written for **listening while walking**, not for silent reading or a literal word-for-word translation. Historic facts, micro-locations, uncertainty labels, and chronology remain identical across languages, while syntax, pacing and idioms are localized independently.

## Spoken-text gate — before TTS (mandatory for FR and EN)
1. Write complete natural sentences, with oral rhythm, clear breathing groups, and spoken transitions between stops. Avoid dense subordinate clauses, overlong enumerations, awkward punctuation and telegraphic sentence fragments.
2. Expand **ambiguous abbreviations and acronyms** into intended spoken forms. Do not leave e.g., « M. », « Mme », « Dr », « St », « av. », « no », « c. », initials, Latin shorthand, or obscure institutional acronyms for the TTS to guess. Preserve exact abbreviations in the editorial/source master when important; use a separate `spokenText` for synthesis.
3. Review **dates, centuries, years, street numbers, measurements, currencies, archival codes, ordinals and Roman numerals**. Resolve each into historically accurate, language-appropriate spoken wording where synthesis is likely ambiguous. No unapproved factual reinterpretation (e.g., 1652 must never become 1662). Retain machine-readable fact fields for verification.
4. Maintain a **pronunciation lexicon per route and per language** for proper nouns, historical names, foreign words, streets and unusual vocabulary. Verify with trusted recordings or reference pronunciation where available; hold uncertain readings for targeted audition rather than inventing phonetics.
5. Do not insert human-facing pronunciation instructions or IPA directly into the spoken narration. Keep these in separate `pronunciationNotes`/`lexicon` metadata; use phonetic respelling only when experimentally required by the TTS engine and verify meaning is unchanged.
6. Generate short **targeted auditions** of risky passages before full rendering. Compare synthesized output to a normalized spoken transcript or ASR, inspecting numerals, names, omissions, repeats and unexpected letter-reading.
7. After any phonetic patch, listen to both sides of the join and recheck voice continuity, pacing, clipping and missing words. Run full-segment automated QA and human listen-through before a segment is marked LOCK.
8. The FR and EN performance may differ in sentence length, pauses and timing; **never force identical word counts or timestamps**. Use a shared audiovisual asset pool but independently synchronize cues and subtitles.
9. Do not rewrite approved history merely to solve a pronunciation bug. If the wording is already editorially LOCKed, prefer narrowly scoped `spokenText` normalization / pronunciation lexicon and re-audition; changes to meaning or narration need explicit editorial approval.
10. No route is marked `BILINGUAL_PRODUCTION_READY` unless BOTH `FR_VO_QA_PASS` and `EN_VO_QA_PASS` plus language-specific subtitles and audiovisual sync are complete.

## Common trouble cases
| Editorial notation | Spoken-form principle |
|---|---|
| « M. Appert » | « Monsieur Appert » (if Monsieur is intended) |
| « XVIIe siècle » | « dix-septième siècle » |
| « 1652 » | Expand in French as an unambiguous spoken year as needed; EN natural spoken year; verify the numeral stays unchanged |
| « 21 rue Louis-le-Grand » | Confirm number and street name are naturally spoken, in both languages |
| « 30 juillet 1652 » | Confirm month/day and year are not swapped or mispronounced in EN/FR |
| « BnF », « RCIN », archival cotes | Pronounce or explain only when essential to the *spoken* narrative, otherwise keep in source metadata |
| « Laïd Sebaï », « Ghraieb », « Maïone-Libaude » | Verify proper-name pronunciation by language and lock the approved reading |

## Required per-route QA fields
- `editorialTextFr` / `editorialTextEn`: authoritative content, historically locked
- `spokenTextFr` / `spokenTextEn`: TTS-ready delivery, semantics preserved
- `pronunciationLexiconFr` / `pronunciationLexiconEn`: approved risky terms
- `numberDateQAFr` / `numberDateQAEn`: explicit review outcome
- `targetedAuditionsFr` / `targetedAuditionsEn`: file links and pass/fail
- `fullListenFr` / `fullListenEn`: human signoff
- `visualSyncFr` / `visualSyncEn`: approved against respective final audio

## Paris 05 checkpoint
The French final 11-segment audio artifact exists at GitHub run 39629212549. English narration must be written/performed *for the ear*, not mechanically translated from French. Previously approved French pronunciation splices stay locked unless a verified fault emerges. Full human listening and both completed visual exports remain separate gates.
