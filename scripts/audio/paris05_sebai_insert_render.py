"""Render short, separate Laid Sebai insert WAV; original masters unchanged."""
import json,re,sys
from pathlib import Path
import torch,torchaudio
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
language=sys.argv[1]
assert language in ("fr","en")
root=Path("insert-audio");root.mkdir(exist_ok=True)
if language=="fr":
 text=Path("docs/production/paris05-sebai-approved-insert.md").read_text().split("## Texte exact approuvé")[1].split("## Règles de production")[0].strip().strip("«»").strip()
 reference="references/developer-1.mp3"
else:
 text=Path("docs/production/paris05-sebai-insert-bilingual.md").read_text().split('EN editorial adaptation (awaiting voice listening QA):')[1].split('Render insert as')[0].strip().strip('"')
 reference="references/p232.wav"
parts=[v.strip() for v in re.split(r"(?<=[.!?])\\s+|\\n\\s*\\n",text) if v.strip()]
model=ChatterboxMultilingualTTS.from_pretrained(device="cpu",t3_model="v3")
clips=[]
for index,p in enumerate(parts):
 a=model.generate(p,language_id=language,audio_prompt_path=reference,exaggeration=.72,cfg_weight=.3,temperature=.8).squeeze(0).cpu()
 clips.append(a)
 if index<len(parts)-1:clips.append(torch.zeros(int(model.sr*.35)))
full=torch.cat(clips)
name=f"PARIS05-SEBAI-INSERT-{language.upper()}-REVIEW.wav"
torchaudio.save(str(root/name),full.unsqueeze(0),model.sr)
(root/f"qa-{language}.json").write_text(json.dumps({"language":language,"duration_sec":len(full)/model.sr,"master_modified":False,"listening_qa":"PENDING","commercial_approval":False},indent=2))
print(language,name,len(full)/model.sr)
