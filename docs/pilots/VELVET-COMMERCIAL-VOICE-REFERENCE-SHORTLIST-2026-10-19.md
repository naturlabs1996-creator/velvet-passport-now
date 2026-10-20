# Velvet Passport — Commercial-cleared reference sourcing shortlist
Date: 2026-10-19
Purpose: find audio reference files compatible with local Chatterbox V3 prompt cloning and documented commercial synthetic voice permissions.

## Immediate lead — existing samples
- Liva AI customervoice: https://huggingface.co/datasets/liva-ai/customervoice
- Five ~25-second samples, four women and one man, American English.
- Publisher states voice-cloning, TTS and commercial rights obtained. **Publisher assertion, not independently verified speaker release**. License field is `other`; obtain full license and explicit downstream synthetic narration rights before deploying.
- Different from approved British profiles p232 and p239: not artistically reviewed.

## Suppliers for explicit permission and audition
1. SpeechData.ai — https://www.speechdata.ai/tts-data-collection — custom native-speaker reference recordings, candidate approval, explicit documented commercial consent and WAV delivery.
2. UsergyAI — https://usergy.ai/datasets/tts-voice-library — on-request samples, derivative-voice / synthesis rights and 48kHz WAV claimed.
3. Voices.com — https://www.voices.com/client/how-it-works — casting / licensing projects; individual deal must explicitly allow independent local Chatterbox use; platform-generated voices do not automatically grant export rights.
4. Voice123 — https://support.voice123.com/hc/en-us/articles/44140558377741-AI-and-Text-to-Speech-TTS-guidelines — alternative casting, fees / business email and license restrictions; not an off-the-shelf source.

## Required deliverable
- FR female voice, metropolitan standard French, warm/natural; EN female British natural or international neutral as fallback. Male voices only if currently approved voices cannot be cleared.
- Sample of 20–30 s dry WAV 24 kHz minimum preferred; no music or postprocessing.
- License explicitly names: **off-platform independent Chatterbox TTS voice cloning**, commercial paid heritage-tour narration, local/cloud synthesis, FR/EN languages, worldwide usage, retained generated audio and renewal/termination handling.
- Signed speaker consent and recordings ownership/chain-of-title, attribution requirements, fee/renewal, transfer of generated outputs rights.
- No production release until signed approvals and sample listening.

## Gates
FIND -> SAMPLE-VERIFIED -> SPEAKER-CONSENT-VERIFIED -> COMMERCIAL-CLONE-RIGHTS-CLEARED -> ARTISTIC-LOCK -> PRODUCTION-READY.
Existing voices FR #2 and EN p232/p239 remain artistic-lock only; do not replace without approval.
