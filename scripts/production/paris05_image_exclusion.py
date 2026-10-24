#!/usr/bin/env python3
"""Production hold for one disputed historical police photo. No network call.

Do not use this module to infer a person's identity from a photograph. The
exclusion is a source/editorial correction, not facial-recognition evidence.
"""
import json
from pathlib import Path

EXCLUSION_PATH = Path(__file__).resolve().parents[2] / "docs" / "production" / "paris05-sebai-excluded-misattributed-images-2026-10-24.json"

def excluded(asset_id=None, sha256=None, filename=None):
    obj=json.loads(EXCLUSION_PATH.read_text(encoding="utf-8"))
    for row in obj["entries"]:
        if row.get("sha256") and sha256 and row["sha256"].lower()==str(sha256).lower():
            return row["exclusion_id"]
        if filename and filename.casefold() in {x.casefold() for x in row.get("filename_aliases",[])}:
            return row["exclusion_id"]
        if asset_id and str(asset_id).casefold() in {a.casefold() for a in row.get("excluded_asset_ids", [])}:
            # Restrict exclusion to the disputed asset itself; a family name
            # is NOT evidence that another future photo is misattributed.
            return row["exclusion_id"]
    return None

def main():
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument("--asset-id")
    parser.add_argument("--sha256")
    parser.add_argument("--filename")
    args=parser.parse_args()
    hit=excluded(args.asset_id,args.sha256,args.filename)
    if hit:
        print("BLOCKED_MISATTRIBUTED_IMAGE:",hit)
        raise SystemExit(1)
    print("NOT_BLOCKED_BY_CURRENT_REJECTION_REGISTER")

if __name__=="__main__":
    main()
