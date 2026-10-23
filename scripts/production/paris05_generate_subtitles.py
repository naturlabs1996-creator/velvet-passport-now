#!/usr/bin/env python3
"""Generate review-only bilingual SRT/VTT directly from Sebai-integrated WAVs."""
import json,sys
from pathlib import Path
from faster_whisper import WhisperModel
lang=sys.argv[1]
assert lang in ('fr','en')
src=Path('downloaded/master')/f'PARIS05-{lang.upper()}-MASTER-WITH-SEBAI-INSERT-REVIEW.wav'
out=Path('dist/paris05-subtitles');out.mkdir(parents=True,exist_ok=True)
model=WhisperModel('small',device='cpu',compute_type='int8',cpu_threads=4)
segments,info=model.transcribe(str(src),language=lang,beam_size=3,word_timestamps=False,vad_filter=True,condition_on_previous_text=False)
items=[]
for s in segments:
 t=s.text.strip()
 if t:items.append({'start':round(s.start,3),'end':round(s.end,3),'text':t})
def stamp(t,vtt=False):
 ms=round(t*1000);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);sec,ms=divmod(ms,1000)
 return f'{h:02}:{m:02}:{sec:02}{chr(46) if vtt else chr(44)}{ms:03}'
srt=''.join(f"{i+1}\n{stamp(x['start'])} --> {stamp(x['end'])}\n{x['text']}\n\n" for i,x in enumerate(items))
vtt='WEBVTT\n\n'+''.join(f"{stamp(x['start'],True)} --> {stamp(x['end'],True)}\n{x['text']}\n\n" for x in items)
(out/f'PARIS05-{lang.upper()}-REVIEW.srt').write_text(srt)
(out/f'PARIS05-{lang.upper()}-REVIEW.vtt').write_text(vtt)
report={'lang':lang,'source':src.name,'captions':len(items),'status':'ASR_DRAFT_HUMAN_PROOFREADING_PENDING','release_allowed':False}
(out/f'PARIS05-{lang.upper()}-CAPTION-QA.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report),flush=True)
