#!/usr/bin/env python3
"""Download historical archive candidates from Wikimedia Commons with metadata and checksums.
This tool DOES NOT approve rights for commercial release or change the production manifest.
"""
import hashlib,json,sys,urllib.parse,urllib.request
from pathlib import Path
API="https://commons.wikimedia.org/w/api.php"
UA="VelvetPassportProduction/1.0 (archival provenance and rights research)"
def get(url):
 req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept":"application/json"})
 with urllib.request.urlopen(req,timeout=50) as response:return response.read()
def main():
 inp=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
 source=json.loads(inp.read_text(encoding="utf8"));seen=set();report=[]
 for asset in source["assets"]:
  aid=asset["id"];title=asset["commons_title"]
  if aid in source["blocked_asset_ids"] or aid in seen:raise RuntimeError("Blocked or duplicate ID "+aid)
  seen.add(aid)
  query=urllib.parse.urlencode({"action":"query","titles":title,"prop":"imageinfo","iiprop":"url|size|mime|sha1|extmetadata","format":"json"})
  try:
   raw=json.loads(get(API+"?"+query))
   pages=list(raw["query"]["pages"].values());info=pages[0].get("imageinfo",[None])[0]
   if not info or info.get("mime") not in ("image/jpeg","image/png"):raise ValueError("No qualifying image")
   metadata=info.get("extmetadata",{})
   license_value=metadata.get("LicenseShortName",{}).get("value","")
   license_url=metadata.get("LicenseUrl",{}).get("value","")
   allowed=(license_value.lower().replace(" ","") in ("cc0","publicdomain","publicdomainmark","pd-old","pd-art","pd-old-100","cc-zero")) or "publicdomain" in license_url
   if not allowed:raise ValueError("License not allowlisted: "+license_value)
   if info.get("size",0)>30_000_000:raise ValueError("Image exceeds 30MB ingest cap")
   ext=".png" if info["mime"]=="image/png" else ".jpg"
   blob=get(info["url"])
   if len(blob)>30_000_000 or not blob:raise ValueError("Image size mismatch")
   (out/(aid+ext)).write_bytes(blob)
   report.append({"id":aid,"cue":asset["cue"],"status":"INGESTED_RIGHTS_REVIEW_REQUIRED","local_file":aid+ext,
      "sha256":hashlib.sha256(blob).hexdigest(),"size_bytes":len(blob),"commons_page":info["descriptionurl"],
      "source_record":asset["source_record"],"license_declared":license_value,"license_url":license_url,
      "creator_credit":asset["credit"],"image_width":info["width"],"image_height":info["height"],
      "commercial_release_approved":False})
  except Exception as exc:
   report.append({"id":aid,"status":"INGEST_FAILED","reason":str(exc),"commercial_release_approved":False})
 result={"route_id":source["route_id"],"ingest_status":"REVIEW_ONLY","items":report,
  "ingested_count":sum(x["status"].startswith("INGESTED") for x in report),
  "errors":sum(x["status"]=="INGEST_FAILED" for x in report),"excluded_rights_hold":source["blocked_asset_ids"]}
 (out/"provenance.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf8")
 print(json.dumps(result,ensure_ascii=False,indent=2))
 if result["ingested_count"]==0:sys.exit(1)
if __name__=="__main__":
 if len(sys.argv)!=3:sys.exit("Usage: ingest_paris05_visuals.py manifest.json output_dir")
 main()
