import json
from pathlib import Path
r=Path("docs/production")
source=json.loads((r/"paris05-visual-ingest-status.json").read_text())
original={}
for folder in ("downloaded/archival-main","downloaded/archival-targeted"):
 for p in Path(folder).rglob("provenance.json"):
  for a in json.loads(p.read_text()).get("items",[]):
   if a.get("status")=="INGESTED_RIGHTS_REVIEW_REQUIRED":original[a["id"]]=a
rows=[]
for a in source["items"]:
 b=original.get(a["id"],{})
 reasons=[k for k in ("rights","page","sha256") if not b.get(k)]
 rows.append({"id":a["id"],"license":b.get("rights"),"rights_url":b.get("rights_url"),"source_page":b.get("page"),"sha256":b.get("sha256"),"credit":b.get("creator_credit"),"review_status":"EVIDENCE_COMPLETE_PENDING_APPROVAL" if not reasons else "MISSING_SOURCE_EVIDENCE","missing":reasons,"commercial_release":False})
for id in source["excluded"]:rows.append({"id":id,"review_status":"EXCLUDED","commercial_release":False})
out={"route_id":"VP-PAR-05","rights_signoff":False,"assets":rows}
p=Path("dist/paris05-rights-audit");p.mkdir(parents=True,exist_ok=True)
(p/"rights-register.json").write_text(json.dumps(out,indent=2,ensure_ascii=False)+"\n")
print("Complete",sum(x["review_status"]=="EVIDENCE_COMPLETE_PENDING_APPROVAL" for x in rows),"of",len(source["items"]))
