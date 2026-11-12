"""CI smoke: synthetic video tests only. NEVER use generated image for historical production."""
import hashlib, json, subprocess, sys, tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'/'production'))
from velvet_integrated_factory import validate, main as factory_main

def run(cmd):
    subprocess.run(cmd,check=True,capture_output=True)

def checksum(p):return hashlib.sha256(p.read_bytes()).hexdigest()

with tempfile.TemporaryDirectory() as tmp:
    root=Path(tmp)
    run(['ffmpeg','-v','error','-y','-f','lavfi','-i','color=c=gray:s=640x480:r=25','-frames:v','1',str(root/'synthetic.jpg')])
    run(['ffmpeg','-v','error','-y','-f','lavfi','-i','sine=frequency=300:duration=1','-c:a','pcm_s16le',str(root/'voice.wav')])
    run(['ffmpeg','-v','error','-y','-f','lavfi','-i','color=c=black:s=320x240:r=25:d=1','-f','lavfi','-i','sine=frequency=400:duration=1','-shortest','-c:v','libx264','-c:a','aac',str(root/'archive.mp4')])
    m={'template':'velvet-master-frame/v1','route_id':'TEST','stop_id':'STOP','clips':[
      {'kind':'photo','source':'synthetic.jpg','sha256':checksum(root/'synthetic.jpg'),'voice':'voice.wav','voice_sha256':checksum(root/'voice.wav'),'duration':1.5,'voice_delay':0.1,'subtitle_status':'MISSING'},
      {'kind':'archive_film','source':'archive.mp4','sha256':checksum(root/'archive.mp4'),'duration':1,'subtitle_status':'MISSING'}]}
    assert validate(m,root)==[]
    dst=root/'manifest.json';dst.write_text(json.dumps(m))
    subprocess.run([sys.executable,str(Path(__file__).resolve().parents[1]/'scripts'/'production'/'velvet_integrated_factory.py'),str(dst),'--root',str(root),'--out',str(root/'render')],check=True,capture_output=True)
    qa=json.loads((root/'render'/'QA_REPORT.json').read_text()); assert qa['status']=='FINAL_REVIEW_REQUIRED'
    assert 2.4<float(qa['duration'])<2.6
    subprocess.run([sys.executable,str(Path(__file__).resolve().parents[1]/'scripts'/'production'/'velvet_integrated_factory.py'),str(dst),'--root',str(root),'--out',str(root/'render'),'--final'],check=False,capture_output=True)
    blocked=subprocess.run([sys.executable,str(Path(__file__).resolve().parents[1]/'scripts'/'production'/'velvet_integrated_factory.py'),str(dst),'--root',str(root),'--out',str(root/'render'),'--final'],capture_output=True,text=True)
    assert blocked.returncode==2 and 'FINAL_BLOCKED' in blocked.stdout
    m['clips'][0]['source']='REJETE_STOP04_V7_QA.mp4';assert validate(m,root)
    print('PASS: source-first audio + original archival film, 1080p QA, reject old QA sources, refuse final with missing signoffs')
