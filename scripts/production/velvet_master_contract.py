#!/usr/bin/env python3
"""Persistent, fail-closed *repository manifest* guard for Velvet Passport.

Runs on every route-manifest change in CI. Does not claim to inspect audio/video
stored outside GitHub. Physical media QA is a separate mandatory gate.
"""
from __future__ import annotations
import argparse
import json
import re
import sys
from pathlib import Path

MASTER = "velvet-master-frame/v1"
BANNED = re.compile(r"(?:rejet[eé]|(?:stop0?4[_-])?v[67](?:[_-]qa)?|assemblage[_-]qa|sous[_-]?titres[_-]?grands[_-]?v7)", re.I)
REQUIRED_RELEASE_FLAGS = (
    "rights_signoff", "visual_qa_passed", "audio_qa_passed",
    "subtitle_qa_passed", "mobile_qa_passed", "source_first_media_qa_passed",
    "final_human_approval",
)


def inspect(data: dict, name: str) -> dict:
    issues, warnings = [], []
    rid = data.get("route_id", "?")
    if not rid or rid == "?": issues.append("ROUTE_ID_MISSING")
    if data.get("global_video_template") != MASTER:
        issues.append("MASTER_GABARIT_NOT_LINKED")
    if data.get("release_requested") not in (True, False):
        issues.append("RELEASE_STATE_UNDECLARED")
    if not data.get("segments"):
        issues.append("SEGMENTS_MISSING")
    for asset in data.get("assets", []):
        aid = asset.get("id", "?")
        media_name = str(asset.get("local_file", ""))
        if media_name and BANNED.search(media_name):
            issues.append(f"{aid}:REJECTED_LEGACY_SOURCE")
        if asset.get("use_in_export"):
            if not asset.get("source_url"):
                issues.append(f"{aid}:PROVENANCE_MISSING")
            if not asset.get("local_file"):
                issues.append(f"{aid}:ORIGINAL_FILE_MISSING")
    if data.get("release_requested") is True:
        for flag in REQUIRED_RELEASE_FLAGS:
            if data.get(flag) is not True:
                issues.append(f"PUBLICATION_BLOCKED:{flag}")
        # Merely checking SRT syntax never proves synchronization.
        for lang in ("fr", "en"):
            ldata = data.get("languages", {}).get(lang, {})
            for flag in ("listening_qa_passed", "subtitle_audio_alignment_reviewed"):
                if ldata.get(flag) is not True:
                    issues.append(f"PUBLICATION_BLOCKED:{lang}:{flag}")
            if not ldata.get("subtitle_file"):
                issues.append(f"PUBLICATION_BLOCKED:{lang}:SUBTITLES_MISSING")
        if not data.get("signed_media_audit"):
            issues.append("PUBLICATION_BLOCKED:NO_PHYSICAL_MEDIA_AUDIT")
    else:
        warnings.append("DRAFT_ONLY: this manifest cannot authorize publishing")
    return {"file": name, "route_id": rid, "master_template": MASTER,
            "status": "BLOCKED" if issues else "DRAFT_PASS_NOT_RELEASE" if warnings else "PREFLIGHT_PASS",
            "issues": issues, "warnings": warnings}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--routes-dir", default="docs/production/routes")
    ap.add_argument("--json-out", default=None)
    args = ap.parse_args()
    folder = Path(args.routes_dir)
    files = sorted(folder.glob("*.json"))
    if not files:
        print(json.dumps({"status": "BLOCKED", "issues": ["NO_ROUTE_MANIFESTS"]}))
        return 2
    results = []
    for path in files:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            results.append(inspect(data, str(path)))
        except (ValueError, OSError) as exc:
            results.append({"file": str(path), "status": "BLOCKED", "issues": [f"UNREADABLE:{exc}"]})
    status = "BLOCKED" if any(r["issues"] for r in results) else "DRAFT_GATE_PASS"
    report = {"status": status, "routes_checked": len(results), "routes": results,
              "notice": "GitHub static contract only; physical source SHA, audio, subtitle alignment and rights need separate on-media audit before release"}
    rendered = json.dumps(report, indent=2, ensure_ascii=False)
    print(rendered)
    if args.json_out:
        out = Path(args.json_out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(rendered + "\n", encoding="utf-8")
    return 2 if status == "BLOCKED" else 0


if __name__ == "__main__":
    sys.exit(main())