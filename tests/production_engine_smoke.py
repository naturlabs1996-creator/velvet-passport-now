import json, subprocess, tempfile, sys
from pathlib import Path
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from scripts.production.build_route import validate,render
with tempfile.TemporaryDirectory() as d:
 p=Path(d);Image.new("RGB",(640,360),(22,42,67)).save(p/"archive.png")
 for lang in ("fr","en"):
  subprocess.run(["ffmpeg","-v","error","-y","-f","lavfi","-i","sine=frequency=440:duration=2","-c:a","pcm_s16le",str(p/f"{lang}.wav")],check=True)
  (p/f"{lang}.srt").write_text("1\n00:00:00,000 --> 00:00:02,000\nTest\n")
 a={"id":"img","rights_status":"CLEARED_COMMERCIAL","authenticity":"HISTORICAL_ORIGINAL","source_url":"https://example.org/object","credit":"Test archive","local_file":"archive.png"}
 m={"route_id":"VP-TEST","rights_signoff":True,"assets":[a],"timelines":{l:[{"asset_id":"img","start":0,"end":2}] for l in ("fr","en")},"languages":{l:{"audio_master":f"{l}.wav","subtitle_file":f"{l}.srt","listening_qa_passed":True} for l in ("fr","en")}}
 assert validate(m,p)==[]
 for lang in ("fr","en"):assert set(render(m,p,p/"dist",lang)["tracks"])=={"video","audio","subtitle"}
 a["rights_status"]="RIGHTS_HOLD"
 assert any("rights not cleared" in e for e in validate(m,p))
 print("PASS: two MP4s, 3 tracks each, rights HOLD blocked")
