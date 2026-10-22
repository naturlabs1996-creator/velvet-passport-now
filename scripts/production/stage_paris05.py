#!/usr/bin/env python3
"""Connect existing Paris 05 FR/EN GitHub Actions artifacts to the route manifest.

Inputs: --manifest docs/production/routes/VP-PAR-05.json
        --fr-dir downloaded/fr --en-dir downloaded/en --out dist/paris05-staging
Outputs: audio/, qa/, stage-qa.json. Never marks human QA or rights as passed.
"""
import argparse,json,shutil,hashlib,sys
from pathlib import Path
EXPECTED={"fr":"PARIS05-FR-FINAL-11SEG.wav","en":"PARIS05-EN-FULL-11SEG-p232-UNREVIEWED.wav"}
def sha(p):
 h=hashlib.sha256()
 with p.open("rb") as f:
  for b in iter(lambda:f.read(1024*1024),b""):h.update(b)
 return h.hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument("--manifest",type=Path,required=True);p.add_argument("--fr-dir",type=Path,required=True);p.add_argument("--en-dir",type=Path,required=True);p.add_argument("--out",type=Path,required=True);a=p.parse_args()
 m=json.loads(a.manifest.read_text());out=a.out;report={"route":m.get("route_id"),"status":"STAGING_COMPLETE_RELEASE_BLOCKED","languages":{},"errors":[]}
 if m.get("route_id")!="VP-PAR-05":raise ValueError("Wrong route ID")
 for lang,folder in (("fr",a.fr_dir),("en",a.en_dir)):
  entry=m["languages"][lang];expected=EXPECTED[lang]
  if entry["source_artifact"]["filename"]!=expected:raise ValueError(f"{lang}: pinned artifact filename changed")
  found=list(folder.rglob(expected))
  if len(found)!=1:raise ValueError(f"{lang}: expected exactly one pinned master, got {len(found)}")
  src=found[0];target=out/entry["audio_master"];target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,target)
  qname=Path(entry["qa_report"]).name;qa_candidates=list(folder.rglob(qname))
  if len(qa_candidates)!=1:raise ValueError(f"{lang}: missing unique original QA report")
  qt=out/entry["qa_report"];qt.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(qa_candidates[0],qt)
  raw=json.loads(qt.read_text())
  if lang=="en" and raw.get("segment_count")!=11:raise ValueError("EN master does not contain 11 segments")
  if lang=="fr" and len(raw.get("segments",[]))!=11:raise ValueError("FR master does not contain 11 segments")
  report["languages"][lang]={"source_run":entry["source_artifact"]["run_id"],"source_artifact":entry["source_artifact"]["artifact_id"],"master":str(target),"sha256":sha(target),"bytes":target.stat().st_size,"original_qa":str(qt),"human_listening":"PENDING","subtitles":"PENDING"}
 report["blocked"]=["human listening QA","subtitles","visual assets and rights","timelines FR/EN","commercial release signoff"]
 out.mkdir(parents=True,exist_ok=True);(out/"stage-qa.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
 print(json.dumps(report,ensure_ascii=False,indent=2));return 0
if __name__=="__main__":sys.exit(main())
