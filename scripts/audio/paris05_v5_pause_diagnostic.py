import json,re,sys
from pathlib import Path
import numpy as np,soundfile as sf
v4=json.loads(Path("docs/pilots/paris-05-fr-v4-tts-and-cues.json").read_text())
v5=json.loads(Path("docs/pilots/paris-05-fr-v5-gps-arrivals-tts-candidate.json").read_text())
segments=["INTRO","STOP-01","STOP-SEBAI-1977","TRANSITION-03-04","STOP-04"]
def sentences(text):
 return [s.strip() for s in re.split(r"(?<=[.!?])\s+",text.strip()) if s.strip()]
def gaps(a,sr):
 z=(a==0); d=np.flatnonzero(z[1:]!=z[:-1])+1; starts=np.r_[0,d][z[np.r_[0,d]]]; ends=np.r_[d,len(z)][z[np.r_[0,d]]]
 return [(int(s),int(e)) for s,e in zip(starts,ends) if e-s>=int(sr*.414) and s>0 and e<len(z)]
for seg in segments:
 for kind,manifest in [("v5",v5),("v4",v4)]:
  if seg=="TRANSITION-03-04" and kind=="v4":continue
  p=(Path("downloaded")/seg/f"{seg}-FR-NATIVE-100.wav") if kind=="v5" else (Path("approved-v4")/f"{seg}-FR-PRONUNCIATION-REVIEW.wav")
  with sf.SoundFile(p) as f:
   a=f.read(dtype="float32");sr=f.samplerate
  ss=sentences(next(x for x in manifest["segments"] if x["id"]==seg)["text"])
  gs=gaps(a,sr)
  print(json.dumps({"segment":seg,"version":kind,"seconds":round(len(a)/sr,2),"sentences":len(ss),"expected_pauses":len(ss)-1,"gaps":len(gs),"example_ms":[round((e-s)/sr*1000,2) for s,e in gs[:4]]}),flush=True)
  if len(gs)!=len(ss)-1:
   print("FAIL-CLOSED: unaligned gaps; do not auto-splice",flush=True)
