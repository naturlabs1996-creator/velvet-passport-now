#!/usr/bin/env python3
"""Render short candidate pronunciations, never touch locked master audio."""
import json,sys,pathlib
import torch,torchaudio
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
m=json.loads(pathlib.Path(sys.argv[1]).read_text())
out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
model=ChatterboxMultilingualTTS.from_pretrained(device="cpu",t3_model="v3")
qa=[]
for row in m["auditions"]:
    wav=model.generate(row["candidate"],language_id="fr",exaggeration=0.72,cfg_weight=0.30,temperature=0.80,audio_prompt_path=sys.argv[3]).squeeze(0).cpu()
    torchaudio.save(str(out/(row["id"]+".wav")),wav.unsqueeze(0),model.sr)
    qa.append({"id":row["id"],"canonical":row["canonical"],"candidate":row["candidate"],"duration":round(len(wav)/model.sr,3),"human_approval":"PENDING","editorial_edited":False})
(out/"QA-PRONUNCIATION-CANDIDATES.json").write_text(json.dumps(qa,ensure_ascii=False,indent=2))
print(json.dumps(qa,ensure_ascii=False,indent=2))
