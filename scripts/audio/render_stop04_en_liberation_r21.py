#!/usr/bin/env python3
"""Render the 28 English STOP04 Liberation voice plans at native tempo."""
import argparse, gc, hashlib, json, re, subprocess
from pathlib import Path
import numpy as np
import soundfile as sf
import torch
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--manifest",type=Path,required=True)
    ap.add_argument("--group",type=int,required=True,choices=range(4))
    ap.add_argument("--reference",type=Path,required=True)
    ap.add_argument("--out",type=Path,required=True)
    args=ap.parse_args()
    obj=json.loads(args.manifest.read_text())
    assert obj["stop_id"]=="STOP04" and "Liberation" in obj["subject"]
    assert len(obj["plans"])==28 and len(obj["archive_plans"])==2
    assert len({p["id"] for p in obj["plans"]})==28
    selected=[p for p in obj["plans"] if p["group"]==args.group]
    assert len(selected)==7
    args.out.mkdir(parents=True,exist_ok=True)
    torch.set_num_threads(2)
    model=ChatterboxMultilingualTTS.from_pretrained(device="cpu",t3_model="v3")
    settings=obj["voice"]
    assert settings["tempo"]==1 and settings["digital_time_stretch"] is False
    pause=torch.zeros(round(model.sr*settings["pause_ms"]/1000),dtype=torch.float32)
    results=[]
    for plan in selected:
        chunks=[];cues=[];cursor=0.
        sentences=[s.strip() for s in re.split(r"(?<=[.!?])\s+",plan["text"]) if s.strip()]
        for i,text in enumerate(sentences):
            torch.manual_seed(20261127+args.group*1000+len(results)*100+i)
            wav=model.generate(text,language_id="en",audio_prompt_path=str(args.reference),
                exaggeration=settings["exaggeration"],cfg_weight=settings["cfg_weight"],
                temperature=settings["temperature"]).squeeze(0).cpu().float()
            assert torch.isfinite(wav).all() and wav.numel()>1000
            duration=wav.numel()/model.sr
            cues.append({"text":text,"start":round(cursor,5),"end":round(cursor+duration,5),"evidence":"actual generated sample counts"})
            chunks.append(wav);cursor+=duration
            if i<len(sentences)-1:chunks.append(pause);cursor+=pause.numel()/model.sr
        joined=torch.cat(chunks).numpy()
        peak=float(np.abs(joined).max())
        assert peak<.9999,("clipping",plan["id"],peak)
        file=args.out/(plan["id"]+"_EN_P232_NATIVE_QA.wav")
        sf.write(file,joined,model.sr,subtype="PCM_16")
        record={"plan":plan["id"],"language":"en","subject":obj["subject"],"file":file.name,
            "source_text":plan["text"],"source_text_sha256":hashlib.sha256(plan["text"].encode()).hexdigest(),
            "audio_sha256":hashlib.sha256(file.read_bytes()).hexdigest(),"speaker":"p232",
            "sample_rate":model.sr,"duration":len(joined)/model.sr,"peak":peak,
            "target_visual_duration":plan["target_duration"],
            "fits_existing_visual_range":len(joined)/model.sr<=plan["target_duration"]-.15,
            "no_time_stretch":True,"native_tempo":1.0,"sentences":cues,
            "status":"GENERATED_TECHNICAL_QA_ONLY","human_approved":False,
            "license_evidence":settings["license_evidence"]}
        (args.out/(plan["id"]+"_EN_NATIVE_QA.json")).write_text(json.dumps(record,ensure_ascii=False,indent=2))
        results.append(record)
        print(plan["id"],record["duration"],"fits",record["fits_existing_visual_range"],flush=True)
    del model;gc.collect()
    from faster_whisper import WhisperModel
    recognizer=WhisperModel("small",device="cpu",compute_type="int8",cpu_threads=2)
    for record in results:
        file=args.out/record["file"]
        raw=subprocess.check_output(["ffmpeg","-nostdin","-v","error","-i",str(file),"-ar","16000","-ac","1","-f","f32le","-"])
        x=np.frombuffer(raw,np.float32)
        segments,_=recognizer.transcribe(x,language="en",word_timestamps=True,beam_size=5,condition_on_previous_text=False,vad_filter=True)
        words=[{"start":w.start,"end":w.end,"text":w.word,"probability":w.probability} for s in segments for w in (s.words or [])]
        out={"plan":record["plan"],"audio_sha256":record["audio_sha256"],"model":"faster-whisper-small","words":words,"human_approved":False}
        (args.out/(record["plan"]+"_EN_WORDS_ASR_QA.json")).write_text(json.dumps(out,ensure_ascii=False,indent=2))
    (args.out/"GROUP_REPORT.json").write_text(json.dumps({"group":args.group,"plans":results,"release_approved":False},ensure_ascii=False,indent=2))
if __name__=="__main__":main()
