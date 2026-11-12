#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Velvet Passport single entrypoint, source-first, universal 1080p template.

Commands: audit, render. QA renders may contain warning overlays and are NEVER
releasable. FINAL is fail-closed: all original media + commercial rights +
spoken subtitles aligned by human + mix + complete sequence + approval.

Requires ffmpeg, ffprobe, Pillow (in common master module). Safe to run on a
folder with private assets: does not upload, publish or generate a voice.
"""
from __future__ import annotations
import argparse, hashlib, json, os, re, shutil, subprocess, sys, tempfile, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# Import the ONE geometry contract, rather than implementing a second layout.
from velvet_gabarit_maitre import fit_geometry

W,H,FPS=1920,1080,25
BAND=220
SCHEMA='velvet-unified-av/v2'
TEMPLATE='velvet-master-frame/v1'
BANNED=re.compile(r'(?:rejete|rejeté|_v6_qa|_v7_qa|stop04[_-]v[67]|assemblage_qa|sous_titres_grands_v7)',re.I)


def sha(path):
 h=hashlib.sha256()
 with open(path,'rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()


def run(args):
 p=subprocess.run(list(map(str,args)),capture_output=True,text=True)
 if p.returncode:raise RuntimeError(' '.join(map(str,args[:4]))+' failed: '+p.stderr[-1600:])
 return p.stdout


def probe(path):
 return json.loads(run(['ffprobe','-v','error','-show_format','-show_streams','-of','json',path]))


def safe_path(root,name):
 if not isinstance(name,str) or not name:return None
 p=(root/name).resolve()
 if not p.is_relative_to(root.resolve()):raise ValueError('Source outside approved media root: '+name)
 return p


def entries(manifest):
 for scene in manifest.get('scenes',[]):
  if scene.get('deleted'):continue
  for shot in scene.get('plans',[]):yield scene,shot


def inspect(manifest,root,final=False,scope=None):
 issues=[];warnings=[];visible=[];ids=[];found=0;photo_shas={};timeline_start=0.0
 if manifest.get('schema')!=SCHEMA:issues.append('SCHEMA_MUST_BE_'+SCHEMA)
 if manifest.get('global_video_template')!=TEMPLATE:issues.append('UNIVERSAL_MASTER_MISSING')
 if not manifest.get('route_id'):issues.append('ROUTE_ID_MISSING')
 scenes=manifest.get('scenes',[])
 if not scenes:issues.append('SCENES_MISSING')
 for scene,shot in entries(manifest):
  if scope and scene['id']!=scope:continue
  sid=shot.get('id','?');ids.append(sid);problems=[]
  kind=shot.get('kind')
  if kind not in ('photo','archive_film'):problems.append('INVALID_MEDIA_TYPE')
  src=shot.get('source')
  if not src or BANNED.search(src):problems.append('UNTRUSTED_OR_REJECTED_SOURCE')
  else:
   try:
    p=safe_path(root,src)
    if not p.is_file():problems.append('SOURCE_NOT_ACQUIRED')
    elif not shot.get('sha256') or sha(p)!=shot['sha256']:problems.append('SOURCE_SHA_MISMATCH')
    else:
     found+=1
     if kind=='photo':
      if shot['sha256'] in photo_shas and not (shot.get('repeat_authorized') and photo_shas[shot['sha256']].get('repeat_authorized')):
       problems.append('DUPLICATE_PHOTO_UNAUTHORIZED:'+photo_shas[shot['sha256']]['id'])
      photo_shas[shot['sha256']]=shot
     if kind=='archive_film':
      q=probe(p)
      if not any(s['codec_type']=='video' for s in q['streams']):problems.append('NO_ARCHIVE_VIDEO')
      if shot.get('sound_mode')=='archive_original_only' and not any(s['codec_type']=='audio' for s in q['streams']):problems.append('NO_ARCHIVE_AUDIO')
      if d is not None and float(shot.get('source_in',0))+float(d)>float(q['format']['duration'])+.10:problems.append('SOURCE_WINDOW_OUT_OF_RANGE')
   except (ValueError,RuntimeError) as e:problems.append('SOURCE_ERROR:'+str(e)[:90])
  if final and shot.get('rights')!='cleared_commercial':problems.append('RIGHTS_NOT_CLEARED')
  if final and not shot.get('visual_approved'):problems.append('VISUAL_LOCK_MISSING')
  if final and not shot.get('plan_qa_pass'):problems.append('PLAN_VISUAL_QA_MISSING')
  d=shot.get('duration')
  if d is None or float(d)<=0:problems.append('ACTUAL_DURATION_MISSING')
  elif final:
   if shot.get('absolute_start') is None:problems.append('TIMELINE_START_MISSING')
   elif abs(float(shot['absolute_start'])-timeline_start)>.06:problems.append('TIMELINE_GAP_OR_OVERLAP')
   fade=float(shot.get('transition_out',{}).get('seconds',0))
   timeline_start+=float(d)-fade
  audio=shot.get('audio',{})
  amode=audio.get('mode')
  if amode not in ('voice','archive_original_only','silence'):problems.append('AUDIO_MODE_UNDECLARED')
  if amode=='archive_original_only' and kind!='archive_film':problems.append('ARCHIVE_AUDIO_REQUIRES_FILM')
  if kind=='archive_film' and shot.get('sound_mode')=='archive_original_only' and amode!='archive_original_only':problems.append('ARCHIVE_SOUND_LOCK_BROKEN')
  if amode=='voice':
   ap=audio.get('path')
   try:
    p=safe_path(root,ap)
    if not p or not p.is_file():problems.append('VOICE_WAV_MISSING')
    elif not audio.get('sha256') or sha(p)!=audio['sha256']:problems.append('VOICE_SHA_MISMATCH')
    elif d is not None and float(d)>0:
     dur=float(probe(p)['format']['duration'])
     if dur+float(audio.get('offset',0))>float(d)+.05:problems.append('VOICE_CUTS_OFF_END')
   except (ValueError,RuntimeError) as e:problems.append('VOICE_INVALID:'+str(e)[:90])
   if final and not audio.get('editorial_lock'):problems.append('VOICE_EDITORIAL_LOCK_MISSING')
  if amode=='silence' and shot.get('spoken'):problems.append('SPOKEN_CANNOT_BE_SILENT')
  if shot.get('spoken'):
   captions=shot.get('captions',[])
   if not captions:problems.append('SPOKEN_SUBTITLES_MISSING')
   else:
    for cue in captions:
     if (not cue.get('text') or cue.get('start') is None or cue.get('end') is None or
         float(cue.get('start',-1))<0 or float(cue.get('end',0))<=float(cue.get('start',0)) or
         (d is not None and float(cue['end'])>float(d)+.01)):
      problems.append('CAPTIONS_INVALID');break
   if final and not shot.get('subtitle_human_verified'):problems.append('SUBTITLE_ALIGNMENT_NOT_APPROVED')
  else:
   if shot.get('captions'):problems.append('SILENT_HAS_CAPTION_TRACK')
  if final and shot.get('timing_verified') is not True:problems.append('TIMING_NOT_APPROVED')
  transition=shot.get('transition_out',{})
  if transition:
   if transition.get('type')!='crossfade' or float(transition.get('seconds',0))<=0:problems.append('INVALID_TRANSITION')
   if final and not transition.get('editorial_lock'):problems.append('TRANSITION_NOT_LOCKED')
  visible.append({'id':sid,'scene':scene.get('id'),'source':src,'found_verified':not any(x.startswith(('SOURCE_','UNTRUSTED','NO_ARCHIVE')) for x in problems),
                  'duration':d,'spoken':shot.get('spoken'), 'issues':list(dict.fromkeys(problems))})
  for x in problems:
   if final or x not in ('SPOKEN_SUBTITLES_MISSING','ACTUAL_DURATION_MISSING','AUDIO_MODE_UNDECLARED','VOICE_WAV_MISSING'):
    issues.append(sid+':'+x)
   else:warnings.append(sid+':'+x)
 if scope and not visible:issues.append('SCENE_NOT_FOUND:'+scope)
 if len(ids)!=len(set(ids)):issues.append('DUPLICATE_PLAN_IDS')
 if final:
  exp=manifest.get('expected_plan_ids',[])
  if scope:issues.append('FINAL_MUST_BE_COMPLETE_ROUTE')
  if not exp or sorted(ids)!=sorted(exp):issues.append('EXPECTED_PLANS_INCOMPLETE')
  if not manifest.get('final_human_approval'):issues.append('HUMAN_APPROVAL_MISSING')
  if not manifest.get('rights_signoff'):issues.append('RIGHTS_SIGNOFF_MISSING')
  if not manifest.get('mobile_qa_passed'):issues.append('MOBILE_QA_MISSING')
  if not manifest.get('full_narration_qc_passed'):issues.append('FULL_NARRATION_QA_MISSING')
  if not manifest.get('subtitle_qa_passed'):issues.append('FULL_SUBTITLE_QA_MISSING')
 return {'route_id':manifest.get('route_id'),'scope':scope or 'all','template':TEMPLATE,
         'plans_checked':len(visible),'verified_media':found,'issues':list(dict.fromkeys(issues)),
         'warnings':list(dict.fromkeys(warnings)),'items':visible,
         'status':('EXPORT_FINAL_REFUSED' if final and issues else 'BLOCKED' if issues else 'QA_ONLY_NOT_FINAL' if not final else 'READY_TO_RENDER')}


def srt_stamp(seconds):
 n=round(seconds*1000);h,r=divmod(n,3600000);m,r=divmod(r,60000);s,ms=divmod(r,1000)
 return f'{h:02}:{m:02}:{s:02},{ms:03}'


def ffsub(path):
 # Escape ffmpeg filter separators, while keeping SRT in temp workspace.
 return str(path).replace('\\','\\\\').replace(':','\\:').replace("'",r"\'").replace(',','\\,')


def filters(shot, temp):
 mode='spoken' if shot.get('spoken') else 'silent'
 height=860 if mode=='spoken' else 1080
 geom='scale=1920:%d:force_original_aspect_ratio=decrease,pad=1920:%d:(ow-iw)/2:(oh-ih)/2:color=0x080e1a' % (height,height)
 if mode=='spoken':geom+=',pad=1920:1080:0:0:color=0x080e1a'
 cues=shot.get('captions',[])
 if mode=='spoken' and cues:
  srt=temp/'captions.srt'
  srt.write_text('\n\n'.join('%d\n%s --> %s\n%s'%(i,srt_stamp(float(c['start'])),srt_stamp(float(c['end'])),c['text']) for i,c in enumerate(cues,1))+'\n',encoding='utf-8')
  geom+=",subtitles=filename='%s':force_style='FontName=Inter,FontSize=72,PrimaryColour=&H00FFFFFF,OutlineColour=&H00100E08,BackColour=&H00100E08,Outline=2,Alignment=2,MarginV=48'"%ffsub(srt)
 if mode=='spoken' and not cues:
  geom+=",drawtext=text='QA  -  SOUS-TITRES NON VALIDES':fontcolor=yellow:fontsize=46:x=(w-text_w)/2:y=963"
 geom+=",format=yuv420p,setsar=1"
 return geom


def make_clip(shot,root,clip,cache,quality='qa'):
 duration=float(shot['duration']);src=safe_path(root,shot['source']);audio=shot.get('audio',{})
 fingerprint={'engine':'VP-UNIFIED-V2.1','kind':shot['kind'],'source_sha':shot['sha256'],'duration':duration,
  'source_in':shot.get('source_in',0),'spoken':shot.get('spoken'),'captions':shot.get('captions',[]),
  'audio':audio,'quality':quality}
 key=hashlib.sha256(json.dumps(fingerprint,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
 cached=cache/(key+'.mp4');clip.parent.mkdir(parents=True,exist_ok=True);cache.mkdir(parents=True,exist_ok=True)
 if cached.exists() and cached.stat().st_size>8000:
  shutil.copy2(cached,clip);return True
 with tempfile.TemporaryDirectory(prefix='vpplan_') as td:
  tmp=Path(td);vf=filters(shot,tmp)
  command=['ffmpeg','-hide_banner','-loglevel','error','-y']
  if shot['kind']=='photo':
   from PIL import Image
   with Image.open(src) as im: sw,sh=im.size
  else:
   q=probe(src);s=next(x for x in q['streams'] if x['codec_type']=='video');sw,sh=s['width'],s['height']
  g=fit_geometry(sw,sh,'spoken' if shot.get('spoken') else 'silent')
  if not g['maximized'] or g['original_preserved_percent']!=100:raise RuntimeError('Master geometry failed to maximize without crop')
  if shot['kind']=='photo':command+=['-loop','1','-framerate','25','-i',str(src)]
  else:command+=['-ss',str(shot.get('source_in',0)),'-i',str(src)]
  amode=audio['mode']
  if amode=='voice':
   command+=['-i',str(safe_path(root,audio['path']))]
   delay=max(0,int(float(audio.get('offset',0))*1000))
   af=f'[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay={delay}|{delay},apad,atrim=duration={duration},asetpts=N/SR/TB[a]'
  elif amode=='archive_original_only':
   af=f'[0:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration={duration},asetpts=N/SR/TB[a]'
  else:
   command+=['-f','lavfi','-i','anullsrc=r=48000:cl=stereo']
   n=1
   af=f'[{n}:a]atrim=duration={duration},asetpts=N/SR/TB[a]'
  fc=f'[0:v]{vf},trim=duration={duration},setpts=PTS-STARTPTS[v];'+af
  command+=['-filter_complex',fc,'-map','[v]','-map','[a]','-t',str(duration),
      '-r',str(FPS),'-c:v','libx264','-preset','veryfast','-crf','24','-pix_fmt','yuv420p',
      '-c:a','aac','-b:a','160k','-ar','48000','-ac','2','-movflags','+faststart',str(tmp/'render.mp4')]
  run(command)
  q=probe(tmp/'render.mp4');a={x['codec_type'] for x in q['streams']}
  if not {'video','audio'}.issubset(a):raise RuntimeError('A/V streams missing')
  if abs(float(q['format']['duration'])-duration)>.13:raise RuntimeError('Clip duration mismatch')
  shutil.copy2(tmp/'render.mp4',cached)
 shutil.copy2(cached,clip)
 return False


def concat_with_transitions(items, clips, out):
 """Apply only explicitly signed crossfades; normal cuts otherwise."""
 if not clips:raise ValueError('No renderable plans')
 if len(clips)==1:shutil.copy2(clips[0],out);return
 # One xfade / acrossfade per declared transition; otherwise hard concat.
 with tempfile.TemporaryDirectory(prefix='vpjoin_') as td:
  td=Path(td)
  current=clips[0].resolve()
  clips=[Path(p).resolve() for p in clips]
  total=float(items[0]['duration'])
  for i in range(1,len(clips)):
   prev=items[i-1];f=prev.get('transition_out') or {};dur=float(f.get('seconds',0)) if f.get('type')=='crossfade' else 0.0
   nxt=float(items[i]['duration'])
   tmp=td/f'join{i:04}.mp4'
   if dur>0:
    if dur>=min(total,nxt)-.1:raise ValueError('Crossfade exceeds available video duration')
    off=total-dur
    fc=(f'[0:v][1:v]xfade=transition=fade:duration={dur}:offset={off},format=yuv420p[v];'
        f'[0:a][1:a]acrossfade=d={dur}:c1=tri:c2=tri[a]')
    run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',current,'-i',clips[i],'-filter_complex',fc,
      '-map','[v]','-map','[a]','-c:v','libx264','-preset','veryfast','-crf','23','-c:a','aac',
      '-b:a','160k','-r',str(FPS),'-movflags','+faststart',tmp])
   else:
    fpath=td/f'list{i}.txt';fpath.write_text("file '%s'\nfile '%s'\n"%(current,clips[i]))
    run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',fpath,
     '-c','copy','-movflags','+faststart',tmp])
   current=tmp;total+=nxt-dur
  shutil.copy2(current,out)
  actual=float(probe(out)['format']['duration'])
  if abs(actual-total)>.25:raise RuntimeError(f'Combined duration differs from expected: {actual} vs {total}')


def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('command',choices=['audit','render','draft-subs'])
 p.add_argument('--manifest',required=True,type=Path)
 p.add_argument('--root',type=Path,default=None)
 p.add_argument('--out',type=Path,default=Path('dist/velvet'))
 p.add_argument('--scope',default=None,help='Render one scene QA only, e.g. S20')
 p.add_argument('--language',choices=['fr','en'],default='fr')
 p.add_argument('--final',action='store_true')
 p.add_argument('--workers',type=int,default=2)
 p.add_argument('--cache',type=Path,default=Path('.cache/velvet'))
 a=p.parse_args()
 manifest=json.loads(a.manifest.read_text(encoding='utf-8'));root=(a.root or a.manifest.parent).resolve()
 if a.command=='render' and a.final and a.scope:p.error('No partial FINAL exports')
 report=inspect(manifest,root,a.final,a.scope)
 a.out.mkdir(parents=True,exist_ok=True)
 (a.out/'quality_report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 if a.command=='audit':print(json.dumps({k:v for k,v in report.items() if k!='items'},ensure_ascii=False,indent=2));return 2 if report['issues'] else 0
 if a.command=='draft-subs':
  voices=[]
  for scene,shot in entries(manifest):
   if a.scope and scene['id']!=a.scope:continue
   audio=shot.get('audio',{})
   if audio.get('mode')!='voice':continue
   voice=safe_path(root,audio.get('path'))
   if not voice or not voice.is_file() or sha(voice)!=audio.get('sha256'):raise ValueError('Voice WAV missing or hash mismatch')
   dest=a.out/(shot['id']+'.draft.srt')
   # Only drafts: the human-alignment approval flag is never set automatically.
   run([sys.executable,str(Path(__file__).with_name('draft_subtitles.py')),'--audio',voice,'--language',a.language,'--out',dest])
   voices.append(str(dest))
  print(json.dumps({'status':'DRAFT_SUBTITLES_NOT_APPROVED','files':voices},ensure_ascii=False));return 0
 items=[plan for scene,plan in entries(manifest) if not a.scope or scene['id']==a.scope]
 # QA rendering still requires physically verified sources, actual durations, and real audio.
 blocking={'UNTRUSTED_OR_REJECTED_SOURCE','SOURCE_NOT_ACQUIRED','SOURCE_SHA_MISMATCH','ACTUAL_DURATION_MISSING',
  'AUDIO_MODE_UNDECLARED','VOICE_WAV_MISSING','VOICE_SHA_MISMATCH','VOICE_CUTS_OFF_END','ARCHIVE_SOUND_LOCK_BROKEN',
  'NO_ARCHIVE_AUDIO','NO_ARCHIVE_VIDEO','SPOKEN_CANNOT_BE_SILENT','AUDIO_MODE_UNDECLARED','INVALID_MEDIA_TYPE'}
 relevant=[e for e in report['issues']+report['warnings'] if e.split(':')[-1].split(':')[0] in blocking]
 if a.final and report['issues'] or relevant:
  print(json.dumps({'status':'EXPORT_FINAL_REFUSED' if a.final else 'QA_RENDER_BLOCKED','blocking':relevant or report['issues']},ensure_ascii=False,indent=2));return 2
 # Make individual verified clips; deterministic content-hash cache across routes.
 clipdir=a.out/'segments';clipdir.mkdir(exist_ok=True)
 hits=0;start=time.monotonic();paths=[clipdir/f'{i:04}_{shot["id"]}.mp4' for i,shot in enumerate(items)]
 with ThreadPoolExecutor(max_workers=min(4,max(1,a.workers))) as pool:
  futures={pool.submit(make_clip,shot,root,paths[i],a.cache,'final' if a.final else 'qa'):i for i,shot in enumerate(items)}
  for fut in as_completed(futures):hits+=int(fut.result())
 dest=a.out/((manifest['route_id']+'_'+(a.scope or 'FULL'))+('_FINAL.mp4' if a.final else '_PRIVATE_QA.mp4'))
 concat_with_transitions(items,paths,dest)
 result={'status':'FINAL_RENDER_NEEDS_VISUAL_QA' if a.final else 'PRIVATE_QA_NOT_RELEASE',
    'route_id':manifest['route_id'],'scene':a.scope or 'all','video':str(dest),'clips':len(paths),
    'cache_hits':hits,'elapsed_seconds':round(time.monotonic()-start,2),'rights_checked':bool(a.final),
    'subtitle_alignment_human_checked':bool(a.final),'no_rejected_MP4_used':True}
 (a.out/'render_receipt.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
 print(json.dumps(result,ensure_ascii=False,indent=2));return 0
if __name__=='__main__':sys.exit(main())
