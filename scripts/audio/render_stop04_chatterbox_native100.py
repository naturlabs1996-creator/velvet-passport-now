#!/usr/bin/env python3
"""Regenerate locked STOP04 French narration at Chatterbox native tempo (no time-stretch)."""
import argparse
import hashlib
import json
import re
from pathlib import Path

import numpy as np
import torch
import torchaudio
from chatterbox.mtl_tts import ChatterboxMultilingualTTS


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", type=Path, required=True)
    ap.add_argument("--scene", required=True)
    ap.add_argument("--reference", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()

    raw = args.manifest.read_bytes()
    manifest = json.loads(raw)
    scene = next(item for item in manifest["scenes"] if item["id"] == args.scene)
    text = scene["text"]
    settings = manifest["tts"]
    assert settings["tempo"] == 1.0 and not settings["digital_time_stretch"]
    assert settings["pause_ms"] == 420
    assert args.reference.is_file() and args.reference.stat().st_size > 10000
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    assert sentences, "Missing approved spoken text"
    torch.set_num_threads(2)
    model = ChatterboxMultilingualTTS.from_pretrained(device="cpu", t3_model="v3")
    pause = torch.zeros(round(model.sr * settings["pause_ms"] / 1000), dtype=torch.float32)
    args.output.mkdir(parents=True, exist_ok=True)
    # Produce two full native takes for S20 because the old take glitches at the end.
    take_seeds = [20261111, 20261112] if args.scene == "S20" else [20261111]
    for take, seed in enumerate(take_seeds, start=1):
        chunks = []
        durations = []
        for i, sentence in enumerate(sentences):
            torch.manual_seed(seed + i * 101)
            wav = model.generate(
                sentence,
                language_id="fr",
                audio_prompt_path=str(args.reference),
                exaggeration=settings["exaggeration"],
                cfg_weight=settings["cfg_weight"],
                temperature=settings["temperature"],
            ).squeeze(0).cpu().float()
            assert wav.numel() > 1000 and torch.isfinite(wav).all(), f"Invalid audio in {args.scene}, sentence {i}"
            chunks.append(wav)
            durations.append(round(wav.numel() / model.sr, 3))
            if i < len(sentences) - 1:
                chunks.append(pause)
        full = torch.cat(chunks)
        peak = float(full.abs().max().item())
        assert peak < 0.9999, "Unexpected clipping"
        file_name = f"{args.scene}_CHATTERBOX_V3_NATIVE100_T{take}_QA.wav"
        out = args.output / file_name
        torchaudio.save(str(out), full.unsqueeze(0), model.sr)
        tail = full[-round(model.sr * 0.15):].numpy()
        report = {
            "scene": args.scene, "take": take, "file": file_name,
            "engine": "Chatterbox Multilingual V3", "voice_reference": "developer-1.mp3",
            "native_tempo": 1.0, "digital_time_stretch": False,
            "duration_seconds": round(full.numel() / model.sr, 3), "sample_rate": model.sr,
            "peak": peak, "last_150ms_rms": float(np.sqrt(np.mean(tail * tail))),
            "sentence_durations": durations,
            "manifest_sha256": hashlib.sha256(raw).hexdigest(),
            "text_sha256": hashlib.sha256(text.encode()).hexdigest(),
            "quality": "TECHNICAL_QA_ONLY_NOT_AUDITORILY_APPROVED",
            "needs_listen": "Check complete text, consistent narrator, and final words. S20 last sentence especially."
        }
        (args.output / f"{args.scene}_T{take}_QA.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf8"
        )
        print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
