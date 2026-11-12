#!/usr/bin/env python3
"""Velvet Passport source-first scene assembler, based on velvet_integrated_factory.

One project manifest is reused for every route (not one script per stop). Source
media and voice are checked by SHA. Only verified contiguous scene groups may be
made into private QA clips. A production release is ALWAYS refused unless the
separate master contract and external human QA both pass.

Usage: python velvet_scene_batch.py check --manifest project.json --root sources
       python velvet_scene_batch.py build --manifest project.json --root sources --scenes S20,S21 --out qa
"""
import argparse, hashlib, json, os, subprocess, sys, time
from pathlib import Path

MASTER = 'velvet-master-frame/v1'
BLOCKED_SOURCES = ('rejete', 'rejeté', 'stop04_v6', 'stop04_v7', 'assemblage_qa', 'grands_v7')


def run(cmd):
    p=subprocess.run([str(x) for x in cmd], capture_output=True,text=True)
    if p.returncode: raise RuntimeError(' '.join(map(str,cmd[:4]))+' : '+p.stderr[-2300:])
    return p.stdout


def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
    return h.hexdigest()


def probe(path):
    return json.loads(run(['ffprobe','-v','error','-show_format','-show_streams','-of','json',path]))


def media(root,pth,expected):
    if not pth or any(t in pth.lower() for t in BLOCKED_SOURCES):
        raise ValueError('Rejected or missing media path: '+str(pth))
    p=(root/pth).resolve()
    if not p.is_relative_to(root.resolve()) or not p.is_file():raise ValueError('Media unavailable: '+str(pth))
    if not expected or sha(p)!=expected:raise ValueError('Source SHA mismatch: '+str(pth))
    return p


def audit(manifest,root):
    if manifest.get('template')!=MASTER:raise ValueError('Master template missing')
    rows=[]
    for scene in manifest.get('scenes',[]):
        sid=scene['scene_id']; issues=[]; checked=[]
        if scene.get('deleted'):continue
        plans=scene.get('plans',[])
        if not plans:issues.append('NO_ORIGINAL_VISUAL_PLAN')
        for x in plans:
            try:
                media(root,x.get('source'),x.get('sha256'))
                if x.get('kind')=='photo':
                    if x.get('voice'):
                        wav=media(root,x['voice'],x.get('voice_sha256'))
                        voice_seconds=float(probe(wav)['format']['duration'])
                        plan_seconds=float(x['duration']) if x.get('duration') else 0.0
                        if float(x.get('voice_delay',0)) + voice_seconds > plan_seconds + 0.03:
                            issues.append('VOICE_CUT_AT_PLAN_END:'+x['plan_id'])
                    elif not x.get('no_voice_verified'): issues.append('VOICE_OR_TIMING_NOT_CERTIFIED:'+x['plan_id'])
                    if not x.get('duration') or x['duration']<=0:issues.append('PLAN_TIMING_NOT_CERTIFIED:'+x['plan_id'])
                elif x.get('kind')=='archive_film':
                    pr=probe(root/x['source']);
                    if not {'video','audio'}.issubset({s['codec_type'] for s in pr['streams']}):issues.append('ARCHIVE_AUDIO_MISSING:'+x['plan_id'])
                else:issues.append('UNKNOWN_MEDIA_TYPE:'+x['plan_id'])
                checked.append(x['plan_id'])
            except (ValueError,RuntimeError,TypeError) as e:issues.append('MEDIA_HOLD:'+x.get('plan_id','?')+':'+str(e))
            if x.get('subtitle_status')!='VERIFIED':issues.append('SUBTITLES_UNVERIFIED:'+x['plan_id'])
        if not scene.get('audio_editorial_lock',False):issues.append('AUDIO_EDITORIAL_LOCK_MISSING')
        if not scene.get('rights_verified',False):issues.append('COMMERCIAL_RIGHTS_HOLD')
        if not scene.get('mobile_human_qa_passed',False):issues.append('MOBILE_HUMAN_QA_PENDING')
        rows.append({'scene_id':sid,'expected_plans':scene.get('expected_plans',len(plans)),
                     'verified_source_plan_ids':checked,'qa_workprint_possible':bool(plans) and not any(z.startswith(('MEDIA_HOLD','VOICE_CUT_AT_PLAN_END','VOICE_OR_TIMING_NOT_CERTIFIED','PLAN_TIMING_NOT_CERTIFIED','NO_ORIGINAL')) for z in issues),
                     'final_pass':not issues,'issues':issues})
    return {'route_id':manifest.get('route_id'),'stop_id':manifest.get('stop_id'),
            'active_scene_count':len(rows),'complete_qa_scene_count':sum(x['qa_workprint_possible'] for x in rows),
            'ready_for_release':all(x['final_pass'] for x in rows) and len(rows)>0,
            'scenes':rows}


