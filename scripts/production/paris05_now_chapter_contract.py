#!/usr/bin/env python3
"""QA of bilingual integrated chapter offsets and unapproved NOW release state.

Pass means correct metadata and correct *hold*, NOT that the film is complete.
"""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
m=json.loads((ROOT/"docs/production/paris05-now-integrated-film-manifest.json").read_text())
e=json.loads((ROOT/"docs/production/paris05-commercial-release-evidence.json").read_text())
old=json.loads((ROOT/"docs/production/paris05-measured-master-chapter-timecodes.json").read_text())
expected_lang={"fr":(3694.30,18.08,711.82),"en":(3750.76,16.28,718.94)}
assert m["routeId"]=="VP-PAR-05"
assert len(m["chapters"])==11
assert len(set(c["id"] for c in m["chapters"]))==11
assert m["chapters"][0]["id"]=="INTRO" and m["chapters"][-1]["id"]=="OUTRO"
for lang,(total,delta,splice) in expected_lang.items():
    previous=0.0
    for index,chapter in enumerate(m["chapters"]):
        actual=chapter[lang]
        prior=old["tracks"][lang]["chapters"][index]
        assert chapter["id"]==prior["id"]
        assert actual["durationSeconds"]>0
        assert actual["startSeconds"]>=previous-0.001, (lang,chapter["id"],"overlap")
        assert abs(actual["durationSeconds"]-(actual["endSeconds"]-actual["startSeconds"]))<0.011
        calculated_start=round(prior["start_seconds"]+(delta if prior["start_seconds"]>splice else 0),2)
        calculated_end=round(prior["end_seconds"]+(delta if prior["end_seconds"]>splice else 0),2)
        assert abs(actual["startSeconds"]-calculated_start)<0.011,(lang,chapter["id"],"start")
        assert abs(actual["endSeconds"]-calculated_end)<0.011,(lang,chapter["id"],"end")
        previous=actual["endSeconds"]
    assert abs(previous-total)<0.01,(lang,previous,total)
# Fail if metadata accidentally claims publication while release evidence still blocks it.
ready_checks=all(
    isinstance(value,dict) and value.get("approved") is True and bool(value.get("reference"))
    for value in e.get("evidence",{}).values()
)
if not ready_checks:
    assert e["commercial_release_allowed"] is False
    assert m["releaseApproved"] is False
    assert m["mediaAssetsApproved"] is False
    assert m["media"]["fr"]["videoUrl"] is None
    assert m["media"]["en"]["videoUrl"] is None
assert m["chapters"][0]["fr"]["startSeconds"]==0
assert m["chapters"][0]["en"]["startSeconds"]==0
print("PASS: 11 post-insert chapters FR 3694.30s / EN 3750.76s, no overlap, release gate stays fail-closed")
