#!/usr/bin/env python3
"""Velvet Passport source-first audio+video+subtitle workprint builder.
Final release is blocked until exact sources, rights, real subtitle alignment and human QA pass.
Never use a rejected QA movie as a media source.
"""
import argparse, hashlib, json, shutil, subprocess, tempfile, time
from pathlib import Path

BAD=('rejete','rejeté','stop04_v6','stop04_v7','assemblage_qa','grands_v7')
W,H,FPS=1920,1080,25

def run(cmd):
    p=subprocess.run([str(x) for x in cmd],capture_output=True,text=True)
    if p.returncode: raise RuntimeError('command failure '+str(cmd[:3])+': '+p.stderr[-900:])
    return p.stdout

def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()

def safe(root,name):
    if not name or any(t in str(name).lower() for t in BAD):raise ValueError('Rejected/absent media path: '+str(name))
    p=(root/name).resolve()
    if not p.is_relative_to(root.resolve()) or not p.is_file():raise ValueError('Source file absent/outside root: '+str(name))
    return p

def probe(p):
    return json.loads(run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',p]))

def sourceinfo(src, sha_expected, root):
    p=safe(root,src)
    actual=sha(p)
    if not sha_expected or actual!=sha_expected:raise ValueError('SHA256 absent/incorrect for '+src)
    return p,actual

def validate(manifest,root):
    errors=[]
    if manifest.get('template')!='velvet-master-frame/v1':errors.append('Template missing')
    if not manifest.get('clips'):errors.append('No clips')
    for i,c in enumerate(manifest.get('clips',[])):
        try:
            p,_=sourceinfo(c.get('source'),c.get('sha256'),root)
            if c.get('kind') not in ('photo','archive_film'):raise ValueError('Invalid media type')
            if c.get('kind')=='photo':
                voice=c.get('voice')
                if voice:
                    sourceinfo(voice,c.get('voice_sha256'),root)
                    if float(c.get('voice_delay',0))<0:raise ValueError('Invalid audio offset')
                elif not c.get('no_voice_verified'):raise ValueError('Photo lacks verified audio')
                if not c.get('duration') or float(c['duration'])<=0:raise ValueError('Photo duration absent')
            else:
                if not any(s.get('codec_type')=='audio' for s in probe(p)['streams']):raise ValueError('Original film audio missing')
                if not any(s.get('codec_type')=='video' for s in probe(p)['streams']):raise ValueError('Original film video missing')
            if c.get('subtitle_status')=='VERIFIED':
                if not c.get('subtitle_file'):raise ValueError('Verified subtitles lack file')
                safe(root,c['subtitle_file'])
            elif c.get('subtitle_file'):
                raise ValueError('Subtitle file present but not verified')
        except (ValueError, KeyError, RuntimeError,TypeError) as e: errors.append(f'clip[{i}] {e}')
    return errors

def vf(c,root):
    has_verified=c.get('subtitle_status')=='VERIFIED'
    top=860 if has_verified else 1080
    filt=f'scale={W}:{top}:force_original_aspect_ratio=decrease,pad={W}:{top}:(ow-iw)/2:(oh-ih)/2:color=0x080e1a'
    if top!=H:
        filt+=f',pad={W}:{H}:0:0:color=0x080e1a'
        # ASS must contain actual transcript and word/phrase-specific timings.
        sub=safe(root,c['subtitle_file']).as_posix().replace(':','\\:').replace("'","\\'")
        filt+=f",ass=filename='{sub}'"
    return filt+',fps=25,format=yuv420p'

def clip_build(c,root,dst):
    src=safe(root,c['source']);cmd=['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y']
    if c['kind']=='photo':
        cmd+=['-loop','1','-framerate',str(FPS),'-i',src]
        if c.get('voice'):
            cmd+=['-i',safe(root,c['voice']),'-filter_complex',f'[1:a]adelay={int(round(float(c.get("voice_delay",0))*1000))}:all=1,apad,atrim=0:{float(c["duration"]):.5f}[a]','-map','0:v:0','-map','[a]']
        else:
            cmd+=['-f','lavfi','-i',f'anullsrc=r=48000:cl=stereo','-map','0:v:0','-map','1:a:0']
        cmd+=['-t',str(c['duration'])]
    else:
        cmd+=['-i',src,'-map','0:v:0','-map','0:a:0']
        if c.get('duration'):
            assert abs(float(c['duration'])-float(probe(src)['format']['duration']))<.25,'Do not respeed or shorten archive'
    cmd+=['-vf',vf(c,root),'-r',str(FPS),'-c:v','libx264','-preset','ultrafast','-crf','25','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2','-b:a','160k','-movflags','+faststart',dst]
    run(cmd)
    obj=probe(dst)
    if (int(next(x for x in obj['streams'] if x['codec_type']=='video')['width']),int(next(x for x in obj['streams'] if x['codec_type']=='video')['height']))!=(W,H):raise RuntimeError('Invalid output geometry')
    return float(obj['format']['duration'])

def main():
    pa=argparse.ArgumentParser();pa.add_argument('manifest',type=Path);pa.add_argument('--root',type=Path);pa.add_argument('--out',type=Path);pa.add_argument('--cache',type=Path);pa.add_argument('--final',action='store_true');a=pa.parse_args()
    m=json.loads(a.manifest.read_text());root=(a.root or a.manifest.parent).resolve(); out=(a.out or Path('out')).resolve();cache=(a.cache or out/'cache').resolve()
    errors=validate(m,root)
    if a.final:
        if not m.get('final_human_approval'):errors.append('FINAL_BLOCKED: human approval absent')
        for key in ('commercial_rights_verified','every_original_verified','all_audio_lock','all_subtitles_word_aligned','mobile_qa_passed'):
            if m.get(key)is not True:errors.append('FINAL_BLOCKED: '+key)
        if any(c.get('subtitle_status')!='VERIFIED' and not c.get('no_speech_verified') for c in m.get('clips',[])):errors.append('FINAL_BLOCKED: speech not subtitled')
    if errors:
        print(json.dumps({'status':'BLOCKED','errors':errors},ensure_ascii=False,indent=2));return 2
    out.mkdir(parents=True,exist_ok=True);cache.mkdir(parents=True,exist_ok=True)
    clips=[];report=[];start=time.monotonic()
    for i,c in enumerate(m['clips']):
        sig=hashlib.sha256(json.dumps({'c':c,'version':'v1.1'},sort_keys=True).encode()).hexdigest()[:20]
        dst=cache/(sig+'.mp4');hit=dst.is_file()
        if not hit:clip_build(c,root,dst)
        clips.append(dst)
        report.append({'index':i,'source':c['source'],'source_sha256':c['sha256'],'clip_seconds':float(probe(dst)['format']['duration']),'cache_hit':hit,'subtitles':c.get('subtitle_status','MISSING')})
    with tempfile.TemporaryDirectory() as td:
        lst=Path(td)/'files.txt';lst.write_text(''.join("file '"+str(p).replace("'","'\\''")+"'\n" for p in clips))
        result=out/(m.get('route_id','ROUTE')+'-'+m.get('stop_id','STOP')+'-QA.mp4')
        run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',lst,'-c','copy','-movflags','+faststart',result])
    obj=probe(result)
    data={'status':'FINAL_REVIEW_REQUIRED' if not a.final else 'FINAL_TECHNICAL_PASS_HUMAN_APPROVAL_ALREADY_RECORDED','template':'velvet-master-frame/v1','output':str(result),'duration':float(obj['format']['duration']),'elapsed_seconds':round(time.monotonic()-start,2),'clips':report,'warnings':([] if a.final else ['QA ONLY: missing subtitles/rights/audio approval not fabricated','No final release without independent human review'])}
    (out/'QA_REPORT.json').write_text(json.dumps(data,indent=2,ensure_ascii=False));print(json.dumps(data,indent=2,ensure_ascii=False));return 0
if __name__=='__main__':raise SystemExit(main())
