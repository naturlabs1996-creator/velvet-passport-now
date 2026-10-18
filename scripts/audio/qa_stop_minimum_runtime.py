#!/usr/bin/env python3
"""Velvet Passport — enforce minimum *measured* narrative runtime per stop."""
import argparse
import json
import sys
from pathlib import Path

def main():
    p = argparse.ArgumentParser()
    p.add_argument("report", type=Path)
    p.add_argument("--minimum-seconds", type=float, default=300)
    args = p.parse_args()
    data = json.loads(args.report.read_text(encoding="utf-8"))
    stops = [s for s in data["segments"] if s["id"].startswith("STOP-")]
    if not stops:
        raise SystemExit("FAIL: no STOP segments found")
    failed = []
    for stop in stops:
        sec = float(stop["duration_seconds"])
        passed = sec >= args.minimum_seconds
        print(f'{"PASS" if passed else "FAIL"} {stop["id"]}: {sec:.1f}s; target >= {args.minimum_seconds:.0f}s')
        if not passed:
            failed.append((stop["id"], round(args.minimum_seconds - sec, 1)))
    if failed:
        print("FAIL: stop runtime gate not met:", failed)
        return 1
    print(f"PASS: all {len(stops)} stops meet the minimum duration")
    return 0

if __name__ == "__main__":
    sys.exit(main())
