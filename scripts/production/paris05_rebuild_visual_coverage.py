#!/usr/bin/env python3
"""Generate strict visual-coverage traceability against the *spoken* Paris05 script.
This is a PREPRODUCTION blocker, not a fake rendered demo or rights signoff.
"""
from pathlib import Path
import json,sys
src=json.loads(Path("docs/pilots/paris-05-fr-v4-tts-and-cues.json").read_text())
inventory=json.loads(Path("docs/production/paris05-visual-ingest-status.json").read_text())
available={x["id"] for x in inventory["items"] if x.get("status")=="INGESTED_REVIEW_ONLY"}
# Per-cue review uses the canonical zero-based source-cue array index.
# READY_SOURCE means contextual fit is supported, NOT commercial publication rights.
C={
("STOP-01",1):("MISSING_EXACT","CURRENT-21-FACADE","Photo autorisée actuelle du n°21, pas une rue ancienne"),
("STOP-01",3):("MISSING_EXACT","CARTE-DE-VISITE-XIX","Cartes de visite réelles, pas une photo du quartier"),
("STOP-01",5):("MISSING_EXACT","APPERT-CARTE-VERSO","Verso original identifié et lisible du photographe Appert"),
("STOP-01",6):("MISSING_EXACT","CURRENT-21-FACADE","Adresse actuelle n°21"),
("STOP-01",8):("DOWNLOADED_REVIEW","APPERT-NEUF-1867","Rijksmuseum RP-F-2007-161 : image exacte téléchargée, placement/visuel à valider"),
("STOP-01",10):("AVAILABLE_CONTEXT","APPERT-ROQUETTE","Photomontage réel d'Appert, préciser que scène reconstituée"),
("STOP-01",12):("PENDING_SHOT_DESIGN","APPERT-NEUF-1867","Détail précisément légendé, puis image complète, au mot prononcé"),
("STOP-01",14):("MISSING_EXACT","CURRENT-21-FACADE","Façade actuelle n°21"),
("TRANSITION-01-SEBAI",0):("MISSING_EXACT","CURRENT-WALK-21-23","Séquence de marche authentique/autorisation, jamais une rue du XIXe"),
("TRANSITION-01-SEBAI",1):("MISSING_EXACT","CURRENT-23-DOOR","Photo exacte et autorisée de la porte du n°23"),
("STOP-SEBAI-1977",0):("MISSING_EXACT","CURRENT-23-DOOR","Porte du n°23, ne pas inventer un portrait de Sebaï"),
("STOP-SEBAI-1977",4):("RIGHTS_HOLD","LE-MONDE-1975","Article du 29 juillet 1975, reproduire seulement avec droits"),
("STOP-SEBAI-1977",9):("MISSING_EXACT","CURRENT-23-DOOR","Retour à la porte autorisée si compatible avec narration"),
("STOP-SEBAI-1977",13):("MISSING_EXACT","GHRAIEB-DOCUMENT","Document authentifié de la personne nommée, ou réécriture visuelle explicitement conçue"),
("STOP-02",0):("MISSING_EXACT","CURRENT-16-FACADE","N°16 contemporain, non le portrait de Joséphine"),
("STOP-02",3):("PARTIAL_CONTEXT","RP-P-1951-602","Portrait disponible, vues anciennes de Malmaison séparément manquantes"),
("STOP-02",5):("MISSING_EXACT","SALE-CATALOGUE-1819","Catalogue de vente 1819 exact, pas une médaille"),
("STOP-02",8):("MISSING_EXACT","BAUDIN-MAP-PRINTS","Carte expédition et estampes naturalistes, pas une médaille hors sujet"),
("STOP-03",0):("PARTIAL_CONTEXT","OPERA-1900","Opéra historique seulement, paysage actuel du point d'arrêt absent"),
("STOP-03",3):("MISSING_EXACT","OPERA-1944-19AUG","Photographie datée du secteur Opéra au 19 août 1944"),
("STOP-03",8):("MISSING_EXACT","OPERA-1944-CHRONOLOGY","Documents chronologiques exacts 19–25 août ; le Meurice ne démontre pas l'événement Opéra"),
("STOP-03",10):("RIGHTS_HOLD","LAPI-28401","Photographie droits réservés ; exclue sans preuve nouvelle"),
("STOP-03",13):("MISSING_EXACT","OPERA-COMPARISON","Images d'angle comparables et micro-localisées"),
("STOP-03",15):("MISSING_EXACT","OPERA-1944-SURRENDER","Reddition/drapeau blanc réellement authentifié et réutilisable"),
("STOP-04",0):("MISSING_EXACT","CURRENT-RUE-ANTIN","Perspective actuelle réellement pertinente"),
("STOP-04",3):("AVAILABLE_CONTEXT","GOMBOUST-1652","Plan de Paris 1652, pas le point exact du duel"),
("STOP-04",5):("AVAILABLE_CONTEXT","BNF-BTV1B8405032K","Gravure identifiée de Beaufort"),
("STOP-04",6):("AVAILABLE_CONTEXT","RCIN-615675","Gravure identifiée de Nemours"),
("STOP-04",9):("AVAILABLE_CONTEXT","GRANDE-MADEMOISELLE-P1983","Portrait attesté de la Grande Mademoiselle"),
("STOP-04",15):("MISSING_EXACT","HORSE-MARKET-PLAN","Document localisant réellement le marché aux chevaux"),
("STOP-04",29):("MISSING_EXACT","CURRENT-RUE-ANTIN","Vue contemporaine de rue d'Antin et de ses abords"),
}
out={"route":"VP-PAR-05","stage":"PREPRODUCTION_BLOCKING_REQUIREMENTS","truthful_status":"NOT_READY_TO_RENDER","audio_keep_unchanged":True,"cue_requirements":[],"chapters_missing_narrative_coverage":[],"summary":{}}
for ch in src["segments"]:
    visual=[(i,x) for i,x in enumerate(ch["cues"]) if x["cue"] in ("VISUAL","LOOK","WALK")]
    if not visual:out["chapters_missing_narrative_coverage"].append(ch["id"])
    for i,c in visual:
        status,aid,why=C.get((ch["id"],i),("MISSING_EXACT",None,"Représentation précise non assignée"))
        if status=="AVAILABLE_CONTEXT" and aid not in available:
            status="MISSING_EXACT";why+="; ressource non confirmée dans l'inventaire"
        # A source-level candidate never implies an exact timed/audio-matched picture.
        out["cue_requirements"].append({"chapter":ch["id"],"cue_index":i,"spoken_char_index":c["spoken_char_index"],"cue":c["cue"],"spoken_context":ch["text"][c["spoken_char_index"]:c["spoken_char_index"]+150],"required_visual":c["detail"],"asset_id":aid,"readiness":status,"editorial_instruction":why,"fr_audio_time_measured":False,"en_audio_time_measured":False,"commercial_rights_approved":False,"shot_approved":False})
