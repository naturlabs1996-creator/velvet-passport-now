#!/usr/bin/env python3
"""Paris 05 bilingual ambience mixer; release fails closed on source-rights/QA gaps.

Usage:
python scripts/audio/mix_paris05_ambience.py --voice path.wav --manifest path.json --language fr --out output.wav
Manifest events: [{"id":"...","file":"assets/...wav","start_seconds":3.2,
"gain_db":-23,"rights_status":"CLEARED_COMMERCIAL","source_url":"https://...","source_credit":"..."}].
If no events are supplied, rejects unless --voice-only-review is explicitly supplied.
"""
import argparse
import json
from pathlib import Path
import numpy as np
import soundfile as sf

def read_mono(path):
    audio, rate = sf.read(path, dtype="float32", always_2d=True)
    if audio.shape[1] > 2:
        raise ValueError(f"Unsupported channel count in {path}")
    return audio.mean(axis=1), rate

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--voice", required=True, type=Path)
    p.add_argument("--manifest", required=True, type=Path)
    p.add_argument("--language", required=True, choices=("fr", "en"))
    p.add_argument("--out", required=True, type=Path)
    p.add_argument("--voice-only-review", action="store_true")
    args = p.parse_args()
    config = json.loads(args.manifest.read_text(encoding="utf-8"))
    if config.get("language") != args.language:
        raise ValueError("Manifest language mismatch")
    events = config.get("events", [])
    if not events and not args.voice_only_review:
        raise ValueError("No cleared ambience events; commercial mix not allowed")
    voice, rate = read_mono(args.voice)
    if len(voice) == 0 or not np.isfinite(voice).all():
        raise ValueError("Invalid narration")
    mix = voice.astype(np.float64).copy()
    checked = []
    for event in events:
        if event.get("rights_status") != "CLEARED_COMMERCIAL":
            raise ValueError(f"Sound rights not cleared: {event.get('id')}")
        if not event.get("source_url") or not event.get("source_credit"):
            raise ValueError("Every sound requires documented provenance and credit")
        path = Path(event["file"])
        if not path.is_file():
            raise FileNotFoundError(path)
        ambience, source_rate = read_mono(path)
        if source_rate != rate:
            raise ValueError(f"{path}: incorrect sample rate, must be {rate}")
        if not np.isfinite(ambience).all():
            raise ValueError(f"{path}: invalid sound samples")
        start = round(float(event["start_seconds"]) * rate)
        if start < 0 or start >= len(mix):
            raise ValueError(f"{path}: start outside narration")
        size = min(len(ambience), len(mix)-start)
        if size < 1:
            raise ValueError(f"{path}: empty insertion")
        gain_db = float(event.get("gain_db",-25))
        if gain_db > -18:
            raise ValueError(f"{path}: effect gain too loud for unattended release")
        bed = ambience[:size].astype(np.float64) * 10 ** (gain_db / 20)
        # Envelope prevents abrupt effect cutoffs.
        ramp = min(round(.5*rate), size//2)
        if ramp:
            bed[:ramp] *= np.linspace(0,1,ramp,endpoint=False)
            bed[-ramp:] *= np.linspace(1,0,ramp,endpoint=False)
        # Reduce ambience where narration is active, using 80ms voice RMS.
        window=max(1,round(rate*.08))
        squared=np.square(voice[start:start+size].astype(np.float64))
        cumulative=np.concatenate(([0.0],np.cumsum(squared)))
        left=np.maximum(0,np.arange(size)-window//2)
        right=np.minimum(size,left+window)
        power=(cumulative[right]-cumulative[left])/np.maximum(1,right-left)
        duck=np.where(power > 0.00008, 0.35, 1.0)
        mix[start:start+size]+=bed*duck
        checked.append({"id":event["id"],"source":event["source_url"],"start_seconds":float(event["start_seconds"])})
    peak=float(np.max(np.abs(mix)))
    if peak >= .99:
        raise ValueError(f"Peak {peak:.3f} exceeds safe headroom; remix required")
    args.out.parent.mkdir(parents=True,exist_ok=True)
    sf.write(args.out,mix,rate,subtype="PCM_24")
    report={"language":args.language,"result":"REVIEW_ONLY" if args.voice_only_review else "MIX_TECHNICAL_PASS_HUMAN_QA_PENDING","duration_seconds":round(len(mix)/rate,3),"peak":round(peak,5),"rights_checked_events":checked}
    args.out.with_suffix(".qa.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print(json.dumps(report,indent=2))
if __name__=="__main__":
    main()
