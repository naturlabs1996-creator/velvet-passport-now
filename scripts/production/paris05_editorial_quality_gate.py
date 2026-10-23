#!/usr/bin/env python3
"""EDITORIAL quality gate. A valid MP4 is NOT proof of a good historical film.

Reject a whole-film Paris 05 candidate if it has obviously sparse images, a
false introductory visual, or omits the exact Appert picture at the narration cue.
Hard-fail rather than report "ready to listen" from stream/codec checks.
"""
import json,os,sys
from pathlib import Path
path=Path(os.environ.get("VP_SHOT_DECISIONS","incoming/shot_decisions.json"))
report=Path(os.environ.get("VP_QA","incoming/qa.json"))
shots=json.loads(path.read_text());qa=json.loads(report.read_text())
issues=[]
lang=qa["lang"]
duration=3694.30 if lang=="fr" else 3750.76
if len(shots)<80:issues.append(f"CRITICAL_VISUAL_UNDERCOVERAGE: {len(shots)} shots for {duration:.0f}s of narration")
if qa.get("historical_image_appearances",0)<35:
    issues.append(f"CRITICAL_ARCHIVE_UNDERCOVERAGE: {qa.get('historical_image_appearances',0)} archival appearances")
first=next((s for s in shots if s.get("chapter")=="INTRO"),{})
if first.get("asset_id")=="TURGOT-LOUIS-1739":
    issues.append("INTRO_WRONG_IMAGE: 1739 map appears before narration establishes that historical map")
if not any(s.get("asset_id")=="APPERT-NEUF-1867" and s.get("chapter")=="STOP-01" for s in shots):
    issues.append("STOP01_MISSING_EXACT_APPERT_PHOTOGRAPH: Rijksmuseum RP-F-2007-161")
seba=[s for s in shots if s.get("chapter")=="STOP-SEBAI-1977"]
if not seba or all(s.get("asset_id") is None for s in seba):
    issues.append("STOP_SEBAI_VISUAL_VOID: no authenticated period/setting photograph shown in Sebai chapter")
if qa.get("en_visual_timing_provisional"):
    issues.append("EN_NOT_WORD_ALIGNED: image timing is proportional to French chapter duration")
previous=0
for i,s in enumerate(shots):
    start=float(s.get("second",0))
    end=float(shots[i+1]["second"]) if i+1<len(shots) else duration
    if end-start>90:issues.append(f"FROZEN_VISUAL: {s.get('chapter')} {end-start:.1f} seconds on single shot at {start:.1f}")
    if start<previous:issues.append(f"NONMONOTONIC_FRAME at {start:.1f}")
    previous=start
verdict={"route":"VP-PAR-05","language":lang,"status":"REJECTED_NOT_A_LISTENABLE_DEMO" if issues else "AUTOMATED_MINIMUM_GATE_ONLY","issues":issues,"automatic_approval":False,"checked_master_duration":duration}
Path("editorial-qa-result.json").write_text(json.dumps(verdict,ensure_ascii=False,indent=2)+"\n")
print(json.dumps(verdict,ensure_ascii=False,indent=2))
sys.exit(1 if issues else 0)
