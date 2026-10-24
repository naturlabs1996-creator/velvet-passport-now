#!/usr/bin/env python3
"""Read-only reconciliation of research image registries versus Mastodon evidence.

IMPORTANT: this tool does NOT have a live Mastodon connection and MUST NOT
turn an external download / URL / GitHub artifact into an archived claim.
It produces a candidate recovery queue, not a proof of storage.
"""
import argparse
import json
from pathlib import Path
from datetime import date
from collections import Counter

ROOT = Path(__file__).resolve().parents[2]
PRODUCTION = ROOT / "docs" / "production"
ALIASES = {"APPERT-NEUF-1867": "RP-F-2007-161"}

def read_json(name):
    with (PRODUCTION / name).open(encoding="utf-8") as handle:
        return json.load(handle)

def compile_audit():
    images = {}
    def include(asset_id, provenance, disposition, cue=None, source_url=None, notes=None):
        if not asset_id:
            return
        asset_id = ALIASES.get(asset_id, asset_id)
        entry = images.setdefault(asset_id, {
            "asset_id": asset_id,
            "city": "PAR",
            "route_id": "VP-PAR-05",
            "mastodon": "NOT_AUDITED_LIVE",
            "mastodon_receipt": None,
            "disposition": "SOURCE_ONLY",
            "source_refs": [],
            "cue_refs": [],
            "source_urls": [],
            "notes": []
        })
        if provenance not in entry["source_refs"]:
            entry["source_refs"].append(provenance)
        if cue and cue not in entry["cue_refs"]:
            entry["cue_refs"].append(cue)
        if source_url and source_url not in entry["source_urls"]:
            entry["source_urls"].append(source_url)
        if notes and notes not in entry["notes"]:
            entry["notes"].append(notes)
        rank = {"NOT_LOCATED": 0, "SOURCE_ONLY": 1, "DOWNLOADED_GITHUB_ARTIFACT": 2}
        if rank.get(disposition, -1) > rank.get(entry["disposition"], -1):
            entry["disposition"] = disposition
        if disposition == "NOT_LOCATED" and entry["disposition"] == "SOURCE_ONLY" and not source_url:
            entry["disposition"] = "NOT_LOCATED"

    ingested = read_json("paris05-visual-ingest-status.json")
    for item in ingested.get("items", []):
        include(item["id"], "paris05-visual-ingest-status.json",
                "DOWNLOADED_GITHUB_ARTIFACT" if item.get("status", "").startswith("INGESTED") else "SOURCE_ONLY",
                item.get("cue"), notes="Listed in GitHub Actions artifacts; NO evidence of Mastodon storage.")
    targeted = read_json("paris05-professional-rebuild-source-candidates.json")
    for item in targeted.get("assets", []):
        include(item["id"], "paris05-professional-rebuild-source-candidates.json",
                "SOURCE_ONLY", item.get("cue"), item.get("source_record"),
                "Source discovered; source identity / rights and Mastodon storage not yet verified.")
    prospects = read_json("paris05-sebai-curiel-ghraieb-photo-prospects.json")
    for item in prospects.get("items", []):
        include(item["id"], "paris05-sebai-curiel-ghraieb-photo-prospects.json",
                "NOT_LOCATED" if item.get("status") == "NOT_LOCATED" else "SOURCE_ONLY",
                "STOP-SEBAI-1977", item.get("page"),
                item.get("warning", "Individual identity and reuse-rights verification required."))
    include("RP-F-2007-161", "PARIS05-REPRISE-REALISATION-PROFESSIONNELLE.md",
            "DOWNLOADED_GITHUB_ARTIFACT", "STOP-01",
            "https://id.rijksmuseum.nl/200489498",
            "Recovered in Actions artifact 12535889502; not a verified Mastodon acquisition.")

    coverage = read_json("paris05-visual-coverage-and-gaps.json")
    segments = []
    for segment in coverage.get("segments", []):
        expected = [ALIASES.get(x, x) for x in segment.get("available_assets", [])]
        segments.append({
            "segment": segment.get("id"),
            "documented_image_ids": list(dict.fromkeys(expected)),
            "missing_or_unresolved": segment.get("missing", []),
            "legacy_status": segment.get("status"),
            "complete_in_mastodon": "NOT_VERIFIED",
        })

    storyboard = read_json("paris05-professional-storyboard-first-sequences.json")
    storyboard_ref_ids = sorted({
        ALIASES.get(s["asset_id"], s["asset_id"])
        for s in storyboard.get("shots", [])
        if s.get("asset_id")
    })
    unknown_storyboard_ids = [aid for aid in storyboard_ref_ids if aid not in images]
    rows = sorted(images.values(), key=lambda row: row["asset_id"])
    for row in rows:
        row["source_refs"].sort()
        row["cue_refs"].sort()
        row["source_urls"].sort()
    counts = dict(sorted(Counter(x["disposition"] for x in rows).items()))
    # Neither numbers from 2026-09/10 masters nor artifact ingestion can establish a bucket count.
    return {
        "audit_date": str(date.today()),
        "audit_scope": "Three cities / 66 routes overall; Paris 05 images indexed from repository, Montreal and Quebec documentary references awaiting physical reconciliation.",
        "live_supabase_storage_read_completed": False,
        "verified_mastodon_asset_total": None,
        "do_not_infer_zero_stored": True,
        "paris_05": {
            "route_id": "VP-PAR-05",
            "total_distinct_research_image_records": len(rows),
            "dispositions": counts,
            "image_registry": rows,
            "segment_coverage": segments,
            "unmatched_storyboard_asset_ids": unknown_storyboard_ids,
            "additional_oct23_protagonist_photos": "NOT_RECONCILED_WITH_CONVERSATION_FILES",
            "release_status": "BLOCKED",
        },
        "montreal": {
            "documentary_baseline": "VELVET_PASSPORT_MONTREAL_NOW_MASTER_REPRISE_CAPE_ET_EPEE_2026-10-02.md",
            "masters_and_sources_physical_audit": "PENDING",
            "mastodon_asset_count": None,
            "no_assumption_of_loss": True,
        },
        "quebec": {
            "documentary_baseline": "QC_NOW_AUDIT_DOCUMENTAIRE_MASTER_V1.md (13 Oct; 16 routes; 68 working entries, not 68 certified asset folders)",
            "masters_and_sources_physical_audit": "PENDING",
            "mastodon_asset_count": None,
            "no_assumption_of_loss": True,
        },
        "follow_up": "Inspect Mastodon Storage and catalog live; match each SHA-256 and stable asset_id, recover unarchived originals, then sign off rights and montage correspondence.",
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", help="Optional JSON report destination")
    parser.add_argument("--require-complete", action="store_true",
                        help="Fail closed until live Mastodon audit and all route images are verified")
    args = parser.parse_args()
    report = compile_audit()
    rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        target = Path(args.output)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(rendered, encoding="utf-8")
        print("Wrote audit report:", target)
    else:
        print(rendered)
    if args.require_complete:
        # This script cannot grant readiness; it has no live verification credentials.
        raise SystemExit("BLOCKED: Mastodon live file and catalog verification not performed")

if __name__ == "__main__":
    main()
