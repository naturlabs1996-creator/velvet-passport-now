#!/usr/bin/env python3
"""Splice approved standalone voice inserts after the STOP-SEBAI first sentence.
Fail closed unless forced alignment finds the unique initial phrase.
Never overwrite the source FR/EN WAV.
"""
import json, sys, hashlib
from pathlib import Path
import numpy as np, soundfile as sf
from faster_whisper import WhisperModel
lang=sys.argv[1]
assert lang in ("fr","en")
source=Path("downloaded/master")/("PARIS05-FR-FINAL-11SEG.wav" if lang=="fr" else "PARIS05-EN-FULL-11SEG-p232-UNREVIEWED.wav")
insert=Path("downloaded/insert")/f"PARIS05-SEBAI-INSERT-{lang.upper()}-REVIEW.wav"
bounds=json.loads(Path("docs/production/paris05-measured-master-chapter-timecodes.json").read_text())["tracks"][lang]["chapters"]
b=next(c for c in bounds if c["id"]=="STOP-SEBAI-1977")
audio,sr=sf.read(source,dtype="float32")
addition,si=sf.read(insert,dtype="float32")
assert sr==si and audio.ndim==addition.ndim==1
model=WhisperModel("small",device="cpu",compute_type="int8",cpu_threads=4)
start=int(b["start_seconds"]*sr)
excerpt=audio[start:start+int(16*sr)]
import tempfile
with tempfile.TemporaryDirectory() as tmp:
 clip=Path(tmp)/"opening.wav";sf.write(clip,excerpt,sr)
 chunks,_=model.transcribe(str(clip),language=lang,word_timestamps=True,beam_size=3,vad_filter=False)
 words=[w for c in chunks for w in (c.words or [])]
# The word boundary must belong to the FIRST sentence; no guesses.
target="porte" if lang=="fr" else "doorway"
matches=[w for w in words if target in w.word.lower().strip(" .,!?") and 0<=w.start<8]
assert len(matches)==1,[(w.word,w.start,w.end) for w in words]
at=start+round((matches[0].end+0.20)*sr)
assert start<at<start+int(8*sr)
pad=np.zeros(round(sr*.30),dtype="float32")
new=np.concatenate((audio[:at],pad,addition,pad,audio[at:]))
dest=Path("dist/paris05-sebai-integrated");dest.mkdir(parents=True,exist_ok=True)
out=dest/f"PARIS05-{lang.upper()}-MASTER-WITH-SEBAI-INSERT-REVIEW.wav"
sf.write(out,new,sr,subtype="PCM_24")
# verify exact PCM32 rounded original samples pre/post insertion against re-read
read,_=sf.read(out,dtype="float32")
assert np.max(np.abs(read[:at]-audio[:at]))<.000001
assert np.max(np.abs(read[-len(audio)+at:]-audio[at:]))<.000001
extra=len(new)/sr-len(audio)/sr
qa={"language":lang,"status":"TECHNICAL_INSERTION_COMPLETE_HUMAN_LISTENING_QA_PENDING","source_master":source.name,"source_duration_seconds":round(len(audio)/sr,3),"output":out.name,"output_duration_seconds":round(len(new)/sr,3),"insert_duration_seconds":round(len(addition)/sr,3),"added_total_seconds":round(extra,3),"splice_at_original_global_seconds":round(at/sr,3),"source_content_before_after_preserved":True,"original_master_overwritten":False,"rights_and_release_approved":False}
(dest/f"qa-{lang}.json").write_text(json.dumps(qa,indent=2)+"\n")
print(json.dumps(qa))
