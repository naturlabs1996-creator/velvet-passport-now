#!/usr/bin/env python3
"""FFmpeg-backed tiny synthetic CI fixture for Velvet factory; not a historical asset."""
import hashlib, json, pathlib, subprocess, sys, tempfile, zipfile
from xml.etree.ElementTree import ElementTree, Element, SubElement

from velvet_factory import run, validate_timeline


def cmd(args):
    subprocess.run(args,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)

def sha(b):return hashlib.sha256(b).hexdigest()

def main():
    with tempfile.TemporaryDirectory() as td:
        home=pathlib.Path(td);work=home/'input';(work/'media').mkdir(parents=True)
        clips=[]
        for i in range(2):
            name=f'media/clip{i}.mp4';clips.append(name)
            cmd(['ffmpeg','-v','error','-f','lavfi','-i',f'color=c={"black" if i==0 else "white"}:s=1920x1080:r=25:d=0.40',
                 '-t','0.4','-an','-c:v','libx264','-preset','ultrafast','-crf','38','-pix_fmt','yuv420p','-y',str(work/name)])
        audio='media/voice.wav'
        cmd(['ffmpeg','-v','error','-f','lavfi','-i','sine=frequency=450:sample_rate=24000:duration=0.8',
             '-ac','1','-c:a','pcm_s24le','-y',str(work/audio)])
        xml=Element('mlt')
        for name in clips+[audio]:
            el=SubElement(xml,'chain');prop=SubElement(el,'property',{'name':'resource'});prop.text=name
        ElementTree(xml).write(work/'smoketest.kdenlive',xml_declaration=True,encoding='utf8')
        members=[p for p in work.rglob('*') if p.is_file()]
        manifest=[{'file':str(p.relative_to(work)),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in members]
        (work/'MANIFEST_SHA256.json').write_text(json.dumps(manifest))
        archive=home/'tiny.zip'
        with zipfile.ZipFile(archive,'w') as f:
            for p in work.rglob('*'):
                if p.is_file():f.write(p,p.relative_to(work))
        spec={'route_id':'TEST','chapter_id':'TEST-01','language':'fr','clips':clips,'voice':audio}
        success=run(archive,home/'output',None,False) if False else None
        (work/'FACTORY_SPEC.json').write_text(json.dumps(spec))
        # regenerate package including the spec (it is not historical media, only a build instruction).
        with zipfile.ZipFile(archive,'w') as f:
            for p in work.rglob('*'):
                if p.is_file():f.write(p,p.relative_to(work))
        receipt=run(archive,home/'out',None,False)
        assert abs(receipt['render_duration_seconds']-0.8)<0.01
        assert receipt['release_ready'] is False
        assert receipt['published_to_now'] is False
        assert receipt['source_hashes_verified']==len(manifest)
        print('PASS synthetic render + original audio + factory record, never public',flush=True)
        fail_spec={**spec, 'clips':clips[:1]}
        try:validate_timeline(home/'out'/'source',fail_spec)
        except ValueError as e:assert 'TIMELINE_NOT_ALIGNED' in str(e)
        else:raise AssertionError('Missing 1/2 clips not rejected')
        print('PASS missing clip in timeline leads to HARD STOP',flush=True)
        fail_spec={**spec, 'clips':['media/not-present.mp4']}
        try:validate_timeline(home/'out'/'source',fail_spec)
        except ValueError as e:assert 'MISSING_SHOT' in str(e)
        else:raise AssertionError('Unknown media not rejected')
        print('PASS unknown file leads to HARD STOP',flush=True)
        prop=home/'out'/'source'/'smoketest.kdenlive'
        s=prop.read_text();prop.write_text(s.replace('media/clip1.mp4','media/FAKE.jpg'))
        try:validate_timeline(home/'out'/'source',spec)
        except ValueError as e:assert 'PROJECT_MISSING_MEDIA_REFERENCE' in str(e)
        else:raise AssertionError('Bad Kdenlive references not rejected')
        print('PASS mismatched project media reference leads to HARD STOP',flush=True)
        print('ALL FACTORY SMOKE TESTS PASSED')

if __name__=='__main__':main()