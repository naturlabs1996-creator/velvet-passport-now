#!/usr/bin/env python3
"""Self-contained CI smoke test; uses generated synthetic media, no historical assets."""
import tempfile,subprocess,hashlib,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from velvet_film_factory import audit,probe

def run(args):subprocess.run(args,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
with tempfile.TemporaryDirectory() as td:
    d=Path(td);shots=[]
    for i,color in enumerate(['black','gray']):
        p=d/f'{i}.mp4'
        run(['ffmpeg','-v','error','-y','-f','lavfi','-i',f'color=c={color}:s=1920x1080:r=25','-t','1','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',str(p)])
        shots.append({'file':p.name,'frames':25,'title':f'TEST {i}','asset_id':f'SYNTHETIC_TEST_{i}','source_url':'https://example.org/test-only','sha256':h(p),'cue_text':f'Synthetic sample {i}, not real history','rights':'review_pending','narrative_sync':'review_pending','mastodon_receipt':None})
    voice=d/'voice.wav'
    run(['ffmpeg','-v','error','-y','-f','lavfi','-i','anullsrc=channel_layout=mono:sample_rate=24000','-t','2','-c:a','pcm_s24le',str(voice)])
    m={'route_id':'CI-TEST','chapter':'TEST','lang':'fr','fps':25,'voice':voice.name,'voice_sha256':h(voice),'voice_seconds':2.0,'clips':shots,'all_chapters_covered':False,'publisher_release_approved':False,'now_pass_qa_approved':False}
    manifest=d/'manifest.json';manifest.write_text(json.dumps(m))
    assert audit(m,d,False)['ready']
    assert not audit(m,d,True)['ready']
    p=subprocess.run([sys.executable,str(Path(__file__).with_name('velvet_film_factory.py')),str(manifest),'--output',str(d/'generated'),'--render'],capture_output=True,text=True)
    assert p.returncode==0,(p.stdout,p.stderr)
    outcome=json.loads((d/'generated/QA_REPORT.json').read_text())
    assert outcome['decoded_ok'] and outcome['duration_seconds']==2.0
    assert abs(float(probe(d/'generated'/outcome['workprint_mp4'])['format']['duration'])-2)<.05
    fail=subprocess.run([sys.executable,str(Path(__file__).with_name('velvet_film_factory.py')),str(manifest),'--output',str(d/'blocked'),'--public'],capture_output=True,text=True)
    assert fail.returncode==2
    print('PASS CI: valid private 2-sec film render + native Kdenlive XML + strict commercial-release block')