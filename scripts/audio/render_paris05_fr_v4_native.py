#!/usr/bin/env python3
"""Render locked Paris 05 FR V4 segments using native Chatterbox tempo 1.00."""
import argparse
import json
import re
from pathlib import Path

def main():
    p = argparse.ArgumentParser()
    p.add_argument("manifest", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument("--segment-id", required=True)
    p.add_argument("--reference", type=Path, default=None)
    p.add_argument("--pause-ms", type=int, default=420)
    args = p.parse_args()
    import torch
    import torchaudio
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    src = args.manifest.read_bytes()
    data = json.loads(src)
    seg = next(s for s in data["segments"] if s["id"] == args.segment_id)
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", seg["text"].strip()) if s.strip()]
    if not sentences: raise ValueError("Empty segment")
    model = ChatterboxMultilingualTTS.from_pretrained(device="cpu", t3_model="v3")
    pause = torch.zeros(round(model.sr * args.pause_ms / 1000), dtype=torch.float32)
    kwargs = {"language_id":"fr", "exaggeration":0.72,"cfg_weight":0.30,"temperature":0.80}
    if args.reference:
        kwargs["audio_prompt_path"] = str(args.reference)
    audio = []
    for index,sentence in enumerate(sentences):
        part = model.generate(sentence, **kwargs).squeeze(0).cpu()
        audio.append(part)
        if index < len(sentences)-1: audio.append(pause)
    combined = torch.cat(audio)
    args.output.mkdir(parents=True, exist_ok=True)
    out = args.output / f'{args.segment_id}-FR-NATIVE-100.wav'
    torchaudio.save(str(out), combined.unsqueeze(0), model.sr)
    peak = float(combined.abs().max())
    duration = round(len(combined)/model.sr, 3)
    from hashlib import sha256
    report = {
        "route":"VP-PAR-NOW-05", "id":seg["id"], "segment_title":seg["title"],
        "duration_seconds":duration,"sample_rate":model.sr,"peak":peak,
        "native_tempo":1.0,"digital_time_stretch":False,"sentences":len(sentences),
        "manifest_sha256":sha256(src).hexdigest(),"speaker_reference":str(args.reference) if args.reference else "native-default",
        "role":"INTERNAL QA ONLY — commercial voice rights pending",
        "minimum_stop_300_seconds_pass": duration >= 300 if seg["id"].startswith("STOP") else None,
        "editorial_text_modified":False,
        "asset":out.name
    }
    (args.output / f'{args.segment_id}-QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False))
if __name__ == "__main__": main()
