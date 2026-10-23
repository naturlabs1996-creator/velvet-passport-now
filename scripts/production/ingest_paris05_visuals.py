#!/usr/bin/env python3
"""Paris 05 archival image ingestion. Review-only, provenance-preserving, fail-closed."""
import hashlib,json,sys,time,urllib.parse,urllib.request,urllib.error
from pathlib import Path
API="https://commons.wikimedia.org/w/api.php"
UA="VelvetPassportArchiveResearch/1.0 (contact: https://github.com/naturlabs1996-creator/velvet-passport-now)"
def get(url,accept="application/json"):
 req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept":accept})
 for attempt in range(3):
  try:
   with urllib.request.urlopen(req,timeout=55) as r:return r.read()
  except urllib.error.HTTPError as exc:
   if exc.code not in (429,500,502,503) or attempt==2:raise
   time.sleep(3*(attempt+1))
def ingest_commons(a,out):
 params=urllib.parse.urlencode({"action":"query","titles":a["commons_title"],"prop":"imageinfo","iiprop":"url|size|mime|sha1|extmetadata","format":"json"})
 data=json.loads(get(API+"?"+params))
 info=next(iter(data["query"]["pages"].values())).get("imageinfo",[None])[0]
 if not info or info.get("mime") not in ("image/jpeg","image/png"):raise ValueError("Missing qualifying image")
 rights=info.get("extmetadata",{}).get("LicenseShortName",{}).get("value","")
 rightsurl=info.get("extmetadata",{}).get("LicenseUrl",{}).get("value","")
 if rights.lower().replace(" ","") not in ("cc0","publicdomain","publicdomainmark","pd-old","pd-art","pd-old-100","cc-zero") and "publicdomain" not in rightsurl:
  raise ValueError("Rights not allowlisted: "+rights)
 if int(info.get("size",0))>30000000:raise ValueError("Oversized source image")
 blob=get(info["url"],accept="image/*")
 return blob,{"rights":rights,"rights_url":rightsurl,"image_url":info["url"],"page":info["descriptionurl"],"width":info["width"],"height":info["height"],"mime":info["mime"]}
def ingest_met(a,out):
 obj=json.loads(get("https://collectionapi.metmuseum.org/public/collection/v1/objects/"+str(a["met_object_id"])))
 if not obj.get("isPublicDomain") or not obj.get("primaryImage"):raise ValueError("Met Public Domain or image unavailable")
 if str(obj.get("objectID"))!=str(a["met_object_id"]):raise ValueError("Met object mismatch")
 blob=get(obj["primaryImage"],accept="image/*")
 return blob,{"rights":"Public Domain (Met Open Access)","rights_url":"https://www.metmuseum.org/about-the-met/policies-and-documents/open-access",
 "image_url":obj["primaryImage"],"page":obj["objectURL"],"mime":"image/jpeg","title":obj.get("title"),"artist":obj.get("artistDisplayName")}
def main(inp,out):
 out.mkdir(parents=True,exist_ok=True);source=json.loads(inp.read_text());result=[]
 for a in source["assets"]:
  aid=a["id"];entry={"id":aid,"cue":a["cue"],"source_record":a["source_record"],"creator_credit":a["credit"],"commercial_release_approved":False}
  if aid in source["blocked_asset_ids"]:entry.update(status="EXCLUDED_RIGHTS_HOLD");result.append(entry);continue
  try:
   blob,meta=(ingest_met(a,out) if a.get("provider")=="met" else ingest_commons(a,out))
   if not 1000<=len(blob)<=30000000:raise ValueError("Unexpected binary length")
   if not (blob.startswith(b"\xff\xd8\xff") or blob.startswith(b"\x89PNG\r\n\x1a\n")):raise ValueError("Not a JPEG/PNG")
   ext=".png" if blob.startswith(b"\x89PNG") else ".jpg"
   fn=aid+ext;(out/fn).write_bytes(blob)
   entry.update(status="INGESTED_RIGHTS_REVIEW_REQUIRED",local_file=fn,sha256=hashlib.sha256(blob).hexdigest(),bytes=len(blob),**meta)
  except Exception as e:entry.update(status="INGEST_FAILED",reason=str(e))
  result.append(entry)
 report={"route_id":source["route_id"],"status":"REVIEW_ONLY","items":result,"ingested_count":sum(x["status"].startswith("INGESTED") for x in result),
 "errors":sum(x["status"]=="INGEST_FAILED" for x in result),"excluded_rights_hold":source["blocked_asset_ids"]}
 (out/"provenance.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps(report,ensure_ascii=False,indent=2))
 return 1 if report["errors"] else 0
if __name__=="__main__":
 if len(sys.argv)!=3:sys.exit("usage: ingest manifest.json directory")
 sys.exit(main(Path(sys.argv[1]),Path(sys.argv[2])))