assert len(out["cue_requirements"])==len(C),(len(out["cue_requirements"]),len(C))
blocked=[x for x in out["cue_requirements"] if x["readiness"] not in ("AVAILABLE_CONTEXT",)]
out["summary"]={"explicit_look_visual_walk_cues":len(out["cue_requirements"]),"context_sources_available_not_shot_approved":sum(x["readiness"]=="AVAILABLE_CONTEXT" for x in out["cue_requirements"]),"blocked_or_partial_cues":len(blocked),"chapters_without_explicit_visual_storyboard":len(out["chapters_missing_narrative_coverage"]),"fr_word_aligned_cues_approved":0,"en_word_aligned_cues_approved":0,"release_allowed":False,"new_demo_allowed":False}
p=Path("dist/paris05-pro-rebuild");p.mkdir(parents=True,exist_ok=True)
(p/"visual-scene-coverage.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n")
rows=["# Paris 05 — état des images requises par la narration","","**Blocage avant nouveau rendu.** Les sources présentes ne sont ni visuellement approuvées ni calées sur la voix.","",f"**{len(blocked)} cues incomplets ou bloqués sur {len(C)} ; {len(out['chapters_missing_narrative_coverage'])} chapitres sans storyboard visuel explicite.**","", "| Chapitre | Cue | Exigence | Ressource | État |","|---|---:|---|---|---|"]
for x in out["cue_requirements"]:
    rows.append(f"| {x['chapter']} | {x['cue_index']} | {x['required_visual'].replace('|','/')} | {x['asset_id'] or '—'} | {x['readiness']} |")
rows+=["","## Transitions et intro sans plan visuel","",", ".join(out["chapters_missing_narrative_coverage"]), "", "**Aucune production complète autorisée avant attribution d'une image pertinente à chaque moment du récit, calage audio séparé FR/EN et autorisations.**"]
(p/"visual-scene-coverage.md").write_text("\n".join(rows)+"\n")
print(json.dumps(out["summary"],ensure_ascii=False))
sys.exit(2 if blocked or out["chapters_missing_narrative_coverage"] else 0)
