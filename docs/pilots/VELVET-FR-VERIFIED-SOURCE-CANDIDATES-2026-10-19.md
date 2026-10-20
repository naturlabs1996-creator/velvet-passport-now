# Velvet Passport — French source candidates, provenance verified (2026-10-19)

## Concrete FR candidate A: Kyutai `developpeuse-3`
- **Exact source reference (as documented by the official Kyutai Pocket-TTS GitHub issue #166):** `hf://kyutai/tts-voices/unmute-prod-website/developpeuse-3.wav`
- URL: https://huggingface.co/kyutai/tts-voices/blob/main/unmute-prod-website/developpeuse-3.wav
- The Kyutai maintainer confirmed the project selected this recording as French default voice in Pocket-TTS, in issue https://github.com/kyutai-labs/pocket-tts/issues/166
- **Accent-specific approval**: NOT YET determined by listening. Male/female suitability NOT assumed from filename.
- **Commercial voice-cloning right:** NOT established merely by use as Kyutai default; inspect voice-specific licence/consent. Not automatically CC0 (unmute-prod-website is not voice-donations).
- Status: SOURCE IDENTIFIED -> accent listening / rights HOLD. No new Chatterbox cloned audition before gates pass.

## Corpus B: Common Voice French of France
- https://mozilladatacollective.com/datasets/cmrumhinj0001md07y3huuhs5
- Validated audio with self-declared accent from France, including male/female flags.
- Download `common-voice-scripted-speech-26-0-french-33ae1060.tar.gz`, 166.64 MB, via Mozilla Data Collective. Requires direct archive access; cannot extract speaker `client_id` from dataset landing page.
- Narrow to accent labels `Français de France, non marqué par une langue régionale`, `Français de Métropole`, `accent parisien modéré`, `Français de Paris`, `Parisien Classique`; reject narrow regional caricature.
- Filter by `client_id` WITHOUT attempting to identify speakers. Identify several clips from same client to reach suitable reference length.
- CC0 pertains to copyright dedication of recordings. The dataset itself is designed for ASR; explicit off-platform commercial **voice-cloning** rights still need independent assessment before rollout.
- No individual clip IDs or native accent listening results confirmed as of writing.

## Alternative
Kyutai Pocket-TTS ships a French default named `estelle`, documented here: https://github.com/kyutai-labs/pocket-tts . A precomputed voice embedding for Pocket-TTS does NOT automatically constitute a reference WAV importable into Chatterbox, nor prove transferable voice licensing.
- Artistic metadata / commercial right: not verified. Do not claim ready.

## Status
- FR male candidate: NONE accent-and-rights-cleared.
- FR female candidate: NONE accent-and-rights-cleared.
- Specific sample identified: `developpeuse-3`, pending gate, **not** an approved voice.
- EN CC0 8935 male and 3973 female remain artistically LOCK, commercial rights separate.
- Do not fabricate candidate IDs, claim audio ready, or trigger random cloning jobs.

## Selection steps
Acquire lawful reference files, validate precise terms & listening of French metropolitan accent, verify voice type from audio, then create targeted native-tempo 1.00 Chatterbox audition. LOCK editorial scripts untouched.

## Director audition verdict — 2026-10-20
- **FR masculine: developer-1 — ARTISTIC LOCK**, preferred clearly over FabienG after Chatterbox V3 native-tempo audition. Tested in workflow #39431705952.
- Source recording: `https://huggingface.co/kyutai/tts-voices/resolve/main/unmute-prod-website/developer-1.mp3?download=true`.
- FabienG: not chosen for FR male role.
- **FR feminine: developpeuse-3 is promising but NOT artistic LOCK** until explicitly approved.
- EN masculine 8935 and EN feminine 3973 remain artistic LOCK.
- Separate rights clearance for commercial synthesized use remains required. Do not modify editorial LOCK scripts. Native tempo 1.00, no time stretch.

## Director approval — FR female developpeuse-3 — 2026-10-20
- **FR feminine developpeuse-3: ARTISTIC LOCK**, explicitly approved by director. Supersedes prior candidacy-only status.
- Source: `https://huggingface.co/kyutai/tts-voices/resolve/main/unmute-prod-website/developpeuse-3.wav?download=true`.
- French male **developer-1** remains ARTISTIC LOCK; English male **8935** and English female **3973** remain ARTISTIC LOCK.
- All four roles now artistically selected. Commercial synthetic-voice usage rights/individual source consent not thereby cleared: preserve independent legal release gate.
- Preserve locked editorial scripts and Chatterbox V3 native tempo 1.00.
