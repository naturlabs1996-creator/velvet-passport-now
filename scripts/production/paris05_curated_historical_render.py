#!/usr/bin/env python3
"""Garage Velvet Paris 05: historical visual edit with fail-closed licenses and factual context.
A private editorial candidate; not a commercial release or human QA attestation.
"""
import os, json, hashlib, subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import imageio_ffmpeg

lang=os.environ["VP_LANG"]
assert lang in ("fr","en")
P=Path("dist/paris05-curated-"+lang)
P.mkdir(parents=True,exist_ok=True)
reg=json.loads(Path("docs/production/paris05-visual-ingest-status.json").read_text())
edl=json.loads(Path("downloaded/edl/paris05-fr-image-edl-review.json").read_text())
chap=json.loads(Path("docs/production/paris05-measured-master-chapter-timecodes.json").read_text())["tracks"]
names_fr=["PARIS 05 · OPÉRA","ERNEST APPERT","VERS LA RUE LOUIS-LE-GRAND","LAÏD SEBAÏ · 1977","VERS JOSÉPHINE","JOSÉPHINE DE BEAUHARNAIS","VERS L'OPÉRA","PARIS · AOÛT 1944","VERS LA RUE D'ANTIN","BEAUFORT ET NEMOURS · 1652","FIN DU PARCOURS"]
names_en=["PARIS 05 · OPERA","ERNEST APPERT","TOWARDS RUE LOUIS-LE-GRAND","LAÏD SEBAÏ · 1977","TOWARDS JOSÉPHINE","JOSÉPHINE DE BEAUHARNAIS","TOWARDS THE OPERA","PARIS · AUGUST 1944","TOWARDS RUE D'ANTIN","BEAUFORT AND NEMOURS · 1652","END OF THE WALK"]
names=names_fr if lang=="fr" else names_en
chapter_ids=[z["id"] for z in chap["fr"]["chapters"]]
assert len(chapter_ids)==11
chapter_names=dict(zip(chapter_ids,names))
exclude=set(reg.get("excluded",[]))
known={a["id"]:a for a in reg["items"]}
original={}
files={}
for folder in (Path("downloaded/archival-main"),Path("downloaded/archival-targeted")):
    for prov in folder.rglob("provenance.json"):
        for a in json.loads(prov.read_text()).get("items",[]):
            if a.get("status")=="INGESTED_RIGHTS_REVIEW_REQUIRED":
                original[a["id"]]=a
                if a.get("local_file"):files[a["id"]]=prov.parent/a["local_file"]
ALLOW=("cc0","public domain","publicdomain","pd-old","pd-art","pd old","pd art")
def safe_asset(aid):
    if not aid or aid in exclude or aid not in known:return (None,"missing_or_excluded")
    a=original.get(aid)
    if not a:return(None,"missing_original_provenance")
    rights=(a.get("rights") or "").lower()
    if not any(tok in rights for tok in ALLOW):return(None,"no_open_license_metadata")
    if not a.get("page") or not a.get("sha256"):
        return(None,"incomplete_source_provenance")
    # Wikimedia Commons sometimes tags an old engraving PUBLIC DOMAIN with no
    # separate LicenseUrl. Its file description page holds the rights statement.
    # 1944 event images are excluded under the conservative author-term rule.
    if aid=="PARIS-1944":return(None,"1944_image_author_term_not_independently_resolved")
    if not a.get("rights_url") and rights.strip()!="public domain":
        return(None,"no_license_url_and_no_explicit_public_domain_statement")
    p=files.get(aid)
    if p is None or not p.exists():return(None,"file_unavailable")
    if hashlib.sha256(p.read_bytes()).hexdigest()!=a["sha256"]:
        return(None,"source_hash_mismatch")
    return(p,None)
