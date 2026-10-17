#!/usr/bin/env python3
"""Render the full Velvet Passport Paris 05 French route with Chatterbox V3.

Generates one WAV per segment plus one concatenated route WAV. The narration
is generated sentence-by-sentence with explicit sentence and segment pauses,
then slowed with pitch preservation to the requested tempo.
"""
import argparse
import json
import re
from pathlib import Path


def safe_id(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "-", value.strip()).strip("-")
    if not cleaned:
        raise ValueError(f"Invalid segment ID: {value!r}")
    return cleaned


def sentence_chunks(text: str):
    chunks = [x.strip() for x in re.split(r"(?<=[.!?])\s+", text.strip()) if x.strip()]
    if not chunks:
        raise ValueError("No narration text")
    return chunks


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--exaggeration", type=float, default=0.72)
    parser.add_argument("--cfg-weight", type=float, default=0.30)
    parser.add_argument("--temperature", type=float, default=0.80)
    parser.add_argument("--pause-ms", type=int, default=420)
    parser.add_argument("--segment-pause-ms", type=int, default=1200)
    parser.add_argument("--tempo", type=float, default=0.96,
                        help="Pitch-preserving tempo multiplier; 0.96 is about 4% slower")
    args = parser.parse_args()

    if not 0.85 <= args.tempo <= 1.10:
        raise ValueError("tempo must be between 0.85 and 1.10")

    import librosa
    import numpy as np
    import soundfile as sf
    import torch
    import torchaudio
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    data = json.loads(args.manifest.read_text(encoding="utf-8"))
    if data.get("language") != "fr":
        raise ValueError("This renderer expects a French manifest")
    segments = data.get("segments") or []
    if not segments:
        raise ValueError("No segments found")

    args.output.mkdir(parents=True, exist_ok=True)
    model = ChatterboxMultilingualTTS.from_pretrained(device="cpu", t3_model="v3")
    sentence_silence = torch.zeros(int(model.sr * args.pause_ms / 1000), dtype=torch.float32)
    segment_silence = torch.zeros(int(model.sr * args.segment_pause_ms / 1000), dtype=torch.float32)

    route_parts = []
    report = []

    for index, segment in enumerate(segments, start=1):
        seg_id = safe_id(segment["id"])
        text = segment.get("text", "").strip()
        if not text:
            raise ValueError(f"Missing text for {seg_id}")

        parts = []
        for i, sentence in enumerate(sentence_chunks(text)):
            wav = model.generate(
                sentence,
                language_id="fr",
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
            if i < len(sentence_chunks(text)) - 1:
                parts.append(sentence_silence)

        seg_wav = torch.cat(parts)
        seg_path = args.output / f"{index:02d}-{seg_id}-fr-chatterbox-v3-tempo-096x.wav"
        torchaudio.save(str(seg_path), seg_wav.unsqueeze(0), model.sr)
        duration = len(seg_wav) / model.sr
        report.append({"index": index, "id": seg_id, "file": seg_path.name, "duration_seconds": duration})
        print(f"Generated {seg_path.name}: {duration:.1f}s")

        route_parts.append(seg_wav)
        if index < len(segments):
            route_parts.append(segment_silence)

    route = torch.cat(route_parts)
    route_path = args.output / "VP-PAR-NOW-05-fr-chatterbox-v3-tempo-096x-FULL.wav"
    torchaudio.save(str(route_path), route.unsqueeze(0), model.sr)

    total_duration = len(route) / model.sr
    report_path = args.output / "VP-PAR-NOW-05-fr-render-report.json"
    report_path.write_text(json.dumps({
        "route_id": data["route_id"],
        "model": "Chatterbox Multilingual V3",
        "language": "fr",
        "tempo": args.tempo,
        "pause_ms": args.pause_ms,
        "segment_pause_ms": args.segment_pause_ms,
        "sample_rate": model.sr,
        "total_duration_seconds": total_duration,
        "segments": report,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    info = sf.info(str(route_path))
    assert info.frames > info.samplerate * 60, info
    assert len(report) == len(segments)
    print(f"FULL ROUTE: {route_path.name}: {total_duration / 60:.2f} min at {model.sr} Hz")
    print(f"Report: {report_path.name}")


if __name__ == "__main__":
    main()
