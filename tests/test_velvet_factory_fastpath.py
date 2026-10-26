#!/usr/bin/env python3
"""CI smoke test: synthetic gray test-card ONLY, never a historical source."""
from pathlib import Path
import json, subprocess, sys, tempfile
HERE=Path(__file__).resolve().parents[1] / 'scripts' / 'production'
sys.path.insert(0,str(HERE))
from velvet_film_factory_fastpath import verify, build, sha256, GateError

def run(*cmd):subprocess.run(cmd,check=True,capture_output=True)
with tempfile.TemporaryDirectory() as temp:
    root=Path(temp)
    run('ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=gray:s=640x360:r=25','-t','2','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',str(root/'clip.mp4'))
    run('ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi','-i','anullsrc=r=24000:cl=mono','-t','2','-c:a','pcm_s16le',str(root/'voice.wav'))
    m={'route_id':'TEST-NOT-HISTORICAL','language':'fr','expected_duration_seconds':2,
       'release_signed':False,'subtitle_qa':False,'all_chapters_complete':False,'en_fr_versions_qa':False,
       'audio':{'file':'voice.wav','sha256':sha256(root/'voice.wav')},'shots':[
       {'id':'smoke','kind':'video','file':'clip.mp4','sha256':sha256(root/'clip.mp4'),
        'asset_id':'TEST_GRAY_01','source_record':'https://example.org/qa-test-only','context_verified':True,
        'spoken_cue':'Synthetic video, no history','start_seconds':0,'duration_seconds':2,
        'rights_status':'pending','sync_approved':False,'mastodon_receipt':None}]}
    (root/'factory.json').write_text(json.dumps(m))
    m['_manifest_path']=str(root/'factory.json')
    assert verify(m,root)['ready']
    assert not verify(m,root,publication=True)['ready']
    fail=json.loads(json.dumps(m));fail['shots'][0]['sha256']='0'*64
    assert any('SHA256_MISMATCH' in x for x in verify(fail,root)['errors'])
    fail=json.loads(json.dumps(m));fail['shots'][0]['start_seconds']=1
    assert any('GAP_OR_OVERLAP' in x for x in verify(fail,root)['errors'])
    fail=json.loads(json.dumps(m));fail['shots'][0]['file']='../../etc/passwd'
    assert any('Path escapes' in x for x in verify(fail,root)['errors'])
    out=root/'test-private.mp4';r=build(m,root,out)
    assert r['release_state']=='PRIVATE_WORKPRINT_NOT_APPROVED'
    probe=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(out)],capture_output=True,text=True,check=True)
    assert abs(float(probe.stdout.strip())-2)<0.09
    print('PASS: preview render, audio+video, SHA rejection, timeline rejection, path traversal protection, public release blocked')