#!/usr/bin/env python3
"""Offline batch TTS for Velvet Passport pilot. No paid API.

Install: pip install kokoro soundfile numpy
Usage: python scripts/audio/render_kokoro.py docs/pilots/paris-05-audio-input.json out/audio

Input JSON: {"stops":[{"id":"VP-PAR-NOW-05-ST-05-01","fr":"Texte...", "en":"Text..."}]}
Output: one WAV per stop and language; keep scripts as source of truth in Supabase.
Review pronunciation and rights before publishing; WAV files are not automatically deployed.
"""
import argparse
import json
import re
from pathlib import Path

def safe_id(value):
    if not re.fullmatch(r"[A-Za-z0-9_-]+", value):
        raise ValueError("Invalid stop ID")
    return value

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--fr-voice", default="ff_siwis")
    parser.add_argument("--en-voice", default="bf_emma")
    args = parser.parse_args()
    from kokoro import KPipeline
    import numpy as np
    import soundfile as sf

    data = json.loads(args.manifest.read_text(encoding="utf-8"))
    args.output.mkdir(parents=True, exist_ok=True)
    pipelines = {"fr": KPipeline(lang_code="f"), "en": KPipeline(lang_code="b")}
    voices = {"fr": args.fr_voice, "en": args.en_voice}
    for stop in data["stops"]:
        stop_id = safe_id(stop["id"])
        for lang in ("fr", "en"):
            script = stop.get(lang, "").strip()
            if not script:
                raise ValueError(f"Missing {lang} script: {stop_id}")
            chunks = []
            for _, _, audio in pipelines[lang](script, voice=voices[lang], speed=1):
                if audio is not None:
                    chunks.append(np.asarray(audio, dtype=np.float32))
            if not chunks:
                raise RuntimeError(f"No audio generated: {stop_id} {lang}")
            destination = args.output / f"{stop_id}-{lang}.wav"
            sf.write(destination, np.concatenate(chunks), 24000)
            print(f"Generated {destination}")
    print("Listen and QA all files before converting/deploying.")

if __name__ == "__main__":
    main()