font="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
big=ImageFont.truetype(font,43)
medium=ImageFont.truetype(font,24)
small=ImageFont.truetype(font,19)
context={
"MET-702001":"Photomontage historique d'Appert — scène fabriquée en atelier",
"APPERT-ROQUETTE":"Photomontage historique d'Appert — scène mise en scène",
"PARIS-1944":"Paris, 1944 — contexte historique, pas une vue de l'Opéra",
"MEURICE-PH19383":"Hôtel Meurice, 1944 — lieu distinct de l'Opéra",
"GOMBOUST-1652":"Plan de Paris, 1652 — position du duel non établie",
"MARVILLE-ANTIN-1866":"Rue d'Antin au XIXe siècle — pas une façade actuelle",
"MARVILLE-LOUIS-PH460":"Rue Louis-le-Grand au XIXe siècle — contexte",
"MARVILLE-OPERA-PH940":"Travaux de l'avenue de l'Opéra — contexte historique",
"MARVILLE-OPERA-ANTIN-1876":"Avenue de l'Opéra — photographie historique",
"RCIN-615675":"Portrait historique du duc de Nemours",
"BNF-BTV1B8405032K":"Gravure historique du duc de Beaufort",
"RP-P-1951-602":"Portrait historique de Joséphine de Beauharnais",
"TURGOT-LOUIS-1739":"Plan historique du quartier, 1739",
"OPERA-1900":"L'Opéra vers 1900 — pas une vue de 1944",
"OPERA-1900-LOC":"L'Opéra vers 1900 — contexte du quartier",
"GRANDE-MADEMOISELLE-P1983":"Portrait historique de la Grande Mademoiselle",
"BAUDIN-1801-MEDAL":"Médaille historique — contexte, non le catalogue de vente",
"VENDOME-1900":"Place Vendôme vers 1900 — contexte historique",
}
def wrapped(draw,x,y,s,maxchar=100):
    chunks=[]
    for word in s.split():
        if not chunks or len(chunks[-1]) + len(word) + 1>maxchar:chunks.append(word)
        else:chunks[-1]+=" "+word
    return chunks[:2]
