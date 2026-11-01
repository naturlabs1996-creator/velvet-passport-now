#!/usr/bin/env python3
"""Transfer already approved pronunciation clips to Paris 05 V5, without TTS.
Fail closed on any script mismatch, ambiguous silent interval or audio format.
This creates a PRIVATE QA master, not a commercial release.
"""
import json,re,hashlib
from pathlib import Path
import numpy as np
import soundfile as sf

ORDER=["INTRO","STOP-01","TRANSITION-01-SEBAI","STOP-SEBAI-1977",
       "TRANSITION-01-02","STOP-02","TRANSITION-02-03","STOP-03",
       "TRANSITION-03-04","STOP-04","OUTRO"]
ROOT=Path("downloaded");OUT=Path("v5-repaired-qa")
def ss(t):
 return [x.strip() for x in re.split(r"(?<=[.!?])\s+",t.strip()) if x.strip()]
def sha(p):
 h=hashlib.sha256()
 with open(p,"rb") as f:
  for chunk in iter(lambda:f.read(1048576),b""):h.update(chunk)
 return h.hexdigest()
def rd(path):
 with sf.SoundFile(path) as f:
  if f.channels!=1 or f.samplerate!=24000 or f.format!="WAV":
   raise RuntimeError(f"Unexpected WAV format in {path}")
  x=f.read(dtype="float32")
 if not np.isfinite(x).all():raise RuntimeError("Nonfinite waveform")
 return x
def gaps(x,label,n):
 z=x==0; d=np.flatnonzero(z[1:]!=z[:-1])+1
 b=np.r_[0,d];e=np.r_[d,len(z)]
 g=[(int(s),int(t)) for s,t in zip(b,e)
    if z[s] and t-s>=9936 and s>0 and t<len(z)]
 if len(g)!=n-1:raise RuntimeError(f"Unsafe pauses {label}: {len(g)} instead of {n-1}")
 return g
