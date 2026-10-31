#!/usr/bin/env python3
"""Experimental CPU batch renderer: reuse one Chatterbox model across multiple segments.

No changes to the approved source text, voice parameters, or native tempo.
Outputs separate WAV and QA JSON per segment; does not replace production artifacts.
"""
import argparse
import hashlib
import json
import re
import time
from pathlib import Path

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--segment-id", action="append", dest="segment_ids", required=True)
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument("--pause-ms", type=int, default=420)
    args = parser.parse_args()
    import torch
    import torchaudio
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    source = args.manifest.read_bytes()
    manifest = json.loads(source)
    selected = {s["id"]: s for s in manifest["segments"]}
    if len(set(args.segment_ids)) != len(args.segment_ids):
        raise ValueError("Duplicate segment ID")
    for segment_id in args.segment_ids:
        if segment_id not in selected:
            raise ValueError(f"Unknown segment: {segment_id}")
    args.output.mkdir(parents=True, exist_ok=True)
    start = time.perf_counter()
    model = ChatterboxMultilingualTTS.from_pretrained(device="cpu", t3_model="v3")
    load_seconds = round(time.perf_counter() - start, 3)
    pause = torch.zeros(round(model.sr * args.pause_ms / 1000), dtype=torch.float32)
    kwargs = dict(language_id="fr", exaggeration=0.72, cfg_weight=0.30,
                  temperature=0.80, audio_prompt_path=str(args.reference))
    for segment_id in args.segment_ids:
        seg = selected[segment_id]
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\\s+", seg["text"].strip()) if s.strip()]
        if not sentences:
            raise ValueError(f"Empty segment: {segment_id}")
        began = time.perf_counter()
        pieces = []
        with torch.inference_mode():
            for i, sentence in enumerate(sentences):
                pieces.append(model.generate(sentence, **kwargs).squeeze(0).cpu())
                if i + 1 < len(sentences):
                    pieces.append(pause)
        combined = torch.cat(pieces)
        output = args.output / f"{segment_id}-FR-NATIVE-100.wav"
        torchaudio.save(str(output), combined.unsqueeze(0), model.sr)
        report = dict(route="VP-PAR-NOW-05", id=segment_id, segment_title=seg["title"],
                      duration_seconds=round(len(combined) / model.sr, 3),
                      sample_rate=model.sr, peak=float(combined.abs().max()),
                      native_tempo=1.0, digital_time_stretch=False,
                      sentences=len(sentences), manifest_sha256=hashlib.sha256(source).hexdigest(),
                      speaker_reference=str(args.reference),
                      role="INTERNAL QA ONLY — commercial voice rights pending",
                      minimum_stop_300_seconds_pass=(len(combined) / model.sr >= 300)
                      if segment_id.startswith("STOP") else None,
                      editorial_text_modified=False, asset=output.name,
                      model_load_seconds=load_seconds,
                      segment_wall_seconds=round(time.perf_counter() - began, 3),
                      experimental_batch=True)
        (args.output / f"{segment_id}-QA.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
        print(json.dumps(report, ensure_ascii=False), flush=True)
    print(json.dumps({"batch_wall_seconds":round(time.perf_counter()-start,3),
                      "model_load_count":1,"segments":len(args.segment_ids)}))
if __name__ == "__main__":
    main()
