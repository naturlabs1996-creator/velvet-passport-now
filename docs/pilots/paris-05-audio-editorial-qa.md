# Paris 05 — audio editorial QA before synthesis

Checked the 8 scripts in `docs/pilots/paris-05-audio-input.json` on 2026-10-16.

## Findings
- All 4 stops have both `fr` and `en` scripts; all 8 contain two paragraphs.
- **Stop 01 (FR/EN):** the second paragraph repeats the 1771 construction, changed ground floor, preserved upper storeys and Appert's first-floor studio already introduced in paragraph one. Merge rather than reading both verbatim.
- **Stop 02 (FR/EN):** catalogue detail in paragraph two may be complementary; review for repeated descriptions before recording.
- **Stop 03 (FR/EN):** both paragraphs begin with the 25 August 1944 assault; avoid recounting the same sequence twice.
- **Stop 04 (FR/EN):** both paragraphs repeat the date, Fronde setting and five-against-five duel; consolidate.
- **Pronunciation review:** Louis-le-Grand, Appert, Malmaison, Kommandantur, III/RMT, Beaufort, Nemours, Vendôme; confirm natural British English and French pronunciation.
- **Audio output:** validate complete narration, no skipped text, no unexpected silence, no pronunciation of markup/abbreviations as code.

## Gate
The source manifest is an *unedited extraction* of the editorial scripts, not an approved recording master. Do not synthesize for release before a non-repetitive FR/EN recording master is reviewed. Preserve all LOCKed historical facts; no historical research reopening. The manual workflow currently points to the unedited source manifest: use it for technical sound checks only, not public release.

## Cost and execution
Kokoro is local/open source; downloading models requires network and compute. The GitHub Actions workflow is manual and may consume billable runner minutes/storage. It has not been run, and no WAV files have been verified.
