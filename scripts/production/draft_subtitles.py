#!/usr/bin/env python3
"""Produce draft SRT with faster-whisper; manual comparison to locked scripts required."""
import argparse,json
from pathlib import Path
def timestamp(s):
 n=round(s*1000);h,n=divmod(n,3600000);m,n=divmod(n,60000);sec,ms=divmod(n,1000)
 return f"{h:02}:{m:02}:{sec:02},{ms:03}"
def main():
 p=argparse.ArgumentParser();p.add_argument("--audio",required=True);p.add_argument("--language",required=True,choices=["fr","en"]);p.add_argument("--out",required=True,type=Path);a=p.parse_args()
 from faster_whisper import WhisperModel
 model=WhisperModel("small",device="cpu",compute_type="int8")
 segments,_=model.transcribe(a.audio,language=a.language,word_timestamps=True,beam_size=3)
 cues=[];wordgroup=[]
 def flush():
  if wordgroup:cues.append((wordgroup[0][0],wordgroup[-1][1]," ".join(w[2] for w in wordgroup)));wordgroup.clear()
 for s in segments:
  if not s.words:flush();cues.append((s.start,s.end,s.text.strip()));continue
  for w in s.words:
   if not w.word.strip():continue
   if wordgroup and (w.end-wordgroup[0][0]>5.5 or sum(len(z[2]) for z in wordgroup)+len(w.word)>75):flush()
   wordgroup.append((w.start,w.end,w.word.strip()))
 flush();a.out.parent.mkdir(parents=True,exist_ok=True)
 a.out.write_text("\n\n".join(f"{i}\n{timestamp(start)} --> {timestamp(max(end,start+.05))}\n{text}" for i,(start,end,text) in enumerate(cues,1))+"\n",encoding="utf8")
 qa={"language":a.language,"cues":len(cues),"status":"DRAFT_NOT_APPROVED","required":"Verify against editorial master, correct proper names, omissions and timing"}
 a.out.with_suffix(".qa.json").write_text(json.dumps(qa,indent=2))
 print(json.dumps(qa,indent=2))
if __name__=="__main__":main()
