#!/usr/bin/env python3
"""Post-render engineering QA for the locked Paris 05 French audio.
Objective signal checks only; a listening and visual-rights review remain mandatory.
"""
import json
import sys
from pathlib import Path
import numpy as np
import soundfile as sf

ORDER=["INTRO","STOP-01","TRANSITION-01-SEBAI","STOP-SEBAI-1977","TRANSITION-01-02","STOP-02","TRANSITION-02-03","STOP-03","TRANSITION-03-04","STOP-04","OUTRO"]
MIN_STOP_SECONDS=300.0

def analyze(file):
    info=sf.info(str(file))
    if info.frames<=0 or info.samplerate<=0:
        raise ValueError("Missing or invalid WAV audio")
    peak=0.0; clipping=0; total=0; longest_silent=0.0; silent_run=0
    # 100ms frames, threshold -50 dBFS for near-silence
    block=max(1, round(info.samplerate/10))
    with sf.SoundFile(file) as wav:
        while True:
            x=wav.read(block,dtype="float32",always_2d=True)
            if x.size==0: break
            v=np.abs(x)
            peak=max(peak,float(np.max(v)))
            clipping+=int(np.count_nonzero(v>=0.999))
            total+=v.size
            rms=float(np.sqrt(np.mean(x*x)))
            if rms<10**(-50/20):
                silent_run+=len(x)
                longest_silent=max(longest_silent,silent_run/info.samplerate)
            else:
                silent_run=0
    return {"duration_seconds":round(info.frames/info.samplerate,3),"samplerate":info.samplerate,"channels":info.channels,"peak_dbfs":round(20*np.log10(max(peak,1e-12)),2),"samples_near_fullscale":clipping,"fraction_near_fullscale":round(clipping/max(total,1),8),"longest_near_silence_seconds":round(longest_silent,2)}

def main():
    root=Path(sys.argv[1]) if len(sys.argv)>1 else Path("collected")
    results=[]; errors=[]; sr=None
    for sid in ORDER:
        meta=json.loads((root/(sid+".json")).read_text(encoding="utf-8"))
        f=root/meta["file"]
        a=analyze(f)
        if sr is None:sr=a["samplerate"]
        if a["samplerate"]!=sr:errors.append(sid+": inconsistent sample rate")
        if a["peak_dbfs"]>-.01:errors.append(sid+": peak close to full-scale")
        if a["fraction_near_fullscale"]>0.0001:errors.append(sid+": excessive near-clipping samples")
        if a["longest_near_silence_seconds"]>15:errors.append(sid+": unexpectedly long near-silence")
        if sid.startswith("STOP-") and a["duration_seconds"]<MIN_STOP_SECONDS:errors.append(sid+": too short")
        results.append({"id":sid,**a})
    report={"route_id":"VP-PAR-NOW-05","audio_version":"fr-v4","source_run":39194264293,"scope":"technical_signal_qa_not_human_listening","segments":results,"errors":errors,"status":"PASS" if not errors else "FAIL","human_listening_required":True}
    Path("engineering-qa").mkdir(exist_ok=True)
    Path("engineering-qa/paris-05-fr-v4-signal-qa.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    for r in results:print(r["id"],r["duration_seconds"],"s | peak",r["peak_dbfs"],"dBFS | max near-silence",r["longest_near_silence_seconds"],"s")
    print("SIGNAL_QA_STATUS",report["status"],errors)
    return 0 if not errors else 1

if __name__=="__main__":raise SystemExit(main())
