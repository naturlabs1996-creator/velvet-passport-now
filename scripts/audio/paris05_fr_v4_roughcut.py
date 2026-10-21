#!/usr/bin/env python3
"""Paris 05 honest technical rough cut. No fabricated archival imagery."""
import json, subprocess, pathlib, shutil
from PIL import Image, ImageDraw, ImageFont
ROOT=pathlib.Path(".")
OUT=ROOT/"roughcut"; OUT.mkdir(exist_ok=True)
AUDIO=ROOT/"clean"
EDL=json.loads((ROOT/"docs/pilots/paris-05-fr-v4-edit-decision-list-provisional.json").read_text())
font="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
F=ImageFont.truetype(font,30); S=font
small=ImageFont.truetype(S,18)
def call(cmd): subprocess.run(cmd,check=True)
def slate(seg):
    img=Image.new("RGB",(960,540),(19,28,40)); d=ImageDraw.Draw(img)
    d.text((55,58),"VELVET PASSPORT  /  PARIS 05",font=F,fill="#e1c692")
    d.text((55,165),seg["id"],font=F,fill="#ffffff")
    title=seg["title"]
    import textwrap
    for i,line in enumerate(textwrap.wrap(title,43)[:3]):d.text((55,230+i*32),line,font=small,fill="#f1f1f1")
    d.line((55,390,900,390),fill="#8c9db2",width=1)
    d.text((55,414),"MAQUETTE TECHNIQUE — VISUELS D'ARCHIVES NON INTÉGRÉS",font=small,fill="#ffc6a8")
    d.text((55,448),"NON DESTINÉE À LA PUBLICATION COMMERCIALE",font=small,fill="#ffc6a8")
    path=OUT/(seg["id"]+".png");img.save(path);return path
files=[]
for seg in EDL["segments"]:
    key=seg["id"]
    src=AUDIO/(key+"-FR-CLEAN-100.wav")
    if not src.exists():raise FileNotFoundError(src)
    visual=slate(seg)
    target=OUT/(key+".mp4")
    call(["ffmpeg","-hide_banner","-loglevel","error","-y","-loop","1","-framerate","1","-i",str(visual),"-i",str(src),"-c:v","libx264","-preset","ultrafast","-tune","stillimage","-pix_fmt","yuv420p","-r","1","-c:a","aac","-b:a","128k","-ar","24000","-shortest","-movflags","+faststart",str(target)])
    files.append(target)
playlist=OUT/"concat.txt"
playlist.write_text("".join("file '"+p.name+"'\n" for p in files))
call(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","concat","-safe","0","-i",str(playlist),"-c","copy","-movflags","+faststart",str(OUT/"PARIS05-FR-V4-ROUGH-CUT-NOT-FINAL.mp4")])
report={"status":"TECHNICAL_ROUGHCUT_NO_ARCHIVE_IMAGES","segments":len(files),"source_run":39488651589,"visual_assets_used":0,"master":str(OUT/"PARIS05-FR-V4-ROUGH-CUT-NOT-FINAL.mp4"),"human_review":"PENDING","editorial_unchanged":True,"note":"Slates deliberately show montage structure only, not final audiovisual story. Exact subtitles and image sync pending."}
(OUT/"QA-ROUGHCUT.json").write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
