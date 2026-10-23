import json,collections,pathlib
roots=[pathlib.Path("downloaded/archival-main"),pathlib.Path("downloaded/archival-targeted")]
items={}
for root in roots:
 for p in root.rglob("provenance.json"):
  for a in json.loads(p.read_text()).get("items",[]):
   if a.get("status")=="INGESTED_RIGHTS_REVIEW_REQUIRED":items[a["id"]]=a
for aid,a in sorted(items.items()):
 print(json.dumps({"id":aid,"license":a.get("rights"),"license_url":a.get("rights_url"),"page":bool(a.get("page")),"hash":bool(a.get("sha256")),"file":bool(a.get("local_file"))},ensure_ascii=False))
