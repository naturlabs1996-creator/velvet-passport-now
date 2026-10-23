#!/usr/bin/env python3
"""Measure visual cue times from the locked FR WAV with ASR word timestamps.
No approximate timecodes are exported. Unmatched cues stay UNALIGNED.
"""
import json, re, sys, unicodedata
from pathlib import Path
from difflib import SequenceMatcher
from faster_whisper import WhisperModel

ROOT=Path("dist/paris05-staging")
MASTER=ROOT/"audio/PARIS05-FR-FINAL-11SEG.wav"
SRC=Path("docs/pilots/paris-05-fr-v4-tts-and-cues.json")
BOUND=Path("docs/production/paris05-measured-master-chapter-timecodes.json")
OUT=Path("dist/paris05-sync")
def norm(s):
 s=unicodedata.normalize("NFKD",s.lower())
 return re.sub(r"[^a-z0-9]+"," ","".join(c for c in s if not unicodedata.combining(c))).strip()
def main():
 import soundfile as sf
 wav,sr=sf.read(MASTER,dtype="float32")
 assert wav.ndim==1 and sr>=22050
 chapters=json.loads(SRC.read_text())["segments"]
 boundaries=json.loads(BOUND.read_text())["tracks"]["fr"]["chapters"]
 assert len(chapters)==len(boundaries)==11
 model=WhisperModel("small",device="cpu",compute_type="int8",cpu_threads=4)
 result={"route_id":"VP-PAR-05","master":MASTER.name,"method":"faster-whisper small word timestamps + contextual transcript match","cue_time_type":"ASR_MEASURED_REQUIRES_HUMAN_QA","chapters":[]}
 for ch,b in zip(chapters,boundaries):
  assert ch["id"]==b["id"]
  start,end=b["start_seconds"],b["end_seconds"]
  segment=wav[round(start*sr):round(end*sr)]
  import tempfile
  with tempfile.TemporaryDirectory() as td:
   p=Path(td)/"chapter.wav";sf.write(p,segment,sr)
   chunks,_=model.transcribe(str(p),language="fr",word_timestamps=True,beam_size=3,vad_filter=False,condition_on_previous_text=False)
   words=[w for c in chunks for w in (c.words or []) if norm(w.word)]
  script=ch["text"]
  cues=[]
  for cue in ch["cues"]:
   pos=int(cue["spoken_char_index"])
   # Match the following 8-12 spoken words instead of vague visual labels.
   expected=norm(script[pos:pos+115]).split()[:11]
   target=" ".join(expected)
   choices=[]
   for i in range(len(words)):
    for n in (max(3,len(expected)-2),len(expected),len(expected)+2):
     if i+n>len(words):continue
     actual=" ".join(norm(w.word) for w in words[i:i+n])
     score=SequenceMatcher(None,target,actual).ratio()
     if score>=0.68:choices.append((score,i,n))
   choices.sort(reverse=True)
   best=choices[0] if choices else None
   rival=max((z[0] for z in choices if best and abs(z[1]-best[1])>max(10,best[2])),default=0)
   confident=bool(best and best[0]>=0.82 and best[0]-rival>=0.08)
   cues.append({"type":cue["cue"],"description":cue["detail"],"spoken_char_index":pos,"audio_seconds_global":round(start+words[best[1]].start,3) if confident else None,"status":"ASR_MATCH_PENDING_HUMAN_QA" if confident else "UNALIGNED","match_score":round(best[0],3) if best else None,"alternative_score":round(rival,3)})
  result["chapters"].append({"id":ch["id"],"start_seconds":start,"end_seconds":end,"transcript_words":len(words),"cues":cues})
  print(ch["id"],sum(c["status"]=="ASR_MATCH_PENDING_HUMAN_QA" for c in cues),"/",len(cues),flush=True)
 OUT.mkdir(parents=True,exist_ok=True)
 (OUT/"paris05-fr-asr-synchronized-cues.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
if __name__=="__main__":main()
