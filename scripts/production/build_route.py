#!/usr/bin/env python3
"""Bilingual manifest-driven audiovisual assembler. Fails closed on rights/QA."""
import argparse,json,subprocess,tempfile
from pathlib import Path
def run(args):
 p=subprocess.run([str(x) for x in args],capture_output=True,text=True)
 if p.returncode: raise RuntimeError(p.stderr[-4000:])
 return p.stdout
def probe(path):
 return json.loads(run(["ffprobe","-v","error","-show_format","-show_streams","-of","json",path]))
def validate(m,root):
 e=[]
 if not m.get("route_id"): e.append("Missing route ID")
 if not m.get("rights_signoff"): e.append("Rights signoff missing")
 assets={a["id"]:a for a in m.get("assets",[])}
 for lang in ("fr","en"):
  d=m.get("languages",{}).get(lang,{})
  for key in ("audio_master","subtitle_file"):
   if not d.get(key) or not (root/d[key]).is_file():e.append(f"{lang}: missing {key}")
  if not d.get("listening_qa_passed"):e.append(f"{lang}: audio QA pending")
  timeline=m.get("timelines",{}).get(lang,[])
  if not timeline:e.append(f"{lang}: missing timeline")
  prev=0
  for shot in timeline:
   a=assets.get(shot.get("asset_id"))
   if not a:e.append("Missing image asset");continue
   if a.get("rights_status")!="CLEARED_COMMERCIAL":e.append(f"{a['id']}: rights not cleared")
   if a.get("authenticity") not in ("HISTORICAL_ORIGINAL","CONTEMPORARY_RECORDING","ORIGINAL_GRAPHIC"):e.append(f"{a['id']}: authenticity invalid")
   if not a.get("source_url") or not a.get("credit"):e.append(f"{a['id']}: provenance missing")
   if not a.get("local_file") or not (root/a["local_file"]).is_file():e.append(f"{a['id']}: file missing")
   start,end=shot.get("start",-1),shot.get("end",-1)
   if start<0 or end<=start or abs(start-prev)>.02:e.append(f"{lang}: timeline gap/overlap")
   prev=end
 return e
def render(m,root,out,lang):
 d=m["languages"][lang]; audio=root/d["audio_master"]; subs=root/d["subtitle_file"]
 length=float(probe(audio)["format"]["duration"])
 shots=m["timelines"][lang]
 if abs(shots[-1]["end"]-length)>.25:raise ValueError(f"{lang}: timeline does not cover full narration")
 assets={a["id"]:a for a in m["assets"]}
 out.mkdir(parents=True,exist_ok=True)
 dest=out/f'{m["route_id"]}-{lang.upper()}-AV.mp4'
 with tempfile.TemporaryDirectory() as td:
  temp=Path(td); clips=[]
  for i,shot in enumerate(shots):
   image=root/assets[shot["asset_id"]]["local_file"]; clip=temp/f"{i:04}.mp4"; clips.append(clip)
   run(["ffmpeg","-v","error","-y","-loop","1","-framerate","2","-i",image,"-t",f'{shot["end"]-shot["start"]:.5f}',"-vf","scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p","-an","-c:v","libx264","-preset","veryfast","-crf","22","-r","2",clip])
  lst=temp/"files.txt";lst.write_text("".join(f"file '{c.as_posix()}'\n" for c in clips))
  joined=temp/"visuals.mp4"
  run(["ffmpeg","-v","error","-y","-f","concat","-safe","0","-i",lst,"-c","copy",joined])
  run(["ffmpeg","-v","error","-y","-i",joined,"-i",audio,"-i",subs,"-map","0:v:0","-map","1:a:0","-map","2:s:0","-c:v","copy","-c:a","aac","-b:a","160k","-c:s","mov_text","-metadata:s:s:0",f'language={"fra" if lang=="fr" else "eng"}',"-movflags","+faststart","-t",str(length),dest])
 result=probe(dest);tracks={s["codec_type"] for s in result["streams"]}
 if not {"video","audio","subtitle"}.issubset(tracks):raise RuntimeError(f"{lang}: missing tracks")
 if abs(float(result["format"]["duration"])-length)>1:raise RuntimeError(f"{lang}: duration mismatch")
 return {"path":str(dest),"seconds":float(result["format"]["duration"]),"tracks":sorted(tracks),"status":"AUTOMATED_PASS_HUMAN_AV_QA_PENDING"}
def main():
 p=argparse.ArgumentParser();p.add_argument("manifest",type=Path);p.add_argument("--root",type=Path);p.add_argument("--out",type=Path,default=Path("dist/velvet"));a=p.parse_args()
 m=json.loads(a.manifest.read_text());root=(a.root or a.manifest.parent).resolve();errors=validate(m,root)
 if errors:print(json.dumps({"status":"BLOCKED","errors":errors},indent=2));return 2
 r={"route_id":m["route_id"],"status":"REVIEW_REQUIRED","languages":{}}
 for lang in ("fr","en"):r["languages"][lang]=render(m,root,a.out,lang)
 a.out.mkdir(parents=True,exist_ok=True)
 (a.out/"qa.json").write_text(json.dumps(r,indent=2))
 print(json.dumps(r,indent=2));return 0
if __name__=="__main__":raise SystemExit(main())
