#!/usr/bin/env python3
import json,pathlib,sys
import torch,torchaudio
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
m=json.loads(pathlib.Path(sys.argv[1]).read_text())
out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
model=ChatterboxMultilingualTTS.from_pretrained(device="cpu",t3_model="v3")
wave=model.generate(m["candidate"],language_id="fr",exaggeration=.72,cfg_weight=.30,temperature=.80,audio_prompt_path=sys.argv[3]).squeeze(0).cpu()
torchaudio.save(str(out/"INTRO-Louis-le-Grand-LAST-CHECK.wav"),wave.unsqueeze(0),model.sr)
(out/"QA-LAST-CHECK.json").write_text(json.dumps({"status":"USER_LISTENING_REQUIRED","candidate":m["candidate"],"sample_rate":model.sr,"duration_seconds":round(len(wave)/model.sr,3),"master_unchanged":True},ensure_ascii=False,indent=2))
