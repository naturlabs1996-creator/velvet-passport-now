#!/usr/bin/env python3
"""Generate an expressive two-file QA sample for Velvet Passport Paris 05.

This is deliberately a QA-only renderer: one stop, French + English.
It uses Chatterbox Multilingual V3 on CPU, generates sentence by sentence,
inserts explicit pauses, and can apply a very small pitch-preserving tempo
adjustment for a calmer documentary delivery.
"""
import argparse
import json
import re
from pathlib import Path


def safe_id(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9_-]+", value):
        raise ValueError("Invalid stop ID")
    return value


def sentence_chunks(text: str):
    chunks = [x.strip() for x in re.split(r"(?<=[.!?])\s+", text.strip()) if x.strip()]
    if not chunks:
        raise ValueError("No narration text")
    return chunks


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--stop-id", default="VP-PAR-NOW-05-ST-05-01")
    parser.add_argument("--exaggeration", type=float, default=0.72)
    parser.add_argument("--cfg-weight", type=float, default=0.30)
    parser.add_argument("--temperature", type=float, default=0.80)
    parser.add_argument("--pause-ms", type=int, default=420)
    parser.add_argument("--tempo", type=float, default=0.96,
                        help="Pitch-preserving tempo multiplier; 0.96 is about 4% slower")
    args = parser.parse_args()

    if not 0.85 <= args.tempo <= 1.10:
        raise ValueError("tempo must be between 0.85 and 1.10")

    import librosa
    import numpy as np
    import torch
    import torchaudio
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    data = json.loads(args.manifest.read_text(encoding="utf-8"))
    stop = next((s for s in data["stops"] if s["id"] == args.stop_id), None)
    if stop is None:
        raise ValueError(f"Stop not found: {args.stop_id}")

    stop_id = safe_id(stop["id"])
    args.output.mkdir(parents=True, exist_ok=True)

    model = ChatterboxMultilingualTTS.from_pretrained(device="cpu", t3_model="v3")
    silence = torch.zeros(int(model.sr * args.pause_ms / 1000), dtype=torch.float32)

    for lang in ("fr", "en"):
        text = stop.get(lang, "").strip()
        if not text:
            raise ValueError(f"Missing {lang} text")

        sentences = sentence_chunks(text)
        parts = []
        for i, sentence in enumerate(sentences):
            wav = model.generate(
                sentence,
                language_id=lang,
                exaggeration=args.exaggeration,
                cfg_weight=args.cfg_weight,
                temperature=args.temperature,
            ).squeeze(0).cpu()

            if args.tempo != 1.0:
                stretched = librosa.effects.time_stretch(
                    np.asarray(wav, dtype=np.float32), rate=args.tempo
                )
                wav = torch.from_numpy(np.asarray(stretched, dtype=np.float32))

            parts.append(wav)
            if i < len(sentences) - 1:
                parts.append(silence)

        final = torch.cat(parts).unsqueeze(0)
        out = args.output / f"{stop_id}-{lang}-chatterbox-v3.wav"
        torchaudio.save(str(out), final, model.sr)
        print(f"Generated {out} at {model.sr} Hz, tempo={args.tempo:.2f}")

    print("QA ONLY: listen for human pacing, emotion, pauses, names and accent before wider generation.")


if __name__ == "__main__":
    main()
