# Velvet Passport — French of France voice sourcing (2026-10-19)

## Major discovery: no more random Kyutai donor IDs
Mozilla Data Collective distributes **Common Voice Scripted Speech 26.0 — French of France**, released 2026-07-21, dataset ID `cmrumhinj0001md07y3huuhs5`, 166.64 MB.
- Primary source: https://mozilladatacollective.com/datasets/cmrumhinj0001md07y3huuhs5
- Classification: validated clips from contributors with **self-identified French-of-France accent**. Not independently certified individual accent; native listening check still required.
- Dataset has TSV fields `client_id`, `path`, `gender`, `accents`, `sentence` etc. Approximately 368 training clips marked female, 2881 marked male, plus unspecified. Do not equate clips with unique speakers.
- License CC0-1.0: https://commonvoice.mozilla.org/dav/terms. Mozilla prohibits attempting to identify speakers and asks not to redistribute whole or part of dataset on other services, so download only via Mozilla Data Collective and **do not mirror to GitHub**.
- **CRITICAL RIGHTS HOLD**: CC0 copyright license of recordings is NOT, by itself, express permission to impersonate a recognizable speaker in commercially generated cloned narration. Prioritize auditioning source accent samples only for selection and seek actual donor cloning consent before producing synthetic output.
- No candidate has been artistically approved; no new Chatterbox FR synthetic voices may be commercialized without consent clearance.

## Alternative explicit commercial licensing
Spirelight French (European) conversational data: https://www.spirelight.ai/datasets/french-france
- 100 vetted speakers, accent/region/gender metadata and signed commercial training consents.
- Their public commercial license explicitly mentions AI training/evaluation, **not necessarily third-party voice cloning**. Need confirmation of explicit rights for derivative synthetic voice and right to use WAV references in independent Chatterbox. Price listed $95/hour, **no purchase authorized**.
- Other French accents corpus `SilencioNetwork/french-accents-speech` is CC BY-NC and therefore not a free commercial choice; exclude from production.

## Pipeline before next actual French auditions
1. Download official Mozilla corpus under proper access, and inspect TSV locally (do NOT upload corpus).
2. Filter French-of-France, gender categories, sufficient uninterrupted voice from a single contributor; inspect wave quality and accent by listening.
3. Clarify rights for **synthesized cloning output** on specific source before importing a reference into Chatterbox. No speaker identification attempts.
4. After eligible samples and consent, run native Chatterbox v3 1.00, audition, director approves artistic LOCK.
5. Prior Kyutai donor French batches (10 samples) rejected on narration/accent fit. Do not repeat. EN 8935 male and EN 3973 female artistic LOCK per director, rights gate distinct.

Current status: **source identified, specific speakers NOT selected / rights NOT cleared**.
