#!/usr/bin/env python3
"""Velvet Production Engine V1: validate reusable bilingual production manifests.
No fabricated assets, silent fallback, or release without evidence.
Usage: python scripts/production/validate_route.py docs/production/routes/VP-PAR-05.json
"""
import json, sys
from pathlib import Path

ALLOWED = {"FOUND","VERIFIED","RIGHTS-CLEARED","PRODUCTION-READY"}
SEGMENTS = ["INTRO","STOP-01","TRANSITION-01-SEBAI","STOP-SEBAI-1977",
"TRANSITION-01-02","STOP-02","TRANSITION-02-03","STOP-03",
"TRANSITION-03-04","STOP-04","OUTRO"]

def validate(data):
    errors, warnings = [], []
    if not data.get("route_id"): errors.append("Missing route_id")
    segments=data.get("segments",[])
    ids=[s.get("id") for s in segments]
    if len(ids)!=len(set(ids)): errors.append("Duplicate segment IDs")
    if not ids: errors.append("No segments")
    for s in segments:
        sid=s.get("id","?")
        if s.get("status") not in ALLOWED: errors.append(f"{sid}: invalid status")
        if not s.get("editorial_source"): errors.append(f"{sid}: missing editorial source")
    if data.get("route_id")=="VP-PAR-05" and ids!=SEGMENTS:
        errors.append("Paris 05: canonical 11-segment order changed")
    languages=data.get("languages",{})
    for lang in ("fr","en"):
        v=languages.get(lang,{})
        if not v.get("audio_master"): errors.append(f"{lang}: missing audio master reference")
        if not v.get("qa_report"): errors.append(f"{lang}: missing audio QA reference")
        if not v.get("subtitle_file"): warnings.append(f"{lang}: subtitles absent")
        if not v.get("listening_qa_passed"): warnings.append(f"{lang}: human listening QA pending")
    used=set()
    for asset in data.get("assets",[]):
        aid=asset.get("id")
        if not aid or aid in used: errors.append(f"Invalid or duplicate asset id: {aid}")
        used.add(aid)
        if asset.get("use_in_export"):
            if asset.get("rights_status")!="CLEARED_COMMERCIAL":
                errors.append(f"{aid}: export requested without cleared commercial rights")
            if not asset.get("source_url") or not asset.get("credit"):
                errors.append(f"{aid}: missing provenance/credit")
            if not asset.get("local_file"): errors.append(f"{aid}: file not ingested")
            if asset.get("authenticity") not in ("HISTORICAL_ORIGINAL","CONTEMPORARY_RECORDING","ORIGINAL_SOUND"):
                errors.append(f"{aid}: invalid authenticity")
    ready=bool(data.get("release_requested"))
    if ready:
        if any(not languages.get(lang,{}).get("listening_qa_passed") for lang in ("fr","en")):
            errors.append("Release blocked: bilingual listening QA incomplete")
        if not data.get("rights_signoff"): errors.append("Release blocked: rights sign-off missing")
        if not data.get("visual_qa_passed"): errors.append("Release blocked: visual QA missing")
        if not all(languages.get(lang,{}).get("subtitle_file") for lang in ("fr","en")):
            errors.append("Release blocked: subtitles incomplete")
        if not data.get("exports") or not all(data["exports"].get(l) for l in ("fr","en")):
            errors.append("Release blocked: bilingual MP4 export paths missing")
    return errors,warnings

def main():
    if len(sys.argv)!=2: sys.exit("Usage: validate_route.py route.json")
    path=Path(sys.argv[1]); data=json.loads(path.read_text(encoding="utf-8"))
    errors,warnings=validate(data)
    result={"route_id":data.get("route_id"),"validation":"FAIL" if errors else "PASS_WITH_GAPS" if warnings else "PASS",
            "commercial_release":"BLOCKED" if errors or warnings or not data.get("release_requested") else "ELIGIBLE_FOR_FINAL_REVIEW",
            "errors":errors,"warnings":warnings}
    print(json.dumps(result,ensure_ascii=False,indent=2))
    sys.exit(1 if errors else 0)
if __name__=="__main__": main()
