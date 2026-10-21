#!/usr/bin/env python3
"""Assemble reviewed Paris05 French audio, with fail-closed approved transition replacement."""
import pathlib,json,subprocess,unicodedata,re,difflib,math
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly
from faster_whisper import WhisperModel
root=pathlib.Path("corrected"); out=pathlib.Path("final-audio");out.mkdir(exist_ok=True)
ids=["INTRO","STOP-01","TRANSITION-01-SEBAI","STOP-SEBAI-1977","TRANSITION-01-02","STOP-02","TRANSITION-02-03","STOP-03","TRANSITION-03-04","STOP-04","OUTRO"]
def norm(t):
 t=unicodedata.normalize("NFKD",t.lower())
 return re.sub(r"[^a-z0-9]+"," ","".join(c for c in t if not unicodedata.combining(c))).strip()
def load(p):
 sr,x=wavfile.read(p);assert x.ndim==1,(p,x.shape)
 x=x.astype(np.float64)/(32768 if x.dtype==np.int16 else 2147483648 if x.dtype==np.int32 else 1)
 return sr,x
def save(p,sr,x):wavfile.write(p,sr,(np.clip(x,-.99999,.99999)*2147483647).astype(np.int32))
seg="TRANSITION-03-04"
source=root/(seg+"-FR-PRONUNCIATION-REVIEW.wav")
sr,x=load(source)
clip_sr,clip=load(pathlib.Path("duel-approved")/"PARIS05-DUEL-TRANSITION-CORRIGEE-A-ECOUTER.wav")
if clip_sr!=sr:
 g=math.gcd(clip_sr,sr);clip=resample_poly(clip,sr//g,clip_sr//g)
text=json.loads(pathlib.Path("docs/pilots/paris-05-fr-v4-tts-and-cues.json").read_text())["segments"]
original=next(s["text"] for s in text if s["id"]==seg)
start_text="À proximité se trouvait autrefois le grand Hôtel de Vendôme."
end_text="Le soir du 30 juillet 1652, cet endroit devient le lieu d’une rencontre armée."
model=WhisperModel("small",device="cpu",compute_type="int8",cpu_threads=4)
chunks,_=model.transcribe(str(source),language="fr",word_timestamps=True,beam_size=2,vad_filter=False)
words=[w for c in chunks for w in (c.words or []) if norm(w.word)]
def seek(target):
 target=norm(target)
 hits=[]
 for n in range(max(1,len(target.split())-2),len(target.split())+3):
  for i in range(len(words)-n+1):
   score=difflib.SequenceMatcher(None,target," ".join(norm(w.word) for w in words[i:i+n])).ratio()
   hits.append((score,i,i+n))
 hits.sort(reverse=True)
 best=hits[0]
 other=max((z[0] for z in hits if z[2]<=best[1] or z[1]>=best[2]),default=0)
 if best[0]<.74 or other>best[0]-.08:raise RuntimeError(f"Unsafe alignment for {target}: best={best} runnerup={other}")
 return best
a=seek(start_text);b=seek(end_text)
assert a[1]<b[1],(a,b)
st=max(0,int(words[a[1]].start*sr));en=min(len(x),int(words[b[2]-1].end*sr))
assert 5<(en-st)/sr<60,(st,en,sr)
fade=min(int(.025*sr),len(clip)//10)
clip=clip.copy()
clip[:fade]*=np.linspace(0,1,fade);clip[-fade:]*=np.linspace(1,0,fade)
revised=np.concatenate((x[:st],clip,x[en:]))
save(out/(seg+"-FR-FINAL.wav"),sr,revised)
parts=[];qa=[]
for name in ids:
 if name==seg:p=out/(name+"-FR-FINAL.wav")
 else:p=root/(name+"-FR-PRONUNCIATION-REVIEW.wav")
 r,audio=load(p)
 assert r==sr,(name,r,sr)
 peak=float(np.max(np.abs(audio)))
 assert peak<1.001
 parts.append(audio)
 qa.append({"segment":name,"seconds":round(len(audio)/sr,3),"peak":round(peak,6)})
joined=np.concatenate(parts)
save(out/"PARIS05-FR-FINAL-11SEG.wav",sr,joined)
report={"status":"TECHNICAL_ASSEMBLY_COMPLETE_LISTENING_END_TO_END_PENDING","segments":qa,"total_seconds":round(len(joined)/sr,3),"approved_context_inserted":{"segment":seg,"start_seconds":round(st/sr,3),"end_seconds":round(en/sr,3),"old_seconds":round((en-st)/sr,3),"replacement_seconds":round(len(clip)/sr,3),"text":"approved horse-market sentence"},"six_prior_pronunciation_splices":"included","editorial_lock":"maintained"}
(out/"QA-FINAL-11SEG.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
