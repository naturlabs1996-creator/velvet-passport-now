#!/usr/bin/env python3
"""Build review-only image edit decision list from actual FR ASR cue times.
No images are redistributed, rendered, or rights-cleared here.
"""
import json
from pathlib import Path

ROOT=Path("docs/production")
aligned=json.loads(Path("downloaded/alignment/paris05-fr-asr-synchronized-cues.json").read_text())
coverage=json.loads((ROOT/"paris05-visual-coverage-and-gaps.json").read_text())
ingest=json.loads((ROOT/"paris05-visual-ingest-status.json").read_text())
times=json.loads((ROOT/"paris05-measured-master-chapter-timecodes.json").read_text())["tracks"]["fr"]["chapters"]
available={x["id"]:x for x in ingest["items"]}
excluded=set(ingest["excluded"])
# Explicit editorial decisions based on source cues, not round-robin images.
map_cues={
 "STOP-01":{1:"MARVILLE-LOUIS-PH460",3:None,5:None,6:"MARVILLE-LOUIS-PH460",8:None,10:"APPERT-ROQUETTE",12:"MET-702001",14:"MARVILLE-LOUIS-PH460"},
 "TRANSITION-01-SEBAI":{0:"MARVILLE-LOUIS-PH460",1:None},
 "STOP-SEBAI-1977":{0:None,4:None,9:None,13:None},
 "STOP-02":{0:None,3:"RP-P-1951-602",5:None,8:None},
 "STOP-03":{0:"OPERA-1900",3:None,8:"PARIS-1944",10:None,13:None,15:None},
 "STOP-04":{0:"MARVILLE-ANTIN-1866",3:"GOMBOUST-1652",5:"BNF-BTV1B8405032K",6:"RCIN-615675",9:"GRANDE-MADEMOISELLE-P1983",15:None,29:"MARVILLE-ANTIN-1866"}
}
chapter_start={"INTRO":"TURGOT-LOUIS-1739","STOP-01":"MARVILLE-LOUIS-PH460","TRANSITION-01-SEBAI":"MARVILLE-LOUIS-PH460","STOP-SEBAI-1977":None,"TRANSITION-01-02":"MARVILLE-OPERA-PH940","STOP-02":"RP-P-1951-602","TRANSITION-02-03":"OPERA-1900","STOP-03":"OPERA-1900","TRANSITION-03-04":"MARVILLE-OPERA-ANTIN-1876","STOP-04":"MARVILLE-ANTIN-1866","OUTRO":"VENDOME-1900"}
holds={
 ("STOP-01",3):"Authentic carte de visite not ingested",
 ("STOP-01",5):"Original Appert carte reverse not ingested",
 ("STOP-01",8):"Exact nine-figure montage not ingested; no substitution",
 ("TRANSITION-01-SEBAI",1):"23 doorway photograph missing",
 ("STOP-SEBAI-1977",0):"23 doorway photograph missing",
 ("STOP-SEBAI-1977",4):"Le Monde July 1975 article reproduction not cleared",
 ("STOP-SEBAI-1977",9):"23 doorway photograph missing",
 ("STOP-SEBAI-1977",13):"Ghraieb specific image not rights-cleared or ingested",
 ("STOP-02",0):"16 facade photograph missing",
 ("STOP-02",5):"Actual 1819 sale catalogue not ingested",
 ("STOP-02",8):"Specific Baudin voyage map and natural history prints not ingested; unrelated medal is not substitute",
 ("STOP-03",3):"19 August 1944 Opera-sector photograph not verified",
 ("STOP-03",10):"LAPI 28401 rights hold",
 ("STOP-03",13):"Verified before-after matching angle missing",
 ("STOP-03",15):"Duly authenticated surrender photo missing",
 ("STOP-04",15):"Horse-market precise plan localization remains unverified"
}
out={"schema_version":"1.0","route_id":"VP-PAR-05","language":"fr","type":"REVIEW_ONLY_IMAGE_EDIT_DECISION_LIST","audio_master_unchanged":True,"source_alignment_run":39889321388,"source_alignment_artifact":12474720562,"commercial_export_allowed":False,"shot_events":[],"chapters":[],"qa":{"unmatched_audio_cues":[],"unavailable_visuals":[],"unsafe_visuals":[]}}
for ch,b in zip(aligned["chapters"],times):
 assert ch["id"]==b["id"],(ch["id"],b["id"])
 ident=ch["id"]
 cs={"id":ident,"start_seconds":b["start_seconds"],"end_seconds":b["end_seconds"],"visual_events":[]}
 # Establishing image at the known accurate chapter boundary.
 events=[{"source":"chapter_boundary","t":b["start_seconds"],"asset":chapter_start.get(ident),"index":None,"comment":"Contextual opening image (editorial choice, not measured visual cue)"}]
 for index,c in enumerate(ch["cues"]):
  if c["status"]=="UNALIGNED":
   out["qa"]["unmatched_audio_cues"].append({"chapter":ident,"cue_index":index,"cue_type":c["type"]})
  if c["type"] not in ("LOOK","VISUAL","WALK"):continue
  if index not in map_cues.get(ident,{}):continue
  events.append({"source":"measured_asr_cue","t":c["audio_seconds_global"],"asset":map_cues[ident][index],"index":index,"comment":c["description"],"confidence_status":c["status"]})
 for e in events:
  asset=e["asset"]
  if e["t"] is None:
   e["status"]="UNALIGNED_NO_TIMECODE";e["export_allowed"]=False
  elif asset is None:
   e["status"]="EDITORIAL_ASSET_HOLD";e["export_allowed"]=False
   e["hold_reason"]=holds.get((ident,e["index"]),"Authentic verified visual pending")
   out["qa"]["unavailable_visuals"].append({"chapter":ident,"cue_index":e["index"],"reason":e["hold_reason"]})
  elif asset in excluded or asset not in available:
   e["status"]="ASSET_NOT_AVAILABLE_OR_EXCLUDED";e["export_allowed"]=False
   out["qa"]["unsafe_visuals"].append({"chapter":ident,"asset":asset})
  else:
   e["status"]="CANDIDATE_REVIEW_ONLY";e["export_allowed"]=False
   e["rights_review"]=available[asset].get("rights_review","PENDING")
   e["rights_source"]=available[asset].get("rights","UNKNOWN")
  e["asset_id"]=e.pop("asset");e["time_seconds"]=e.pop("t")
  if e["source"]=="measured_asr_cue" and e["time_seconds"] is not None and not (b["start_seconds"]<=e["time_seconds"]<=b["end_seconds"]):
   raise ValueError("Cue outside master segment: "+ident)
  cs["visual_events"].append(e)
  out["shot_events"].append({"chapter":ident,**e})
 out["chapters"].append(cs)
out["qa"]["counts"]={"chapters":len(out["chapters"]),"image_events":len(out["shot_events"]),"candidate_visual_events":sum(x["status"]=="CANDIDATE_REVIEW_ONLY" for x in out["shot_events"]),"visual_holds":sum(x["status"]=="EDITORIAL_ASSET_HOLD" for x in out["shot_events"]),"cue_alignment_holds":len(out["qa"]["unmatched_audio_cues"])}
assert len(out["chapters"])==11
p=Path("dist/paris05-image-alignment");p.mkdir(parents=True,exist_ok=True)
(p/"paris05-fr-image-edl-review.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n")
print(json.dumps(out["qa"]["counts"],ensure_ascii=False))
