#!/usr/bin/env python3
"""Generate word-timed subtitle candidates from a real WAV; never claim editorial QA."""
import argparse, json, re, unicodedata
from pathlib import Path
from difflib import SequenceMatcher
from faster_whisper import WhisperModel

def norm(s):
    s=unicodedata.normalize("NFKD",s.lower())
    return re.sub(r"[^a-z0-9 ]+"," ", "".join(c for c in s if not unicodedata.combining(c))).split()

def timestamp(seconds):
    ms=round(seconds*1000);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);s,ms=divmod(ms,1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"

p=argparse.ArgumentParser()
p.add_argument("--audio",required=True)
p.add_argument("--script",required=True)
p.add_argument("--output",default="alignment")
p.add_argument("--model",default="small")
a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
model=WhisperModel(a.model,device="cpu",compute_type="int8")
segments,info=model.transcribe(a.audio,language="fr",word_timestamps=True,beam_size=5,vad_filter=False)
lines=[];words=[];chunks=[]
for seg in segments:
    chunks.append({"start":seg.start,"end":seg.end,"text":seg.text})
    for w in seg.words or []:
        words.append({"start":w.start,"end":w.end,"word":w.word})
        lines.append(f"{len(lines)+1}\n{timestamp(w.start)} --> {timestamp(w.end)}\n{w.word.strip()}\n")
(out/"transcription.txt").write_text(" ".join(c["text"].strip() for c in chunks),encoding="utf-8")
(out/"words.json").write_text(json.dumps(words,ensure_ascii=False,indent=2),encoding="utf-8")
(out/"segments.json").write_text(json.dumps(chunks,ensure_ascii=False,indent=2),encoding="utf-8")
(out/"candidate_word_subtitles.srt").write_text("\n".join(lines),encoding="utf-8")
script=json.loads(Path(a.script).read_text(encoding="utf-8"))
expected=" ".join(s.get("text","") for s in script["segments"])
actual=" ".join(c["text"] for c in chunks)
ratio=SequenceMatcher(None,norm(expected),norm(actual),autojunk=True).ratio()
report={"audio":a.audio,"model":a.model,"word_count":len(words),"segment_count":len(chunks),"script_transcript_similarity":round(ratio,3),"status":"REVIEW_REQUIRED","warning":"Automatic timestamps are candidates, NOT certified; listen, correct transcript and run editorial image/cue QC."}
(out/"QA.json").write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding="utf-8")
print(json.dumps(report,ensure_ascii=False))
if len(words)<50: raise SystemExit("FAIL: too few recognized words")
if ratio < 0.60: raise SystemExit("FAIL: script/transcript mismatch — do not export subtitles")
