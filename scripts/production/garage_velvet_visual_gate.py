#!/usr/bin/env python3
"""Garage Velvet visual gate: fail closed; never treat REVIEW_ONLY as commercial clearance."""
import json,sys
from pathlib import Path
inventory=json.loads(Path("docs/production/paris05-visual-ingest-status.json").read_text())
items={x["id"]:x for x in inventory["items"]}
excluded=set(inventory.get("excluded",[]))
manifest=json.loads(Path(sys.argv[1]).read_text())
issues=[]
for shot in manifest["shots"]:
    aid=shot.get("asset_id")
    kind=shot.get("kind")
    if kind=="typography":
        if aid:issues.append(f"{shot['id']}: typography cannot claim archival asset")
        continue
    if kind!="archive":
        issues.append(f"{shot['id']}: unknown kind")
        continue
    item=items.get(aid)
    if aid in excluded or not item:
        issues.append(f"{shot['id']}: excluded or unknown archive {aid}")
    elif item.get("rights_review")!="APPROVED_COMMERCIAL":
        issues.append(f"{shot['id']}: archive {aid} not commercially approved; SUBSTITUTE")
if issues:
    print(json.dumps({"pass":False,"replace":issues},ensure_ascii=False,indent=2))
    sys.exit(1)
print(json.dumps({"pass":True,"shots":len(manifest["shots"])}))