def interval(g,first,last,nframes):
 return (0 if first==0 else sum(g[first-1])//2,
         nframes if last==len(g) else sum(g[last])//2)
def exactly(s,query,label,partial=False):
 ids=[i for i,x in enumerate(s) if (query in x if partial else query==x)]
 if len(ids)!=1:raise RuntimeError(f"Ambiguous sentence: {label} {ids}")
 return ids[0]
def surround(c):
 pad=np.zeros(5040,dtype="float32")
 return np.concatenate([pad,c,pad])

v5=json.loads(Path("docs/pilots/paris-05-fr-v5-gps-arrivals-tts-candidate.json").read_text())
v4=json.loads(Path("docs/pilots/paris-05-fr-v4-tts-and-cues.json").read_text())
approved=json.loads(Path("docs/pilots/paris05-fr-pronunciation-auditions.json").read_text())
intro=json.loads(Path("docs/pilots/paris05-fr-intro-last-pronunciation.json").read_text())
context=json.loads(Path("docs/pilots/paris05-duel-transition-corrected-listen.json").read_text())
if context["status"]!="USER_APPROVED_FOR_AUDIO_INTEGRATION":raise RuntimeError("Missing approval")
if any(x["human_approval"]!="APPROVED" for x in approved["auditions"]):
 raise RuntimeError("Missing approved pronunciation")

fixes={}
for row in approved["auditions"]:
 fixes.setdefault(row["segment"],[]).append(row)
fixes["INTRO"]=[{"id":"intro-louis-le-grand","canonical":intro["canonical"]}]
fixes["TRANSITION-03-04"]=[{"id":"duel-transition-approved-context"}]
sourceclips={}
for row in approved["auditions"]:
 if row["id"]!="appert-taitbout":
  sourceclips[row["id"]]=rd(Path("approved-candidates")/(row["id"]+".wav"))
sourceclips["intro-louis-le-grand"]=rd(Path("approved-intro")/"INTRO-Louis-le-Grand-LAST-CHECK.wav")
sourceclips["duel-transition-approved-context"]=rd(Path("approved-duel")/"PARIS05-DUEL-TRANSITION-CORRIGEE-A-ECOUTER.wav")
v4source=rd(Path("approved-v4")/"STOP-01-FR-PRONUNCIATION-REVIEW.wav")
v4ss=ss(next(s for s in v4["segments"] if s["id"]=="STOP-01")["text"])
v4g=gaps(v4source,"V4 approved STOP-01",len(v4ss))
qa={"status":"PRIVATE_PREVIEW_HUMAN_LISTENING_PENDING","source_v5_run":41238865083,
    "approved_v4_run":39605629084,"re_rendered_seconds":0,
    "note":"Only seven previously approved voice fixes transferred. Other dates and years NOT comprehensively checked.",
    "replacements":[],"chapters":[]}
OUT.mkdir(exist_ok=True)
parts=[]
position=0
for seg in ORDER:
 wav=ROOT/seg/(seg+"-FR-NATIVE-100.wav");orig=rd(wav)
 sentences=ss(next(s for s in v5["segments"] if s["id"]==seg)["text"])
 reps=[]
 if seg in fixes:
  gs=gaps(orig,seg,len(sentences))
  for row in fixes[seg]:
   name=row["id"]
   if name=="duel-transition-approved-context":
    start="À proximité se trouvait autrefois le grand Hôtel de Vendôme."
    end="Le soir du 30 juillet 1652, cet endroit devient le lieu d’une rencontre armée."
    i=exactly(sentences,start,name);j=exactly(sentences,end,name)
    if j!=i+3:raise RuntimeError("Approved context is not four contiguous sentences")
    expected=" ".join(sentences[i:j+1]).replace("30 juillet 1652","trente juillet mille six cent cinquante-deux")
    if expected!=" ".join(ss(context["candidate"])):
     raise RuntimeError("Approved transition text differs beyond its date pronunciation")
   else:
    i=exactly(sentences,row["canonical"],name,partial=name=="appert-taitbout")
    j=i
   a,b=interval(gs,i,j,len(orig))
   if name=="appert-taitbout":
    k=exactly(v4ss,row["canonical"],name+" V4",partial=True)
    if v4ss[k]!=sentences[i]:raise RuntimeError("Old approved sentence does not match V5 text")
    x,y=interval(v4g,k,k,len(v4source))
    clip=v4source[x:y].copy()
   else:clip=surround(sourceclips[name])
   if not (0.5<len(clip)/24000<65):raise RuntimeError("Suspicious audio clip length: "+name)
   reps.append((a,b,clip,name))
 reps.sort(key=lambda x:x[0])
 if any(x[1]>y[0] for x,y in zip(reps,reps[1:])):
  raise RuntimeError("Overlapping replacements")
 cursor=0;pieces=[]
 for a,b,clip,name in reps:
  pieces.extend([orig[cursor:a],clip])
  qa["replacements"].append({"id":name,"segment":seg,"original_start_s":round(a/24000,3),
   "original_end_s":round(b/24000,3),"old_s":round((b-a)/24000,3),
   "approved_clip_s":round(len(clip)/24000,3)})
  cursor=b
 pieces.append(orig[cursor:])
 fixed=np.concatenate(pieces)
 parts.append(fixed)
 qa["chapters"].append({"id":seg,"start_s":round(position/24000,3),
  "end_s":round((position+len(fixed))/24000,3),"modified":bool(reps),"source_sha256":sha(wav)})
 position+=len(fixed)
 for a,b,clip,name in reps:
  # 4-second context on either side of the newly inserted segment
  newstart=sum(len(v) for v in pieces[:2*reps.index((a,b,clip,name))]) if False else None
 # Previews handled below from final joined waveform and adjusted offsets

if len(qa["replacements"])!=7:raise RuntimeError("Expected exactly seven approved transfers")
out=OUT/"PARIS05-FR-V5-REUSED-PRONUNCIATIONS-QA.wav"
with sf.SoundFile(out,"w",samplerate=24000,channels=1,format="WAV",subtype="FLOAT") as dest:
 for x in parts:dest.write(x)
with sf.SoundFile(out) as f:
 if f.frames!=position:raise RuntimeError("Output frame count failed")
qa["duration_s"]=round(position/24000,3)
qa["sha256"]=sha(out)
(OUT/"PARIS05-FR-V5-REUSED-PRONUNCIATIONS-QA.json").write_text(json.dumps(qa,ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"status":qa["status"],"fixes":len(qa["replacements"]),
                  "duration_s":qa["duration_s"],"sha256":qa["sha256"]},ensure_ascii=False),flush=True)
