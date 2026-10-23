#!/usr/bin/env python3
"""Produce private short audiovisual QA contact-reel from locked French master.
Synthetic labeled placeholder cards, not purported historical visuals.
"""
import json, subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg
FFMPEG=imageio_ffmpeg.get_ffmpeg_exe()

ROOT=Path("dist/paris05-image-alignment")
edl=json.loads((ROOT/"paris05-fr-image-edl-review.json").read_text())
audio=Path("downloaded/master/PARIS05-FR-FINAL-11SEG.wav")
out=ROOT/"paris05-fr-private-contact-reel.mp4"
clips=ROOT/"clips";clips.mkdir(parents=True,exist_ok=True)
font="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
bold="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
f=ImageFont.truetype(font,40);big=ImageFont.truetype(bold,67);sm=ImageFont.truetype(font,29)
files=[]
for idx,chapter in enumerate(edl["chapters"]):
 start=chapter["start_seconds"]
 duration=min(8.0,chapter["end_seconds"]-start)
 if duration<3:raise ValueError("Unexpected short chapter")
 im=Image.new("RGB",(1280,720),(19,28,40));d=ImageDraw.Draw(im)
 d.text((70,65),"VELVET PASSPORT NOW  |  INTERNAL QA PREVIEW",font=f,fill=(212,220,232))
 d.text((70,172),f"{idx+1:02d}  {chapter['id']}",font=big,fill=(255,255,255))
 d.text((70,310),"Audio: locked French master (real excerpt)",font=f,fill=(228,233,241))
 d.text((70,370),f"Measured source start: {start:.2f} seconds",font=f,fill=(228,233,241))
 holds=sum(e["status"]=="EDITORIAL_ASSET_HOLD" for e in chapter["visual_events"])
 d.text((70,460),f"Visual review: {len(chapter['visual_events'])} events | {holds} explicit holds",font=f,fill=(240,200,142))
 d.text((70,560),"PLACEHOLDER — NO HISTORICAL IMAGE DISPLAYED",font=sm,fill=(251,150,150))
 d.text((70,615),"No publication · No rights granted · No source master changed",font=sm,fill=(196,200,206))
 slide=clips/f"{idx:02d}.png";im.save(slide)
 clip=clips/f"{idx:02d}.mp4"
 cmd=[FFMPEG,"-hide_banner","-loglevel","error","-y","-loop","1","-framerate","25","-i",str(slide),"-ss",str(start),"-t",str(duration),"-i",str(audio),"-c:v","libx264","-preset","ultrafast","-crf","28","-pix_fmt","yuv420p","-c:a","aac","-b:a","96k","-ar","24000","-shortest","-t",str(duration),str(clip)]
 subprocess.run(cmd,check=True)
 files.append(clip)
lst=clips/"concat.txt";lst.write_text("".join("file '"+p.name+"'\n" for p in files))
subprocess.run([FFMPEG,"-hide_banner","-loglevel","error","-y","-f","concat","-safe","0","-i",str(lst),"-c","copy",str(out)],check=True)
report={"route":"VP-PAR-05","review_only":True,"source_audio":str(audio),"duration_approx_seconds":round(sum(min(8.,c["end_seconds"]-c["start_seconds"]) for c in edl["chapters"]),2),"chapters":len(edl["chapters"]),"historical_images_rendered":0,"license_signoff":False,"human_qa":False,"video":out.name}
(ROOT/"private-contact-reel-qa.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(report))
