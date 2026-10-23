#!/usr/bin/env python3
"""English full-length PRIVATE review cut; internal image positions editorially provisional.
Exact source audio is muxed unchanged in content; video remains not commercially cleared.
"""
import json, subprocess, hashlib
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import imageio_ffmpeg

F=imageio_ffmpeg.get_ffmpeg_exe()
root=Path("dist/paris05-en-sebai-integrated-review");root.mkdir(parents=True,exist_ok=True)
edl=json.loads(Path("dist/paris05-image-alignment/paris05-fr-image-edl-review.json").read_text())
audio=Path("downloaded/master/PARIS05-EN-MASTER-WITH-SEBAI-INSERT-REVIEW.wav")
sources=[Path("downloaded/archival-main"),Path("downloaded/archival-targeted")]
candidates={}
for folder in sources:
 for p in folder.rglob("*"):
  if p.suffix.lower() in (".jpg",".jpeg",".png"):
   candidates[p.stem]=p
font="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
B=ImageFont.truetype(font,38);S=ImageFont.truetype(font,25)
assets=json.loads(Path("docs/production/paris05-visual-ingest-status.json").read_text())
available={x["id"]:x for x in assets["items"]}
def slate(entry, idx):
 im=Image.new("RGB",(1280,720),(16,23,34));d=ImageDraw.Draw(im)
 aid=entry.get("asset_id");p=candidates.get(aid)
 is_use=entry.get("status") in ("CANDIDATE_REVIEW_ONLY","CONTEXT_ONLY_REVIEW") and aid in available and p is not None
 if is_use:
  try:
   original=Image.open(p).convert("RGB")
   original.thumbnail((1200,520),Image.Resampling.LANCZOS)
   im.paste(original,((1280-original.width)//2,(570-original.height)//2))
  except Exception:is_use=False
 d=ImageDraw.Draw(im)
 d.rectangle((0,0,1280,80),fill=(19,27,40))
 d.text((38,20),"VELVET PASSPORT / PARIS 05 — ENGLISH PRIVATE EDITORIAL REVIEW",font=S,fill=(255,255,255))
 d.rectangle((0,585,1280,720),fill=(19,27,40))
 label=(aid+"  |  ARCHIVAL DOCUMENT / RIGHTS REVIEW PENDING") if is_use else "IMAGE MISSING OR UNLICENSED — EXPLICIT PLACEHOLDER"
 d.text((32,598),label[:86],font=S,fill=(248,203,123))
 caption=entry.get("context_disclaimer") or entry.get("hold_reason") or entry.get("comment") or ""
 d.text((32,639),str(caption)[:95],font=S,fill=(230,232,238))
 d.text((32,681),"NOT FOR RELEASE — English source narration unchanged",font=S,fill=(243,150,151))
 return im,is_use

# English image timing is NOT measured from English speech. Use chapter boundaries
# and openly editorial, evenly spaced picture suggestions for private QA only.
track=json.loads(Path("docs/production/paris05-measured-master-chapter-timecodes.json").read_text())["tracks"]["en"]["chapters"]
by_id={c["id"]:c for c in edl["chapters"]}
events=[]
for b in track:
 ch=by_id[b["id"]]
 visual=[e for e in ch["visual_events"] if e.get("time_seconds") is not None]
 visual=sorted(visual,key=lambda e:e["time_seconds"])
 if not visual:
  visual=[{"asset_id":None,"status":"EDITORIAL_ASSET_HOLD","hold_reason":"No approved location-specific image","comment":"chapter placeholder"}]
 for i,e in enumerate(visual):
  copied=dict(e)
  copied["time_seconds"]=round(b["start_seconds"]+(b["end_seconds"]-b["start_seconds"])*i/max(1,len(visual)),3)
  copied["source"]="EDITORIAL_PROVISIONAL_NOT_ASR_ALIGNED"
  events.append(copied)
events=sorted(events,key=lambda e:e["time_seconds"])
splice=718.94;delta=16.28;last=3750.76
events=[dict(e,time_seconds=round(e["time_seconds"]+delta,3) if e.get("time_seconds") is not None and e["time_seconds"]>splice else e.get("time_seconds")) for e in events]
events.extend([{"time_seconds":splice,"asset_id":None,"status":"EDITORIAL_ASSET_HOLD","hold_reason":"Approved Sebai insert; doorway photograph pending"},{"time_seconds":round(splice+delta,3),"asset_id":None,"status":"EDITORIAL_ASSET_HOLD","hold_reason":"Narration resumes after insert; doorway photograph pending"}])
events=sorted(events,key=lambda e:e["time_seconds"])
filtered=[]
for e in events:
 t=float(e["time_seconds"])
 if not 0<=t<last:continue
 if filtered and abs(t-filtered[-1]["time_seconds"])<0.06:filtered[-1]=e
 else:filtered.append(e)
assert filtered and filtered[0]["time_seconds"]==0
outlist=[];displayed=0
for i,e in enumerate(filtered):
 start=e["time_seconds"];end=filtered[i+1]["time_seconds"] if i+1<len(filtered) else last
 if end-start<0.06:continue
 file=root/f"frame-{i:03}.jpg"
 frame,actual=slate(e,i)
 frame.save(file,quality=88)
 displayed+=int(actual)
 outlist.append((file,end-start))
assert abs(sum(d for _,d in outlist)-last)<0.1
# concat demuxer: final repeated frame prevents truncation of last frame duration
def esc(p):return str(p.resolve()).replace("'","'\\''")
lst=root/"edit-list.ffconcat"
lst.write_text("ffconcat version 1.0\n"+"".join("file '"+esc(p)+"'\nduration "+f"{duration:.3f}"+"\n" for p,duration in outlist)+"file '"+esc(outlist[-1][0])+"'\n")
out=root/"PARIS05-EN-SEBAI-INTEGRATED-PRIVATE-REVIEW.mp4"
cmd=[F,"-hide_banner","-loglevel","error","-y","-safe","0","-f","concat","-i",str(lst),"-i",str(audio),"-map","0:v:0","-map","1:a:0","-c:v","libx264","-preset","veryfast","-crf","29","-pix_fmt","yuv420p","-vsync","vfr","-c:a","aac","-b:a","96k","-t",str(last),"-movflags","+faststart",str(out)]
subprocess.run(cmd,check=True)
report={"insert_audio_integrated":True,"insert_seconds":16.28,"release_approved":False,"internal_image_cue_timing":"EDITORIAL_PROVISIONAL_NOT_AUDIO_ALIGNED","commercial_voice_rights":"PENDING","route_id":"VP-PAR-05","full_length_seconds":last,"language":"en","status":"PRIVATE_REVIEW_NOT_RELEASE_READY","authentic_image_events_rendered":displayed,"total_visual_slides":len(outlist),"master_audio_modified":False,"rights_signoff":False,"warning":"Private documentary edit, not final licensed release, human QA and Sebai insert still pending"}
(root/"review-qa.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
print(json.dumps(report,ensure_ascii=False),flush=True)