def frame(event,i,p):
    im=Image.new("RGB",(1280,720),(22,31,44))
    dr=ImageDraw.Draw(im)
    dr.rectangle((0,0,1280,72),fill=(16,25,38))
    dr.line((40,80,1240,80),fill=(204,171,111),width=3)
    dr.text((34,21),"VELVET PASSPORT  /  PARIS 05",font=medium,fill=(245,245,241))
    dr.text((1110,23),"QA PRIVÉ" if lang=="fr" else "PRIVATE QA",font=small,fill=(202,175,125))
    aid=event.get("asset_id")
    usable=bool(p)
    if usable:
        pic=Image.open(p).convert("RGB")
        pic.thumbnail((1160,480),Image.Resampling.LANCZOS)
        im.paste(pic,((1280-pic.width)//2,92+(475-pic.height)//2))
    else:
        dr.rectangle((85,145,1195,557),outline=(80,95,111),width=2)
        dr.text((115,296),chapter_names[event["chapter"]],font=big,fill=(241,237,225))
        dr.text((115,367),"RÉCIT HISTORIQUE" if lang=="fr" else "HISTORICAL STORY",font=medium,fill=(202,175,125))
    dr=ImageDraw.Draw(im)
    dr.rectangle((0,575,1280,720),fill=(16,25,38))
    label=context.get(aid,"Document historique — contexte") if usable else chapter_names[event["chapter"]]
    if lang=="en":
        mapping={"Photomontage":"Historical photomontage","Gravure historique":"Historical engraving",
         "Plan de Paris":"Paris map","Rue d'Antin":"Rue d'Antin","Portrait historique":"Historical portrait"}
        for k,v in mapping.items():label=label.replace(k,v)
    dr.text((32,590),label[:95],font=medium,fill=(232,226,211))
    if usable:
        credit=original[aid].get("creator_credit") or ""
        for n,line in enumerate(wrapped(dr,32,640,credit,107)):
            dr.text((32,640+n*22),line,font=small,fill=(174,192,203))
    else:
        dr.text((32,640),"Repère éditorial — aucune photographie substituée" if lang=="fr" else "Editorial marker — no fabricated photograph",font=small,fill=(174,192,203))
    return im
# Map measured FR cues into corresponding EN chapter proportion. No claim of EN word-level alignment.
frparts={c["id"]:c for c in chap["fr"]["chapters"]}
enparts={c["id"]:c for c in chap["en"]["chapters"]}
def time_of(ev):
    t=ev.get("time_seconds")
    if not isinstance(t,(int,float)):return None
    if lang=="en":
        fr=frparts[ev["chapter"]];en=enparts[ev["chapter"]]
        ratio=max(0,min(1,(t-fr["start_seconds"])/max(.01,fr["duration_seconds"])))
        t=en["start_seconds"]+ratio*en["duration_seconds"]
    splice=711.82 if lang=="fr" else 718.94
    delta=18.08 if lang=="fr" else 16.28
    return round(t+(delta if t>splice else 0),3)
duration=3694.30 if lang=="fr" else 3750.76
events=[]
for ev in edl["shot_events"]:
    t=time_of(ev)
    if t is not None and 0<=t<duration:events.append((t,ev))
# The separately inserted narration must get a dedicated documentary no-portrait visual
sp=711.82 if lang=="fr" else 718.94
delta=18.08 if lang=="fr" else 16.28
events.append((sp,{"chapter":"STOP-SEBAI-1977","asset_id":None,"status":"EDITORIAL_REPLACEMENT"}))
events.append((sp+delta,{"chapter":"STOP-SEBAI-1977","asset_id":None,"status":"EDITORIAL_REPLACEMENT"}))
events.sort(key=lambda x:x[0])
filtered=[]
for item in events:
    if filtered and item[0]-filtered[-1][0]<0.08:filtered[-1]=item
    else:filtered.append(item)
assert filtered[0][0]==0,(lang,filtered[0])
frames=[];rows=[];count=0
for i,(t,ev) in enumerate(filtered):
    end=filtered[i+1][0] if i+1<len(filtered) else duration
    if end-t<.06:continue
    aid=ev.get("asset_id")
    path,reason=safe_asset(aid)
    f=P/f"frame-{i:03}.jpg"
    frame(ev,i,path).save(f,quality=89)
    count+=int(path is not None)
    frames.append((f,end-t))
    rows.append({"chapter":ev["chapter"],"second":round(t,3),"asset_id":aid if path else None,"disposition":"ARCHIVAL_CONTEXT" if path else "DOCUMENTARY_SUBSTITUTE","substitution_reason":reason,"source_page":original[aid].get("page") if path else None,"license_url":(original[aid].get("rights_url") or original[aid].get("page")) if path else None,"license_basis":("CC0_OR_MET_PRIMARY" if original[aid].get("rights_url") else "COMMONS_PUBLIC_DOMAIN_FILE_PAGE") if path else None})
assert len(frames)>25
def quote(p):return str(p.resolve()).replace("'","")
lst=P/"concat.ffconcat"
lst.write_text("ffconcat version 1.0\n"+"".join("file '"+quote(p)+"'\nduration "+f"{d:.3f}"+"\n" for p,d in frames)+"file '"+quote(frames[-1][0])+"'\n")
src=Path("downloaded/previous")/f"PARIS05-{lang.upper()}-SEBAI-CAPTIONED-PRIVATE-REVIEW.mp4"
assert src.exists(),src
output=P/f"PARIS05-{lang.upper()}-CURATED-HISTORICAL-PRIVATE-MASTER.mp4"
cmd=[imageio_ffmpeg.get_ffmpeg_exe(),"-y","-hide_banner","-loglevel","error","-safe","0","-f","concat","-i",str(lst),"-i",str(src),"-map","0:v:0","-map","1:a:0","-map","1:s:0","-c:v","libx264","-preset","veryfast","-crf","29","-pix_fmt","yuv420p","-vsync","vfr","-c:a","copy","-c:s","mov_text","-t",str(duration),"-movflags","+faststart",str(output)]
subprocess.run(cmd,check=True)
assert output.stat().st_size>1000000
report={"route":"VP-PAR-05","lang":lang,"chapters":11,"slides":len(rows),"historical_image_appearances":count,"documentary_substitutions":len(rows)-count,"license_metadata_and_sha_checked_per_used_file":True,"human_legal_signoff_still_required":True,"final_commercial_rights_and_voice_clearance":False,"human_listening_qa":False,"subtitle_proofread":False,"en_visual_timing_provisional":lang=="en","status":"CURATED_PRIVATE_REVIEW_NOT_COMMERCIAL_RELEASE"}
(P/"qa.json").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n")
(P/"shot_decisions.json").write_text(json.dumps(rows,indent=2,ensure_ascii=False)+"\n")
print(json.dumps(report,ensure_ascii=False),flush=True)
