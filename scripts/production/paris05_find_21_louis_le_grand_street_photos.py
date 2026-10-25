#!/usr/bin/env python3
"""Retrieve exact-address archival/recent exterior evidence from Wikimedia originals.
Only Plaque Louis Dumas is certified at n°21 from its source page;
street photographs are CONTEXT-ONLY until visual verification.
"""
import os, json, hashlib, urllib.request, urllib.parse, pathlib, time
from datetime import datetime, timezone

OUT=pathlib.Path("dist/paris05-21-louis-le-grand-review")
OUT.mkdir(parents=True,exist_ok=True)
FILES=[
("Plaque Louis Dumas 21, rue Louis-le-Grand.jpg","21_ADDRESS_PLAQUE","2011-07-13","Public domain - own work Tangopaso"),
("Rue Louis-le-Grand, Paris 2012-11.jpg","STREET_CONTEXT_UNVERIFIED","2012-11-09","CC BY-SA 3.0 - own work Freepenguin"),
("Rue Louis Grand - Paris II (FR75) - 2021-06-14 - 1.jpg","STREET_CONTEXT_UNVERIFIED","2021-06-14","Licensing to be checked individually"),
("Rue Louis Grand - Paris II (FR75) - 2021-06-14 - 2.jpg","STREET_CONTEXT_UNVERIFIED","2021-06-14","Licensing to be checked individually"),
("Rue Louis Le Grand, Paris.jpg","STREET_CONTEXT_UNVERIFIED","2010-07-10","CC BY-SA 3.0 - own work Britchi Mirela"),
("P1050005 Paris II rue Louis-le-grand rwk.JPG","STREET_CONTEXT_UNVERIFIED","unknown","Licensing to be checked individually"),
("LLG 22.jpg","STREET_CONTEXT_UNVERIFIED","unknown","Licensing to be checked individually"),
]
entries=[]
errors=[]
for name,role,claimed_date,rights in FILES:
  safe=name.replace(" ","_")
  md5=hashlib.md5(safe.encode("utf8")).hexdigest()
  url=f"https://upload.wikimedia.org/wikipedia/commons/{md5[0]}/{md5[:2]}/{urllib.parse.quote(safe)}"
  target=OUT/name
  page="https://commons.wikimedia.org/wiki/File:"+urllib.parse.quote(safe)
  try:
    req=urllib.request.Request(url,headers={"User-Agent":"VelvetPassportHistoricalArchive/0.1 (research purposes; project info in public GitHub)"})
    with urllib.request.urlopen(req,timeout=45) as r:
      data=r.read()
      mimetype=r.headers.get("Content-Type","")
    if not data.startswith(bytes.fromhex("ffd8ff")) or len(data)<15000:raise ValueError("not a JPEG file")
    target.write_bytes(data)
    from PIL import Image
    with Image.open(target) as im: w,h=im.size
    rec={"file":name,"source_page":page,"download_url":url,"byte_size":len(data),"sha256":hashlib.sha256(data).hexdigest(),
         "width":w,"height":h,"date_claimed":claimed_date,"role":role,"license_from_website_or_pending":rights,
         "number_21_appearance_verified":False,"can_use_as_exact_facade":False,
         "mastodon_live_verified":False,"rights_qa_approved":False,
         "notes":"Only labeled number 21 plaque is known to be located at the exact address. Do not call generic street shots 21 until checked."}
    entries.append(rec)
    print("DOWNLOADED",name,len(data),f"{w}x{h}",flush=True)
  except Exception as exc:
    errors.append({"name":name,"error":str(exc)})
    print("ERROR",name,str(exc),flush=True)
manifest={"route":"VP-PAR-05","stop":"STOP-01 APPERT",
          "checked_utc":datetime.now(timezone.utc).isoformat(),
          "address":"21 rue Louis-le-Grand, Paris 2e (also 28 rue du Quatre-Septembre)",
          "landmark_source":"https://www.bercail.com/paris/75002/rue-louis-le-grand/21",
          "exact_photo_source":"https://commons.wikimedia.org/wiki/File:Plaque_Louis_Dumas_21,_rue_Louis-le-Grand.jpg",
          "legacy_building_warning":"Address supported; present building may postdate 1860s Appert atelier. Do not claim facade is preserved 1860s original.",
          "images":entries,"errors":errors}
(OUT/"PHOTO_PROVENANCE.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
# Contact sheet only as disposable QA reference (not a documentary source!)
try:
 from PIL import Image,ImageOps,ImageDraw
 imgs=[]
 for rec in entries:
  with Image.open(OUT/rec["file"]) as img:
   sample=ImageOps.contain(img.convert("RGB"),(700,450))
  thumb=Image.new("RGB",(740,510),"white")
  thumb.paste(sample,((740-sample.width)//2,10))
  ImageDraw.Draw(thumb).text((20,465),rec["file"][:95],fill="black")
  imgs.append(thumb)
 if imgs:
  canvas=Image.new("RGB",(1480,((len(imgs)+1)//2)*510),"#eeeeee")
  for i,img in enumerate(imgs): canvas.paste(img,((i%2)*740,(i//2)*510))
  canvas.save(OUT/"CONTACT_SHEET_QA_ONLY.jpg",quality=80)
except Exception as exc: print("CONTACT SHEET FAILED",exc,flush=True)
print("FOUND",len(entries),"FAILED",len(errors),flush=True)
if not entries:raise SystemExit(1)
