#!/usr/bin/env python3
"""Garage Velvet: editorial PRE-RENDER gate. No MP4 is permitted from incomplete storyboards.

Checks source-anchored visuals, unapproved image licenses, missing mandatory files,
French/English real cue timing, and all-chapter coverage before any film is called a demo.
"""
import json,sys
from pathlib import Path
from paris05_image_exclusion import excluded
root=Path("docs/production")
src=json.loads(Path("docs/pilots/paris-05-fr-v4-tts-and-cues.json").read_text())
s={v["id"]:v for v in src["segments"]}
board=json.loads((root/"paris05-professional-storyboard-first-sequences.json").read_text())
registry=json.loads((root/"paris05-visual-ingest-status.json").read_text())
inventory={v["id"]:v for v in registry["items"]}
errors=[]
if board.get("status")!="READY_FOR_RENDER":errors.append("PRODUCTION_NOT_APPROVED: storyboard not signed as READY_FOR_RENDER")
if board.get("all_audio_times_approved") is not True:errors.append("SYNC_UNVALIDATED: per-image timing not approved on actual audio")
if board.get("all_story_cues_covered") is not True:errors.append("COVERAGE_INCOMPLETE: not all text illustrated")
if len({v["chapter"] for v in board["shots"]})<len(s):errors.append(f"UNBOARDED_CHAPTERS: only {len({v['chapter'] for v in board['shots']})} of {len(s)} chapters planned")
if not board["shots"]:errors.append("NO_SHOTS")
for i,shot in enumerate(board["shots"],1):
    chapter=s.get(shot["chapter"])
    if not chapter:
        errors.append(f"{shot['id']}: UNKNOWN_CHAPTER");continue
    q=shot["quote"];t=chapter["text"]
    offs=int(shot["source_char_offset"])
    if t[offs:offs+len(q)].casefold()!=q.casefold():
        errors.append(f"{shot['id']}: QUOTE_DOES_NOT_MATCH_SOURCE")
    if shot.get("actual_audio_second") is None:
        errors.append(f"{shot['id']}: NO_VERIFIED_SPEECH_TIMECODE")
    asset_ref=shot.get("asset_id")
    inv=inventory.get(asset_ref, {}) if asset_ref else {}
    blocked=excluded(asset_id=asset_ref,sha256=inv.get("sha256"),filename=inv.get("filename"))
    if blocked:
        errors.append(f"{shot['id']}: REJECTED_MISATTRIBUTED_IMAGE ({blocked})")
    if shot.get("commercial_approval") is not True:
        errors.append(f"{shot['id']}: COMMERCIAL_NOT_APPROVED")
    if shot["kind"]=="VISUAL_MISSING_OR_DESIGN_UNPRODUCED":
        errors.append(f"{shot['id']}: ESSENTIAL_IMAGE_OR_GRAPHIC_NOT_READY ({q[:55]})")
    elif shot["kind"]=="ARCHIVE_CANDIDATE":
        aid=shot.get("asset_id")
        if aid not in inventory and aid!="APPERT-NEUF-1867":
            errors.append(f"{shot['id']}: UNKNOWN_IMAGE ({aid})")
        elif aid in inventory and inventory[aid].get("rights_review")!="APPROVED_COMMERCIAL":
            errors.append(f"{shot['id']}: IMAGE_RIGHTS_PENDING ({aid})")
        elif aid=="APPERT-NEUF-1867":
            errors.append(f"{shot['id']}: NEW_APPERT_IMAGE_DOWNLOADED_NOT_RIGHTS_SIGNED ({aid})")
    else:errors.append(f"{shot['id']}: UNKNOWN_KIND")
if board.get("scope") is None:errors.append("NO_SCOPE")
report={"route":"VP-PAR-05","status":"BLOCKED" if errors else "READY_FOR_RENDER","shots":len(board["shots"]),"source_chapters":len(s),"planned_chapters":len({v["chapter"] for v in board["shots"]}),"blockers_count":len(errors),"blockers":errors,"audio_preserved":True,"publishing_authorized":False}
Path("dist").mkdir(exist_ok=True)
Path("dist/paris05-professional-preflight.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"status":report["status"],"shots":report["shots"],"chapters":report["planned_chapters"],"blockers_count":len(errors),"sample":errors[:14]},ensure_ascii=False,indent=2))
sys.exit(bool(errors))
