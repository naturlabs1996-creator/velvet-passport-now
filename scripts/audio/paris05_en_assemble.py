#!/usr/bin/env python3
"""Fail-closed assembly of the eleven Paris 05 English production WAVs."""
import json
from pathlib import Path
import numpy as np
import soundfile as sf

ORDER = [
    "INTRO", "STOP-01", "TRANSITION-01-SEBAI", "STOP-SEBAI-1977",
    "TRANSITION-01-02", "STOP-02", "TRANSITION-02-03", "STOP-03",
    "TRANSITION-03-04", "STOP-04", "OUTRO",
]
ROOT = Path("collected")
OUTPUT = Path("assembled-en")
OUTPUT.mkdir(exist_ok=True)
pieces = []
report = []
sample_rate = None
for index, seg in enumerate(ORDER):
    folder = ROOT / seg
    files = list(folder.rglob("*.wav"))
    # Never silently accept an audition reference or an unexpected second WAV.
    files = [f for f in files if "reference" not in f.name.lower()]
    if len(files) != 1:
        raise RuntimeError(f"{seg}: expected exactly one rendered WAV; got {[str(x) for x in files]}")
    wav = files[0]
    data, sr = sf.read(wav, dtype="float32")
    if data.ndim == 2:
        if data.shape[1] != 1:
            raise RuntimeError(f"{seg}: unexpected multi-channel audio")
        data = data[:, 0]
    if sr < 22050 or not len(data) or not np.isfinite(data).all():
        raise RuntimeError(f"{seg}: invalid audio data")
    if sample_rate is None:
        sample_rate = sr
    if sr != sample_rate:
        raise RuntimeError(f"{seg}: sampling rate {sr} differs from {sample_rate}")
    seconds = len(data) / sr
    if seconds < 8:
        raise RuntimeError(f"{seg}: suspiciously short audio ({seconds:.1f}s)")
    peak = float(np.max(np.abs(data)))
    if peak > 1.0:
        raise RuntimeError(f"{seg}: clipped audio")
    pieces.append(data)
    report.append({"id": seg, "filename": str(wav), "duration_seconds": round(seconds, 3), "peak": round(peak, 6)})
    if index < len(ORDER)-1:
        pieces.append(np.zeros(round(sr * 1.2), dtype=np.float32))
audio = np.concatenate(pieces)
outfile = OUTPUT / "PARIS05-EN-FULL-11SEG-p232-UNREVIEWED.wav"
sf.write(outfile, audio, sample_rate, subtype="PCM_24")
summary = {
    "route": "VP-PAR-NOW-05", "language": "en",
    "status": "AUTOMATED_ASSEMBLY_PASS_HUMAN_AUDIO_QA_PENDING",
    "voice": "p232", "sample_rate": sample_rate,
    "duration_seconds": round(len(audio)/sample_rate, 3),
    "segment_count": len(report), "segments": report,
    "commercial_voice_rights": "PENDING",
}
(OUTPUT / "PARIS05-EN-ASSEMBLY-QA.json").write_text(json.dumps(summary, indent=2))
print(json.dumps(summary, indent=2))