def render_scene(scene,root,out,cache,engine,route_id,stop_id):
    sid=scene['scene_id'];scdir=out/sid;scdir.mkdir(parents=True,exist_ok=True)
    m={'template':MASTER,'route_id':route_id,'stop_id':f'{stop_id}-{sid}',
       'final_human_approval':False,'commercial_rights_verified':False,
       'every_original_verified':True,'all_audio_lock':False,
       'all_subtitles_word_aligned':False,'mobile_qa_passed':False,
       'clips':[{'kind':x['kind'],'source':x['source'],'sha256':x['sha256'],
                 **{k:x[k] for k in ('duration','voice','voice_sha256','voice_delay','no_voice_verified','subtitle_file','subtitle_status') if k in x}}
                for x in scene['plans']]}
    mfile=scdir/'input.json';mfile.write_text(json.dumps(m,ensure_ascii=False,indent=2))
    run([sys.executable,engine,mfile,'--root',root,'--out',scdir,'--cache',cache])
    result=scdir/f'{route_id}-{stop_id}-{sid}-QA.mp4'
    if not result.exists():raise RuntimeError('Scene render failed to produce '+str(result))
    return result


def dissolve(left,right,out,duration):
    """Approve crossfade over exactly duration; archive audio drops while next voice begins after fade."""
    p=probe(left);q=probe(right)
    dl=float(p['format']['duration']);dr=float(q['format']['duration'])
    if not 0<duration<min(dl,dr):raise ValueError('Invalid transition duration')
    offset=dl-duration
    graph=(f'[0:v][1:v]xfade=transition=fade:duration={duration:.3f}:offset={offset:.3f}[v];'
           f'[0:a][1:a]acrossfade=d={duration:.3f}:c1=tri:c2=tri[a]')
    run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-i',left,'-i',right,
         '-filter_complex',graph,'-map','[v]','-map','[a]','-c:v','libx264','-preset','veryfast',
         '-crf','23','-pix_fmt','yuv420p','-r','25','-c:a','aac','-b:a','160k',
         '-movflags','+faststart',out]);
    actual=float(probe(out)['format']['duration'])
    target=dl+dr-duration
    if abs(actual-target)>.12:raise RuntimeError(f'Crossfade duration mismatch {actual} vs {target}')
    return {'duration_seconds':actual,'crossfade_seconds':duration,'expected_seconds':target}


def main():
    ap=argparse.ArgumentParser();ap.add_argument('action',choices=['check','build']);ap.add_argument('--manifest',required=True,type=Path);ap.add_argument('--root',required=True,type=Path);ap.add_argument('--scenes',default='');ap.add_argument('--out',default='qa',type=Path);ap.add_argument('--engine',type=Path,default=Path(__file__).with_name('velvet_integrated_factory.py'));a=ap.parse_args()
    root=a.root.resolve();m=json.loads(a.manifest.read_text());report=audit(m,root)
    if a.action=='check':print(json.dumps(report,ensure_ascii=False,indent=2));return 0 if report['ready_for_release'] else 2
    ids=[x.strip() for x in a.scenes.split(',') if x.strip()]
    if not ids:raise ValueError('No scene subset requested; full STOP04 cannot be guessed')
    active=[s['scene_id'] for s in m['scenes'] if not s.get('deleted')]
    idx=[active.index(x) for x in ids]
    if idx!=list(range(idx[0],idx[0]+len(idx))):raise ValueError('A QA batch must be contiguous (no missing scenes silently omitted)')
    selected=[next(x for x in m['scenes'] if x['scene_id']==sid) for sid in ids]
    scene_rows={x['scene_id']:x for x in report['scenes']}
    for s in selected:
        if not scene_rows[s['scene_id']]['qa_workprint_possible']:
            raise ValueError('Source-first QA cannot render '+s['scene_id']+': '+','.join(scene_rows[s['scene_id']]['issues']))
    a.out.mkdir(parents=True,exist_ok=True);cache=a.out/'cache';cache.mkdir(exist_ok=True)
    clips=[render_scene(s,root,a.out,cache,a.engine.resolve(),m['route_id'],m['stop_id']) for s in selected]
    merged=clips[0]
    operations=[]
    for i,(scene,clip) in enumerate(zip(selected[1:],clips[1:]),start=1):
        transition=scene.get('transition_from_previous')
        dst=a.out/f'workprint_through_{scene["scene_id"]}.mp4'
        if transition:
            if transition.get('type')!='crossfade':raise ValueError('Unsupported transition')
            operations.append(dissolve(merged,clip,dst,float(transition['duration'])))
        else:
            lst=a.out/f'concat_{i}.txt';lst.write_text("file '"+str(merged.resolve())+"'\nfile '"+str(clip.resolve())+"'\n")
            run(['ffmpeg','-nostdin','-loglevel','error','-y','-f','concat','-safe','0','-i',lst,'-c','copy',dst]);operations.append({'transition':'hard_cut_no_duration_change'})
        merged=dst
    final=a.out/(m['stop_id']+'_'+ids[0]+'_TO_'+ids[-1]+'_PRIVATE_QA.mp4')
    import shutil
    shutil.copy2(merged,final)
    p=probe(final);result={'status':'PRIVATE_QA_NOT_FINAL','file':str(final),'duration_seconds':float(p['format']['duration']),
                           'scenes':ids,'transitions':operations,'untested_subtitles':True,
                           'source_first_only':True,'final_approved':False}
    (a.out/'BATCH_REPORT.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps(result,ensure_ascii=False,indent=2));return 0

if __name__=='__main__':raise SystemExit(main())
