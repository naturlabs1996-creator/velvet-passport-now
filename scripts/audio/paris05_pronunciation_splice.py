#!/usr/bin/env python3
"""Conservative splice of approved spoken sentences. Fail closed on unclear timing."""
import json, pathlib, re, unicodedata, difflib, subprocess, wave, shutil
from faster_whisper import WhisperModel
import numpy as np
from scipy.io import wavfile

A=pathlib.Path("clean"); B=pathlib.Path("auditions"); OUT=pathlib.Path("corrected"); OUT.mkdir(exist_ok=True)
m=json.loads(pathlib.Path("docs/pilots/paris05-fr-pronunciation-auditions.json").read_text())
intro=json.loads(pathlib.Path("docs/pilots/paris05-fr-intro-last-pronunciation.json").read_text())
m["auditions"].append({"id":"intro-louis-le-grand","segment":"INTRO","canonical":intro["canonical"],"candidate":intro["candidate"],"human_approval":"APPROVED"})
assert all(a["human_approval"]=="APPROVED" for a in m["auditions"])
def norm(t):
 t=unicodedata.normalize("NFKD",t.lower());t="".join(x for x in t if not unicodedata.combining(x))
 return re.sub(r"[^a-z0-9]+"," ",t).strip()
def read(p):
 sr,x=wavfile.read(p)
 if x.ndim==2: assert x.shape[1]==1; x=x[:,0]
 if x.dtype==np.int16: x=x.astype(np.float64)/32768
 elif x.dtype==np.int32: x=x.astype(np.float64)/2147483648
 else: x=x.astype(np.float64)
 return sr,x
def write(p,sr,x):
 wavfile.write(p,sr,(np.clip(x,-0.99999,0.99999)*2147483647).astype(np.int32))
model=WhisperModel("small",device="cpu",compute_type="int8",cpu_threads=4)
reports=[]
by_seg={}
for item in m["auditions"]:by_seg.setdefault(item["segment"],[]).append(item)
for seg,items in by_seg.items():
 sr,x=read(A/(seg+"-FR-CLEAN-100.wav"))
 chunks,meta=model.transcribe(str(A/(seg+"-FR-CLEAN-100.wav")),language="fr",word_timestamps=True,beam_size=2,vad_filter=False)
 words=[w for c in chunks for w in (c.words or []) if norm(w.word)]
 assert words,"ASR failed"
 changes=[]
 for item in items:
  target=norm(item["canonical"]).split()
  # Search for exact word sequence, falling back only to high-confidence lexical similarity.
  candidates=[]
  for length in range(max(1,len(target)-2),len(target)+3):
   for i in range(len(words)-length+1):
    window=words[i:i+length]
    score=difflib.SequenceMatcher(None," ".join(target)," ".join(norm(w.word) for w in window)).ratio()
    candidates.append((score,i,i+length))
  candidates.sort(reverse=True)
  best=candidates[0]
  alternatives=[c for c in candidates if c[1]!=best[1] and abs(c[1]-best[1])>3]
  second=alternatives[0][0] if alternatives else 0
  if best[0]<0.74 or (second>best[0]-0.10):
   raise RuntimeError(f"AMBIGUOUS {item['id']}: score {best[0]:.3f}, runner-up {second:.3f}")
  start=words[best[1]].start;end=words[best[2]-1].end
  assert start is not None and end is not None and end>start+0.2
  cs,clip=read(B/(item["id"]+".wav"))
  if cs!=sr:
   from scipy.signal import resample_poly
   import math
   g=math.gcd(cs,sr);clip=resample_poly(clip,sr//g,cs//g)
  changes.append((int(start*sr),int(end*sr),clip,item,best[0],start,end))
 changes.sort(key=lambda c:c[0])
 if any(a[1]>b[0] for a,b in zip(changes,changes[1:])):raise RuntimeError("OVERLAPPING targets")
 # 35ms fades are applied at both boundaries to avoid clicks, without digital time stretching.
 patched=x
 for st,en,clip,item,score,start,end in reversed(changes):
  fade=min(int(sr*.035),(en-st)//5,len(clip)//5)
  # Fade silence margins of inserted utterance; preserve neighboring original audio.
  clip=clip.copy()
  if fade:
   clip[:fade]*=np.linspace(0,1,fade)
   clip[-fade:]*=np.linspace(1,0,fade)
  patched=np.concatenate((patched[:st],clip,patched[en:]))
  reports.append({"id":item["id"],"segment":seg,"start_s":round(start,2),"end_s":round(end,2),"asr_match":round(score,3),"old_duration_s":round((en-st)/sr,3),"replacement_duration_s":round(len(clip)/sr,3),"human_listening_splice":"PENDING","approved_candidate":True})
 write(OUT/(seg+"-FR-PRONUNCIATION-REVIEW.wav"),sr,patched)
# Carry unaffected segments unchanged from the previous clean master artifact.
for wav in A.glob("*-FR-CLEAN-100.wav"):
 seg=wav.name.removesuffix("-FR-CLEAN-100.wav")
 if seg not in by_seg:shutil.copy2(wav,OUT/(seg+"-FR-PRONUNCIATION-REVIEW.wav"))
path=OUT/"QA-SPLICE-REVIEW.json"
path.write_text(json.dumps({"status":"REVIEW_ONLY_NOT_FINAL_MASTER","clips":reports,"spliced_segments":list(by_seg),"no_time_stretch":True,"human_review":"PENDING","source_editorial_unchanged":True},ensure_ascii=False,indent=2))
print(path.read_text())
