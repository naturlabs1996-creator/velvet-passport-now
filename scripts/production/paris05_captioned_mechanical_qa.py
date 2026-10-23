#!/usr/bin/env python3
"""Mechanical QA on private bilingual caption bundles; no human/legal claims."""
import json,re,sys
from pathlib import Path
lang=sys.argv[1]; assert lang in ('fr','en')
base=Path('review')/lang
srt=base/f'PARIS05-{lang.upper()}-REVIEW.srt'
vtt=base/f'PARIS05-{lang.upper()}-REVIEW.vtt'
stream=base/'streams.txt'
assert srt.is_file() and vtt.is_file() and stream.is_file()
raw=srt.read_text(encoding='utf-8-sig'); assert vtt.read_text(encoding='utf-8-sig').startswith('WEBVTT')
def stamp(t):
 h,m,s,ms=map(int,re.split('[:,]',t))
 return ((h*60+m)*60+s)+ms/1000
pattern=re.compile(r'(?m)^(\\d+)\\n(\\d{2}:\\d{2}:\\d{2},\\d{3}) --> (\\d{2}:\\d{2}:\\d{2},\\d{3})\\n(.+)$')
items=[(int(i),stamp(a),stamp(b),txt) for i,a,b,txt in pattern.findall(raw)]
assert len(items)>100,(lang,len(items))
assert [x[0] for x in items]==list(range(1,len(items)+1))
bad_order=[i for i,x in enumerate(items) if not (0<=x[1]<x[2])]
bad_overlap=[i for i in range(1,len(items)) if items[i][1]<items[i-1][1]]
expected={'fr':3694.30,'en':3750.76}[lang]
assert not bad_order and not bad_overlap
assert max(x[2] for x in items)<expected+2
streams=stream.read_text(errors='replace')
assert 'Subtitle: mov_text' in streams
assert 'Video:' in streams and 'Audio:' in streams
report={'lang':lang,'subtitle_entries':len(items),'last_subtitle_sec':max(x[2] for x in items),'expected_film_sec':expected,'timestamps_valid':True,'track_muxed':True,'rights_cleared':False,'human_proofread':False,'human_av_qa':False,'commercial_release_approved':False,'qa_class':'MECHANICAL_ONLY'}
Path('qa').mkdir(exist_ok=True)
Path(f'qa/PARIS05-{lang.upper()}-MECHANICAL-QA.json').write_text(json.dumps(report,indent=2)+'\\n')
print(json.dumps(report))
