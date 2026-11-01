#!/usr/bin/env python3
"""Join a pre-existing Chatterbox 11-segment WAV set without rerendering voices.

This is a QA-only concatenation of the exact source WAV bytes (headers excluded).
No resampling, retiming, compression, narration edits, or invented silence.
"""
import argparse
import hashlib
import json
from pathlib import Path
import wave

IDS = [
    "INTRO", "STOP-01", "TRANSITION-01-SEBAI", "STOP-SEBAI-1977",
    "TRANSITION-01-02", "STOP-02", "TRANSITION-02-03",
    "STOP-03", "TRANSITION-03-04", "STOP-04", "OUTRO",
]

def checksum(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1048576), b""):
            h.update(block)
    return h.hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-root", type=Path, default=Path("downloaded"))
    parser.add_argument("--output-dir", type=Path, default=Path("assembled-v5-qa"))
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    master = args.output_dir / "PARIS05-FR-V5-11SEG-QA.wav"
    metadata = None
    records = []
    total_frames = 0
    with wave.open(str(master), "wb") as dst:
        for segment in IDS:
            srcfile = args.input_root / segment / f"{segment}-FR-NATIVE-100.wav"
            if not srcfile.is_file():
                raise FileNotFoundError(f"Missing source WAV for {segment}: {srcfile}")
            with wave.open(str(srcfile), "rb") as src:
                params = (src.getnchannels(), src.getsampwidth(),
                          src.getframerate(), src.getcomptype())
                if metadata is None:
                    metadata = params
                    if metadata[3] != "NONE":
                        raise ValueError("Only uncompressed PCM WAV is supported")
                    dst.setparams((params[0], params[1], params[2], 0,
                                   params[3], "not compressed"))
                elif params != metadata:
                    raise ValueError(f"Incompatible WAV format in {segment}: {params} vs {metadata}")
                nframes = src.getnframes()
                seconds = nframes / params[2]
                position = 0
                while position < nframes:
                    block = src.readframes(min(262144, nframes - position))
                    if not block:
                        raise EOFError(f"Truncated WAV: {srcfile}")
                    frame_count = len(block) // (params[0] * params[1])
                    if frame_count == 0 or len(block) % (params[0] * params[1]):
                        raise ValueError(f"Bad PCM data: {srcfile}")
                    dst.writeframesraw(block)
                    position += frame_count
                if position != nframes:
                    raise ValueError(f"Frame mismatch in {segment}")
                records.append({
                    "id": segment,
                    "source_file": srcfile.name,
                    "duration_seconds": round(seconds, 3),
                    "start_seconds": round(total_frames / params[2], 3),
                    "end_seconds": round((total_frames + nframes) / params[2], 3),
                    "sha256": checksum(srcfile),
                })
                total_frames += nframes
        dst.writeframes(b"")
    with wave.open(str(master), "rb") as verify:
        if verify.getnframes() != total_frames:
            raise RuntimeError("Joined WAV frame count does not equal segment frame sum")
    report = {
        "route": "VP-PAR-NOW-05",
        "origin_github_run": 41238865083,
        "status": "PRIVATE_AUDIO_QA_ONLY_NOT_COMMERCIAL_RELEASE",
        "source_voice": "Chatterbox Multilingual V3; same French reference and settings",
        "spoken_years_and_centuries_qa": "PENDING — V5 WAV sources may pronounce numeral/century strings incorrectly; words-only text manifest added separately; no rerender in this assembly",
        "edits": "None; exact ordered PCM concatenation",
        "chapters": records,
        "sample_rate": metadata[2],
        "channels": metadata[0],
        "sample_width_bytes": metadata[1],
        "total_frames": total_frames,
        "duration_seconds": round(total_frames / metadata[2], 3),
        "master_wav": master.name,
        "master_sha256": checksum(master),
    }
    (args.output_dir / "PARIS05-FR-V5-11SEG-QA.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({"status": report["status"], "segments": len(records),
                      "duration_seconds": report["duration_seconds"],
                      "master_sha256": report["master_sha256"]}, ensure_ascii=False))

if __name__ == "__main__":
    main()
