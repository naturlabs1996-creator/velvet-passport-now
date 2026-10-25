#!/usr/bin/env python3
"""Retrieve institutional digital representations of Rijksmuseum RP-F-2007-161.

This script finds the exact object via linked-art and records ALL available digital
representations. It does not label any image 'verso' without independent verification.
"""
import hashlib, json, pathlib, urllib.request, urllib.error, time, re

ROOT=pathlib.Path("dist/paris05-rijksmuseum-exact-object")
ROOT.mkdir(parents=True,exist_ok=True)
OBJECT="https://data.rijksmuseum.nl/200489498"
NUM="RP-F-2007-161"
headers={"User-Agent":"VelvetPassport-DocumentaryArchive/1.0 (research provenance; no image manipulation)", "Accept":"application/ld+json, application/json, */*"}

def get(url):
    req=urllib.request.Request(url,headers=headers)
    with urllib.request.urlopen(req,timeout=35) as r:
        return r.read(),r.headers.get("Content-Type","")

def structured(url, label):
    b, mime=get(url)
    try: j=json.loads(b.decode("utf-8"))
    except: raise ValueError(f"{label} not JSON {mime} length={len(b)} {b[:100]!r}")
    (ROOT/(label+".json")).write_text(json.dumps(j,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    return j

def get_ids(z):
    """Parse Linked Art resource ref values, including list and partial embedded records."""
    if isinstance(z,dict):
        if z.get("id"): yield z["id"]
    elif isinstance(z,list):
        for item in z: yield from get_ids(item)

def data_url(u):
    return u.replace("https://id.rijksmuseum.nl/","https://data.rijksmuseum.nl/")

out={"object_number":NUM, "object_record":OBJECT, "museum_record":"https://id.rijksmuseum.nl/200489498", "direct_image_verso_authenticated":False, "available_representations":[], "errors":[]}
try:
    obj=structured(OBJECT+"?_profile=la-framed","museum_object_linkedart")
    raw=str(obj)
    if "RP-F-2007-161" not in raw: raise ValueError("Exact object number not evidenced in linked art payload: hold all photos.")
    candidates=list(get_ids(obj.get("shows",[])))
    if not candidates:
        out["errors"].append("No visual item references in object linked art")
    print("OBJECT_IDENTIFIER_CONFIRMED",NUM,"VISUAL_ITEMS",len(candidates),flush=True)
    for k,v in enumerate(candidates,1):
        try:
            vdata=structured(data_url(v)+"?_profile=la-framed",f"visual_{k:02d}")
            digital_refs=list(get_ids(vdata.get("digitally_shown_by",[])))
            print("VISUAL",k,"DIGITAL",len(digital_refs),flush=True)
            for n,d in enumerate(digital_refs,1):
                try:
                    dd=structured(data_url(d)+"?_profile=la-framed",f"digital_{k:02d}_{n:02d}")
                    accesses=list(get_ids(dd.get("access_point",[])))
                    for q,u in enumerate(accesses,1):
                        if not u.startswith("https://iiif.micr.io/"):continue
                        m=re.search(r'iiif\.micr\.io/([^/]+)',u)
                        if not m:continue
                        image_id=m.group(1)
                        url=f"https://iiif.micr.io/{image_id}/full/max/0/default.jpg"
                        b, ct=get(url)
                        if len(b)<10000 or not b.startswith(bytes.fromhex("ffd8ff")):
                            raise ValueError("Downloaded resource not a valid JPEG image")
                        name=f"RIJKSMUSEUM-RP-F-2007-161-VIS{k:02d}-DIG{n:02d}-MEDIA{q:02d}.jpg"
                        (ROOT/name).write_bytes(b)
                        entry={"filename":name,"object_number":NUM,"iiif_id":image_id,"visual_item":v,"digital_object":d,"access_point":u,"download_url":url,"bytes":len(b),"sha256":hashlib.sha256(b).hexdigest(),"orientation":"NOT_YET_AUTHENTICATED_FRONT_OR_REVERSE","rights_museum_object_page":"Public domain","production_ready":False}
                        out["available_representations"].append(entry)
                        print("IMAGE",name,len(b),flush=True)
                except Exception as e:out["errors"].append(f"digital {d}: {e}")
        except Exception as e:out["errors"].append(f"visual {v}: {e}")
except Exception as e:
    out["errors"].append(f"object-fetch-failure: {type(e).__name__}: {e}")
(ROOT/"MEDIA_PROVENANCE.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print(json.dumps({"media":len(out["available_representations"]),"errors":out["errors"][:8]},ensure_ascii=False,indent=2),flush=True)
# Fail if no usable image was recovered; artifact still uploads metadata and errors
if not out["available_representations"]:raise SystemExit(1)
