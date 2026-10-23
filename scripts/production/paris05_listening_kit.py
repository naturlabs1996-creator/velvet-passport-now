#!/usr/bin/env python3
"""Paris 05 listening kit. Extract 11 review chapters from the already-built FR/EN films.
No publication or human quality approval is implied.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

import imageio_ffmpeg

lang = os.environ["VP_LANG"]
assert lang in ("fr", "en")
root = Path("listening")
root.mkdir(parents=True, exist_ok=True)
src = Path("incoming") / f"PARIS05-{lang.upper()}-CURATED-HISTORICAL-PRIVATE-MASTER.mp4"
assert src.is_file(), f"Missing final historical review movie: {src}"
chapter_info = json.loads(Path("docs/production/paris05-measured-master-chapter-timecodes.json").read_text())["tracks"][lang]["chapters"]
qa = json.loads(Path("incoming/qa.json").read_text())
assert qa["lang"] == lang and qa["chapters"] == 11
assert qa["historical_image_appearances"] >= 15 and qa["final_commercial_rights_and_voice_clearance"] is False
assert len(chapter_info) == 11
ff = imageio_ffmpeg.get_ffmpeg_exe()
def ffcall(args, check=True):
    return subprocess.run([ff, "-hide_banner", *args], capture_output=True, text=True, check=check)
def probe(path):
    p = ffcall(["-i", str(path)], check=False)
    data = p.stderr
    m = re.search(r"Duration:\\s*(\\d+):(\\d+):(\\d+\\.\\d+)", data)
    assert m, (path, data[-1000:])
    dur = int(m[1])*3600 + int(m[2])*60 + float(m[3])
    return {"duration":dur, "video":bool(re.search(r"Video:",data)), "audio":bool(re.search(r"Audio:",data)), "subtitle":bool(re.search(r"Subtitle:",data))}
info = probe(src)
expected = {"fr":3694.30,"en":3750.76}[lang]
assert abs(info["duration"] - expected) < 0.8, (info, expected)
assert info["video"] and info["audio"] and info["subtitle"], info
splice = {"fr":711.82,"en":718.94}[lang]
delta = {"fr":18.08,"en":16.28}[lang]
starts = [round(float(x["start_seconds"]) + (delta if float(x["start_seconds"]) > splice else 0), 3) for x in chapter_info]
assert starts[0] == 0
assert all(b > a for a,b in zip(starts,starts[1:]))
assert abs(starts[-1] - ({"fr":3613.18,"en":3680.28}[lang])) < 0.01
ends = starts[1:]+[expected]
labels_fr = ["Introduction","Ernest Appert","Transition vers Sebaï","Laïd Sebaï, 1977",
"Transition vers Joséphine","Joséphine de Beauharnais, 1819","Transition vers l'Opéra",
"Paris et l'Opéra, août 1944","Transition vers rue d'Antin","Duel Beaufort-Nemours, 1652","Conclusion"]
labels_en = ["Introduction","Ernest Appert","Walking towards Sebaï","Laïd Sebaï, 1977",
"Walking towards Joséphine","Joséphine de Beauharnais, 1819","Walking towards the Opera",
"Paris and the Opera, August 1944","Walking towards rue d'Antin","Beaufort-Nemours duel, 1652","Conclusion"]
names = labels_fr if lang=="fr" else labels_en
def clock(t):
    n = int(t);return f"{n//3600:02d}:{n//60%60:02d}:{n%60:02d}"
parts = []
for i,(ch,start,end,name) in enumerate(zip(chapter_info,starts,ends,names),1):
    assert end > start
    output = root/f"{i:02d}-{ch['id']}.m4a"
    ffcall(["-loglevel","error","-y","-ss",f"{start:.3f}","-i",str(src),"-t",f"{end-start:.3f}","-map","0:a:0","-vn","-c:a","aac","-b:a","128k",str(output)])
    got = probe(output)
    assert got["audio"] and abs(got["duration"]-(end-start)) < 0.45,(str(output),got,end-start)
    assert output.stat().st_size > 7000
    parts.append({"number":i,"id":ch["id"],"label":name,"start_seconds":start,"end_seconds":end,"duration_seconds":round(end-start,3),"file":output.name,"bytes":output.stat().st_size,"sha256":hashlib.sha256(output.read_bytes()).hexdigest()})
assert abs(sum(x["duration_seconds"] for x in parts)-expected) < 0.03
# A close listen to the inserted Sebai declaration can be done separately.
spot = root/"12-CONTROLE-INSERT-SEBAI.m4a"
spotstart = splice-3
spotlength = delta+11
ffcall(["-loglevel","error","-y","-ss",f"{spotstart:.3f}","-i",str(src),"-t",f"{spotlength:.3f}","-map","0:a:0","-vn","-c:a","aac","-b:a","128k",str(spot)])
assert probe(spot)["audio"]
manifest={"route":"VP-PAR-05","language":lang,"status":"READY_FOR_HUMAN_LISTENING_REVIEW","not_commercially_approved":True,"source_run":40025579787,"source_film":src.name,"film_duration_seconds":info["duration"],"chapter_files":parts,"sebai_excerpt":spot.name,"historical_image_appearances":qa["historical_image_appearances"],"documentary_substitutions":qa["documentary_substitutions"],"unresolved":["Human narration QA","Subtitle proofread","English internal image cue alignment" if lang=="en" else "Commercial rights and final editorial review","Commercial publication approval"]}
(root/"LISTENING-MANIFEST.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
lines=[f"# Velvet Passport — Paris 05 ({lang.upper()}) — guide d'écoute","",
"**Écoute humaine à effectuer.** Ce lot n'est pas un feu vert commercial.",
f"**Film d'origine** : {info['duration']/60:.2f} minutes, vidéo/audio/sous-titres détectés.",
"","## Chapitres séparés","",
"| # | Section | Début du film | Fin du film | Audio |","|---|---|---|---|---|"]
for x in parts:
    lines.append(f"| {x['number']:02d} | {x['label']} | {clock(x['start_seconds'])} | {clock(x['end_seconds'])} | {x['file']} |")
lines += ["",f"**Insert Laïd Sebaï** : piste séparée `{spot.name}`, pour vérifier le raccord, la prononciation et le volume.","",
"## À écouter et vérifier","",
"- Coupures, mots avalés, débit, volume et raccord Sebaï.",
"- Concordance FR/EN des noms, dates et événements.",
"- Lire les sous-titres en activant leur piste dans le film original.",
"- Vérifier les images et les légendes; le calage anglais des images est encore provisoire.",
"- Aucune approbation commerciale automatique à l'issue de cette inspection.","",
"**Décision possible après écoute** : OK audio / correction audio ciblée / recaler les images EN."]
(root/"GUIDE-ECOUTE.md").write_text("\n".join(lines)+"\n")
print(json.dumps({"lang":lang,"chapters":len(parts),"film_duration":info["duration"],"total_chapter_seconds":sum(x["duration_seconds"] for x in parts),"spot_excerpt":spot.name,"historical":qa["historical_image_appearances"],"substitutes":qa["documentary_substitutions"],"status":"READY_FOR_HUMAN_LISTENING_REVIEW"},ensure_ascii=False),flush=True)
