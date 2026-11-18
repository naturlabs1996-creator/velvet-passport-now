#!/usr/bin/env python3
"""Measure real word times for source-first STOP04; no video splicing, no fake cue times."""
import json,re,unicodedata,difflib,sys
from pathlib import Path
from faster_whisper import WhisperModel
ROOT=Path('voice_inputs')
OUTPUT=Path('aligned_output');OUTPUT.mkdir(exist_ok=True)
# Exact approved narrations; only four multi-image scenes require word-level image triggers.
SCENES={
 'S05':{
  'path':ROOT/'S05'/'S05_CHATTERBOX_V3_NATIVE100_T1_QA.wav',
  'cues':[('S05-P01','La perspective d une avenue'),('S05-P02','Deux policiers français se trouvent dans le secteur')]},
 'S06':{
  'path':ROOT/'S06'/'S06_CHATTERBOX_V3_NATIVE100_T1_QA.wav',
  'cues':[('S06-P01','Le contexte est confus'),('S06-P02','Au voisinage de la Kommandantur des coups de feu éclatent')]},
 'S07':{
  'path':ROOT/'S07'/'S07_CHATTERBOX_V3_NATIVE100_T1_QA.wav',
  'cues':[('S07-P01','un balcon du trente huit avenue de l Opéra'),('S07-P02','la voiture des deux policiers')]},
 'S23':{
  'path':ROOT/'S23'/'S23_CHATTERBOX_V3_NATIVE100_T1_QA.wav',
  'cues':[('S23-P01','Les soldats allemands se rendent'),('S23-P02','la foule déploie le drapeau du Reich'),('S23-P03','Plus loin les Parisiens démontent les panneaux')]},
}
def norm(t):
 t=unicodedata.normalize('NFKD',t.lower())
 t=''.join(c for c in t if not unicodedata.combining(c))
 return ' '.join(re.findall(r'[a-z0-9]+',t))
model=WhisperModel('base',device='cpu',compute_type='int8')
result={'schema':'stop04-word-timing/1','method':'faster-whisper base (French) with waveform word timestamps','is_human_approved':False,'notes':'These are model proposals, not locked until listening and transcript review','scenes':{}}
for sid,row in SCENES.items():
 path=row['path']
 if not path.exists():
  raise FileNotFoundError(str(path)+' '+str(list((ROOT/sid).rglob('*.wav'))))
 segments,info=model.transcribe(str(path),language='fr',beam_size=5,word_timestamps=True,vad_filter=False,condition_on_previous_text=False)
 words=[]
 for seg in segments:
  for w in (seg.words or []):
   if w.start is None or w.end is None:continue
   token=norm(w.word)
   if token:words.append({'start':round(w.start,3),'end':round(w.end,3),'text':w.word.strip(),'norm':token})
 cues=[]
 for shot,phrase in row['cues']:
  n=norm(phrase);length=len(n.split())
  candidates=[]
  for i in range(len(words)):
   for k in range(max(2,length-2),min(len(words)-i,length+3)+1):
    txt=' '.join(w['norm'] for w in words[i:i+k])
    ratio=difflib.SequenceMatcher(None,n,txt).ratio()
    candidates.append((ratio,i,k,txt))
  best=max(candidates,default=(0,0,0,''),key=lambda x:x[0])
  score,i,k,raw=best
  cues.append({'plan':shot,'requested_phrase':phrase,'recognized_phrase':raw,'start_seconds':words[i]['start'] if k else None,
   'end_seconds':words[i+k-1]['end'] if k else None,'match_ratio':round(score,4),
   'timing_status':'AUTO_CANDIDATE_REVIEW_REQUIRED' if score>=.72 else 'BLOCKED_UNRELIABLE_TRANSCRIPT'})
 result['scenes'][sid]={'source_artifact_original':str(path),'spoken_words':words,
   'full_transcript':' '.join(w['text'] for w in words),
   'photo_transition_anchors':cues,
   'all_anchor_matches_reliable':all(c['match_ratio']>=.72 for c in cues)}
 print(sid,len(words),[(c['plan'],c['start_seconds'],c['match_ratio']) for c in cues],flush=True)
(OUTPUT/'STOP04_4_SCENES_MOTS_HORODATES_NON_VALIDES.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
# Absolutely no video compilation here.
