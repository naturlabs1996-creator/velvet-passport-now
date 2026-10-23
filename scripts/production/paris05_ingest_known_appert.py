#!/usr/bin/env python3
"""Retrieve *already identified* Appert public-domain Rijksmuseum object images.
Exact identifier, credit, provenance and bytes are retained. No new candidate research.
"""
import hashlib,json,time,urllib.request,urllib.error
from pathlib import Path
objects={"APPERT-NEUF-1867":"200489498"}
out=Path("dist/appert-rijks");out.mkdir(parents=True,exist_ok=True)
headers={"User-Agent":"VelvetPassportArchivalProduction/1.0 (https://github.com/naturlabs1996-creator/velvet-passport-now)","Accept":"application/json"}
def get(url,accept="application/json"):
    req=urllib.request.Request(url,headers={**headers,"Accept":accept})
    for n in range(3):
        try:
            with urllib.request.urlopen(req,timeout=40) as h:return h.read(),h.headers.get("Content-Type","")
        except (urllib.error.URLError,TimeoutError) as e:
            if n==2:raise
            time.sleep(2+n*3)
def obj(url):
    body,_=get(url)
    return json.loads(body)
report=[]
for aid,pid in objects.items():
    state={"id":aid,"object_uri":"https://id.rijksmuseum.nl/"+pid,"rights_source":"Rijksmuseum object record — Public domain","status":"FAILED"}
    try:
        art=obj("https://data.rijksmuseum.nl/"+pid+"?_profile=la-framed")
        visual=art.get("shows",[])
        if not visual:raise ValueError("No VisualItem")
        vid=visual[0]["id"].replace("id.rijksmuseum.nl","data.rijksmuseum.nl")
        v=obj(vid+"?_profile=la-framed")
        digital=v.get("digitally_shown_by",[])
        if not digital:raise ValueError("No linked DigitalObject")
        digid=digital[0]["id"].replace("id.rijksmuseum.nl","data.rijksmuseum.nl")
        d=obj(digid+"?_profile=la-framed")
        access=d.get("access_point",[])
        urls=[x.get("id","") for x in access if "iiif.micr.io" in x.get("id","")]
        if not urls:raise ValueError("No IIIF image access point")
        identifier=urls[0].split("iiif.micr.io/")[1].split("/")[0]
        url=f"https://iiif.micr.io/{identifier}/full/1200,/0/default.jpg"
        blob,ctype=get(url,"image/jpeg")
        if not blob.startswith(bytes.fromhex("ffd8ff")) or len(blob)<12000:
            raise ValueError("Not a JPEG image "+str(len(blob)))
        f=out/(aid+".jpg");f.write_bytes(blob)
        state.update({"status":"DOWNLOADED_REVIEW_ONLY","image_source":url,"IIIF_identifier":identifier,"bytes":len(blob),"sha256":hashlib.sha256(blob).hexdigest(),"file":f.name,"object_metadata":art.get("identified_by",[])[:3]})
    except Exception as exc:state["error"]=str(exc)
    report.append(state)
    print(aid,state["status"],state.get("error",""),flush=True)
(out/"provenance.json").write_text(json.dumps({"results":report,"commercial_release_signoff":False},ensure_ascii=False,indent=2))
if any(x["status"]!="DOWNLOADED_REVIEW_ONLY" for x in report):
    raise SystemExit("Some sources cannot be downloaded automatically; do not fake missing images.")
