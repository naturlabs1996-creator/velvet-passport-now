#!/usr/bin/env python3
"""Fail-closed Paris05 bilingual AV preflight. No edits, no downloads, no exceptions."""
import argparse,json,sys
from pathlib import Path
def check(m,root):
 errors=[]
 if m.get("route_id")!="VP-PAR-05":errors.append("Route identity mismatch")
 if not m.get("rights_signoff"):errors.append("Missing documented commercial rights signoff")
 if not m.get("visual_qa_passed"):errors.append("Visual QA not approved")
 assets={a.get("id"):a for a in m.get("assets",[])}
 for lang in ("fr","en"):
  data=m.get("languages",{}).get(lang,{})
  if not data.get("listening_qa_passed"):errors.append(f"{lang}: listening QA pending")
  if not data.get("subtitle_file") or not (root/data["subtitle_file"]).is_file() if data.get("subtitle_file") else True:
   errors.append(f"{lang}: reviewed SRT missing")
  if not (root/data.get("audio_master","__missing__")).is_file():errors.append(f"{lang}: master WAV missing")
  shots=m.get("timelines",{}).get(lang,[])
  if not shots:errors.append(f"{lang}: visual timeline missing")
  for shot in shots:
   asset=assets.get(shot.get("asset_id"))
   if not asset:errors.append(f"{lang}: unknown image");continue
   if asset.get("rights_status")!="CLEARED_COMMERCIAL":errors.append(f"{lang}: {asset['id']} rights blocked")
   if not asset.get("local_file") or not (root/asset["local_file"]).is_file():errors.append(f"{lang}: {asset['id']} image missing")
 return errors
if __name__=="__main__":
 p=argparse.ArgumentParser();p.add_argument("--manifest",type=Path,required=True);p.add_argument("--root",type=Path,required=True);a=p.parse_args()
 errors=check(json.loads(a.manifest.read_text()),a.root)
 print(json.dumps({"status":"BLOCKED" if errors else "READY_FOR_RENDER","errors":errors},indent=2))
 sys.exit(bool(errors))
