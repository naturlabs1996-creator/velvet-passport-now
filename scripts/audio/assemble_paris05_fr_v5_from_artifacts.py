#!/usr/bin/env python3
"""Concatenate Paris 05 V5 native Chatterbox WAVs as a private QA master.

Handles the source IEEE float32 WAV encoding. No re-generation, tempo
stretching, resampling, loudness normalization or speech edits.
"""
import argparse
import hashlib
import json
from pathlib import Path
import soundfile as sf

IDS = [
    "INTRO", "STOP-01", "TRANSITION-01-SEBAI", "STOP-SEBAI-1977",
    "TRANSITION-01-02", "STOP-02", "TRANSITION-02-03",
    "STOP-03", "TRANSITION-03-04", "STOP-04", "OUTRO",
]

def checksum(path):
    h = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1048576), b""):
            h.update(block)
    return h.hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-root", type=Path, default=Path("downloaded"))
    parser.add_argument("--output-dir", type=Path, default=Path("assembled-v5-qa"))
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    master = args.output_dir / "PARIS05-FR-V5-11SEG-QA.wav"
    info = None
    chapters = []
    total_frames = 0
    output = None
    try:
        for segment in IDS:
            source_path = args.input_root / segment / f"{segment}-FR-NATIVE-100.wav"
            if not source_path.is_file():
                raise FileNotFoundError(f"Missing WAV for {segment}: {source_path}")
            with sf.SoundFile(source_path, "r") as source:
                params = (source.samplerate, source.channels, source.subtype)
                if info is None:
                    info = params
                    if source.format != "WAV" or source.subtype != "FLOAT":
                        raise ValueError(f"Expected Chatterbox WAV FLOAT, got {source.format} {source.subtype}")
                    output = sf.SoundFile(
                        master, mode="w", samplerate=source.samplerate,
                        channels=source.channels, format="WAV", subtype="FLOAT"
                    )
                elif params != info:
                    raise ValueError(f"Incompatible WAV params for {segment}: {params} != {info}")
                frame_count = source.frames
                written = 0
                while written < frame_count:
                    block = source.read(min(262144, frame_count - written),
                                        dtype="float32", always_2d=True)
                    if block.shape[0] == 0:
                        raise EOFError(f"Truncated source WAV for {segment}")
                    output.write(block)
                    written += block.shape[0]
                if written != frame_count:
                    raise RuntimeError(f"Frame mismatch for {segment}")
                chapters.append({
                    "id": segment,
                    "start_seconds": round(total_frames / info[0], 3),
                    "duration_seconds": round(frame_count / info[0], 3),
                    "end_seconds": round((total_frames + frame_count) / info[0], 3),
                    "source_file": source_path.name,
                    "source_sha256": checksum(source_path),
                })
                total_frames += frame_count
    finally:
        if output is not None:
            output.close()

    with sf.SoundFile(master, "r") as verify:
        if (verify.frames, verify.samplerate, verify.channels, verify.subtype) != (
            total_frames, info[0], info[1], "FLOAT"
        ):
            raise RuntimeError("Final WAV readback did not match source frame total")
    report = {
        "route": "VP-PAR-NOW-05",
        "origin_github_run": 41238865083,
        "status": "PRIVATE_AUDIO_QA_ONLY_NOT_COMMERCIAL_RELEASE",
        "source_voice": "Chatterbox Multilingual V3; original French reference",
        "spoken_years_and_centuries_qa": "PENDING — V5 WAV sources may pronounce numerals incorrectly; separate normalized TTS manifest exists; no rerender here",
        "edits": "None; native float32 audio concatenation without resampling",
        "chapters": chapters,
        "sample_rate": info[0],
        "channels": info[1],
        "format": "WAV IEEE float32",
        "total_frames": total_frames,
        "duration_seconds": round(total_frames / info[0], 3),
        "master_wav": master.name,
        "master_sha256": checksum(master),
    }
    (args.output_dir / "PARIS05-FR-V5-11SEG-QA.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({"status": report["status"], "segments": len(chapters),
                      "duration_seconds": report["duration_seconds"],
                      "master_sha256": report["master_sha256"]}, ensure_ascii=False))

if __name__ == "__main__":
    main()
