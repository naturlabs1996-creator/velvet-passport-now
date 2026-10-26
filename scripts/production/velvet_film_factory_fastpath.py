#!/usr/bin/env python3
"""Velvet Passport film assembly — deterministic, fail-closed, preview vs release.

Requires FFmpeg + FFprobe. Offline, no Supabase bypass. A manifest describes
assets and exact cue timeline; an authenticated separate release audit is required
for public NOW publication. Does not silently swap or generate historical images.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

VIDEO_WIDTH, VIDEO_HEIGHT, FPS = 1920, 1080, 25
TOL = 0.06

class GateError(Exception): pass

def sha256(path: Path) -> str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()

def call(args:list[str]) -> subprocess.CompletedProcess:
    p=subprocess.run(args,capture_output=True,text=True)
    if p.returncode: raise GateError(f"Command failed: {' '.join(args[:8])}\n{p.stderr[-1000:]}")
    return p

def media_info(path:Path) -> dict:
    return json.loads(call(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(path)]).stdout)

def video_stream(info):return next((s for s in info['streams'] if s['codec_type']=='video'),None)
def audio_stream(info):return next((s for s in info['streams'] if s['codec_type']=='audio'),None)

def checked_path(root:Path, name:str)->Path:
    if not isinstance(name,str) or not name or name.startswith(('/', '\\')):raise GateError(f'Unsafe or empty media path {name!r}')
    p=(root/name).resolve()
    if not p.is_relative_to(root.resolve()):raise GateError(f'Path escapes media package {name!r}')
    if not p.is_file():raise GateError(f'MISSING_MEDIA: {name}')
    return p

def verify(manifest:dict, root:Path, publication:bool=False)->dict:
    errors=[]
    def check(test, message):
        if not test:errors.append(message)
    for k in ('route_id','language','audio','shots'):
        check(k in manifest,f'MANIFEST_FIELD_MISSING:{k}')
    check(manifest.get('language') in ('fr','en'),'UNKNOWN_LANGUAGE')
    shots=manifest.get('shots',[])
    check(bool(shots),'NO_SHOTS')
    if errors:return {'ready':False,'errors':errors,'seconds':0}
    total=0.;seen=set();media=[]
    for i,sh in enumerate(shots,1):
        key=sh.get('id',f'shot{i}')
        if key in seen:errors.append(f'{key}:DUPLICATE_SHOT_ID')
        seen.add(key)
        kind=sh.get('kind')
        if kind not in ('video','image'):errors.append(f'{key}:INVALID_MEDIA_KIND');continue
        duration=sh.get('duration_seconds',0)
        if not isinstance(duration,(float,int)) or duration < 0.2:errors.append(f'{key}:INVALID_DURATION');continue
        duration=float(duration)
        if abs(duration*FPS-round(duration*FPS))>1e-4:errors.append(f'{key}:NOT_ALIGNED_TO_25FPS')
        offset=float(sh.get('start_seconds',-1))
        if abs(offset-total)>TOL:errors.append(f'{key}:GAP_OR_OVERLAP_AT_{total:.3f}')
        src=sh.get('source_record','').strip()
        check(bool(src) and src.startswith('https://'),f'{key}:MISSING_SOURCE_PROVENANCE')
        check(bool(sh.get('context_verified')) ,f'{key}:HISTORICAL_CONTEXT_NOT_VERIFIED')
        check(bool(sh.get('spoken_cue')) ,f'{key}:SPOKEN_CUE_NOT_MAPPED')
        check(bool(sh.get('asset_id')),f'{key}:ASSET_ID_MISSING')
        check(sh.get('rights_status') in ('verified','pending'),f'{key}:RIGHTS_STATUS_UNKNOWN')
        if publication:
            check(sh.get('rights_status')=='verified',f'{key}:RIGHTS_NOT_VERIFIED')
            check(bool(sh.get('mastodon_receipt')),f'{key}:NO_MASTODON_READBACK_RECEIPT')
            check(sh.get('sync_approved') is True,f'{key}:SYNC_NOT_APPROVED')
        try:
            file=checked_path(root,sh.get('file',''))
            digest=sha256(file)
            check(digest == sh.get('sha256'),f'{key}:SHA256_MISMATCH')
            info=media_info(file) if kind=='video' else None
            if kind=='video':
                vs=video_stream(info)
                check(vs is not None,f'{key}:NO_VIDEO_STREAM')
                check(float(info['format']['duration'])+TOL>=duration,f'{key}:CLIP_TOO_SHORT')
            media.append({'id':key,'file':str(file),'sha256':digest,'duration_seconds':duration,'kind':kind,'info':info})
        except (GateError,ValueError,OSError) as e:errors.append(f'{key}:{e}')
        total+=duration
    audio=manifest['audio']
    try:
        ap=checked_path(root,audio.get('file',''))
        check(sha256(ap)==audio.get('sha256'),'AUDIO_SHA256_MISMATCH')
        ai=media_info(ap)
        check(audio_stream(ai) is not None,'NO_AUDIO_STREAM')
        at=float(ai['format']['duration'])
        check(abs(at-total)<0.15,f'AUDIO_VIDEO_DURATION_MISMATCH:audio={at:.3f},shots={total:.3f}')
    except (GateError,ValueError,OSError) as e:errors.append(f'AUDIO:{e}')
    check(abs(total-float(manifest.get('expected_duration_seconds',-1)))<TOL,'EXPECTED_ROUTE_DURATION_MISMATCH')
    if publication:
        check(manifest.get('release_signed') is True,'RELEASE_NOT_SIGNED')
        check(manifest.get('subtitle_qa') is True,'SUBTITLES_NOT_APPROVED')
        check(manifest.get('all_chapters_complete') is True,'CHAPTER_COVERAGE_NOT_COMPLETE')
        check(manifest.get('en_fr_versions_qa') is True,'BILINGUAL_QA_NOT_APPROVED')
    return {'ready':not errors,'errors':errors,'seconds':round(total,3),'shots':len(shots),'assets':media,
            'publication_checked':publication}

def fastcopyable(assets)->bool:
    for asset in assets:
        if asset['kind']!='video':return False
        v=video_stream(asset['info'])
        if not v or v['codec_name']!='h264' or v['width']!=VIDEO_WIDTH or v['height']!=VIDEO_HEIGHT:return False
        if v.get('avg_frame_rate')!='25/1':return False
    return True

def build(m:dict,root:Path,output:Path, publication:bool=False)->dict:
    report=verify(m,root,publication)
    if not report['ready']:raise GateError(json.dumps(report,ensure_ascii=False,indent=2))
    output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='velvet-factory-') as tmp:
        work=Path(tmp)
        parts=[]
        passthrough=fastcopyable(report['assets']) and all(
            not sh.get('fade_in_seconds') and not sh.get('fade_out_seconds') for sh in m['shots'])
        for index, (sh,asset) in enumerate(zip(m['shots'],report['assets'])):
            src=Path(asset['file'])
            if passthrough:
                parts.append(src);continue
            render=work/f'{index:03d}.mp4';dur=asset['duration_seconds']
            fades=[]
            fi=float(sh.get('fade_in_seconds',0));fo=float(sh.get('fade_out_seconds',0))
            if min(fi,fo)<0 or max(fi,fo)>dur/2:raise GateError(f'{asset["id"]}:INVALID_FADE_DURATION')
            if fi:fades.append(f'fade=t=in:st=0:d={fi:.3f}')
            if fo:fades.append(f'fade=t=out:st={dur-fo:.3f}:d={fo:.3f}')
            filt=f'scale={VIDEO_WIDTH}:{VIDEO_HEIGHT}:force_original_aspect_ratio=decrease,'
            filt+=f'pad={VIDEO_WIDTH}:{VIDEO_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black,fps={FPS},format=yuv420p'
            if fades:filt+=','+','.join(fades)
            input_args=(['-loop','1','-framerate',str(FPS)] if sh['kind']=='image' else [])
            call(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y',*input_args,'-i',str(src),
                 '-t',str(dur),'-vf',filt,'-an','-c:v','libx264','-preset','veryfast',
                 '-crf','20','-pix_fmt','yuv420p','-r',str(FPS),str(render)])
            parts.append(render)
        listfile=work/'concat.txt'
        def esc(p:Path):return str(p).replace("'", "'\\''")
        listfile.write_text(''.join(f"file '{esc(p)}'\n" for p in parts))
        staged=work/'joined.mp4'
        # Re-encode only if H264 frame formats differ; standardize clips on input for now.
        call(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y',
             '-f','concat','-safe','0','-i',str(listfile),'-i',str(checked_path(root,m['audio']['file'])),
             '-map','0:v:0','-map','1:a:0','-t',str(report['seconds']),
             '-c:v','copy','-c:a','aac','-b:a','160k','-movflags','+faststart',str(staged)])
        final_info=media_info(staged)
        if not video_stream(final_info) or not audio_stream(final_info):raise GateError('OUTPUT_MISSING_VIDEO_OR_AUDIO')
        if abs(float(final_info['format']['duration'])-report['seconds'])>0.18:raise GateError('OUTPUT_DURATION_INCORRECT')
        os.replace(staged,output)
    result={ 'route_id':m['route_id'],'language':m['language'],'output':str(output),
             'output_sha256':sha256(output),'bytes':output.stat().st_size,
             'duration_seconds':report['seconds'],'shot_count':report['shots'],
             'build_mode':'FAST_PASSTHROUGH' if passthrough else 'RENDERED_SHOTS',
             'release_state':'PUBLICATION_QA_SIGNED' if publication else 'PRIVATE_WORKPRINT_NOT_APPROVED',
             'source_manifest_sha256':sha256(Path(m['_manifest_path']))}
    receipt=output.with_suffix('.receipt.json')
    receipt.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
    return result

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--manifest',type=Path,required=True)
    ap.add_argument('--check',action='store_true',help='Audit inputs without any render')
    ap.add_argument('--publish',action='store_true',help='Require all release evidence (does not publish itself)')
    ap.add_argument('--out',type=Path)
    args=ap.parse_args()
    try:
        m=json.loads(args.manifest.read_text())
        m['_manifest_path']=str(args.manifest.resolve())
        root=args.manifest.parent.resolve()
        if args.check:
            report=verify(m,root,args.publish)
            print(json.dumps({k:v for k,v in report.items() if k!='assets'},ensure_ascii=False,indent=2))
            return 0 if report['ready'] else 2
        if not args.out:ap.error('--out required for build')
        print(json.dumps(build(m,root,args.out,args.publish),ensure_ascii=False,indent=2))
        return 0
    except (GateError,ValueError,KeyError,OSError) as e:
        print('VELVET_PRODUCTION_BLOCKED: '+str(e),file=sys.stderr)
        return 2
if __name__=='__main__':sys.exit(main())