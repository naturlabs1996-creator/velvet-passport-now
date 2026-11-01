#!/usr/bin/env python3
"""Measure seven Paris 05 V5 INTRO shot cues from real sentence pauses.

Use exact native V5 WAV sample boundaries (420 ms silence between sentences)
and the already approved replacement of INTRO sentence 7, which is the
only intro splice in the newer corrected QA master. No rerender or editing.
"""
import hashlib
import json
import re
from pathlib import Path
import numpy as np
import soundfile as sf

src = Path("intro-source/INTRO-FR-NATIVE-100.wav")
approved = Path("intro-approved/INTRO-Louis-le-Grand-LAST-CHECK.wav")
manifest = json.loads(Path("docs/pilots/paris-05-fr-v5-gps-arrivals-tts-candidate.json").read_text())
text = next(s["text"] for s in manifest["segments"] if s["id"] == "INTRO")
sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s.strip()]
with sf.SoundFile(src) as f:
    assert f.channels == 1 and f.samplerate == 24000 and f.subtype == "FLOAT"
    audio = f.read(dtype="float32")
with sf.SoundFile(approved) as f:
    assert f.channels == 1 and f.samplerate == 24000
    clip = f.read(dtype="float32")
assert len(sentences) == 30
sil = audio == 0
cuts = np.flatnonzero(sil[1:] != sil[:-1]) + 1
start = np.r_[0, cuts]
end = np.r_[cuts, len(sil)]
gaps = [(int(a), int(b)) for a,b in zip(start,end)
        if sil[a] and (b-a) >= 9936 and a>0 and b<len(sil)]
assert len(gaps) == len(sentences)-1, (len(gaps),len(sentences)-1)
mids = [(a+b)//2 for a,b in gaps]
starts = [0] + mids
ends = mids + [len(audio)]
assert all(starts[i] < ends[i] for i in range(len(sentences)))
assert sentences[7] == "La rue Louis-le-Grand que nous allons emprunter porte un nom très monarchique."
old = ends[7]-starts[7]
new = len(clip) + 2*5040 # same 210ms padding as the repaired V5 job
delta = new-old
fixed_starts = [x + (delta if i>7 else 0) for i,x in enumerate(starts)]
fixed_ends = [x + (delta if i>=7 else 0) for i,x in enumerate(ends)]
fixed_len = len(audio)+delta
assert fixed_starts[-1] < fixed_ends[-1] == fixed_len
chosen = [
  (1,"Opéra Garnier — photo historique",0),
  (2,"Rue historique « Février »",3),
  (3,"Carte ancienne",9),
  (4,"Mosaïque des sept personnages",14),
  (5,"Façade architecturale Apple",22),
  (6,"Immeuble W au crépuscule",24),
  (7,"Plaque rue Louis-le-Grand",28),
]
rows=[]
for i,(number,label,idx) in enumerate(chosen):
    out = fixed_starts[chosen[i+1][2]] if i+1<len(chosen) else fixed_len
    t = fixed_starts[idx]
    assert 0 <= t < out <= fixed_len
    rows.append({
        "plan":number, "asset_label":label, "sentence_index":idx,
        "voice_cue":sentences[idx],
        "in_seconds":round(t/24000,3),"out_seconds":round(out/24000,3),
        "duration_seconds":round((out-t)/24000,3)
    })
report={
    "route":"VP-PAR-NOW-05",
    "scope":"INTRO_ONLY",
    "status":"MEASURED_V5_FR_AUDIO_CUES__VISUAL_MEDIA_UNVERIFIED__HUMAN_LISTENING_PENDING",
    "audio_source_run":41238865083,
    "repaired_master_run":41267746528,
    "intro_splice":"Previously approved Louis-le-Grand spoken line reused",
    "source_intro_duration_seconds":round(len(audio)/24000,3),
    "approved_intro_clip_duration_seconds":round(len(clip)/24000,3),
    "intro_splice_delta_seconds":round(delta/24000,3),
    "corrected_intro_duration_seconds":round(fixed_len/24000,3),
    "frames_corrected_intro":fixed_len,
    "source_sample_rate":24000,
    "sentence_count":len(sentences),
    "digital_silence_boundaries_found":len(gaps),
    "remaining_words_note":"Image 7 remains to end of INTRO; STOP-01 begins next.",
    "shots":rows,
    "all_voice_cues":[{"index":i, "text":s,"start_s":round(fixed_starts[i]/24000,3)}
                      for i,s in enumerate(sentences)],
}
Path("intro7-measured").mkdir(exist_ok=True)
Path("intro7-measured/PARIS05-INTRO-7-PLANS-V5-FR-MEASURED.json").write_text(
    json.dumps(report,ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"intro_duration_seconds":report["corrected_intro_duration_seconds"],
                  "splice_delta":report["intro_splice_delta_seconds"],
                  "shots":rows},ensure_ascii=False),flush=True)
