#!/usr/bin/env python3
"""Velvet Passport NOW — source-first rendering factory.

Production safety: never promotes a QA frame to a complete synchronized film.
This single engine works for any route/stop, not just Paris 05.
Dependencies: Python 3.10+, Pillow, ffmpeg/ffprobe (for film frames).

Commands:
  audit           validate source hashes, approved timing, speech/captions, rights
  preview-batch   build cached QA layout frames, in parallel, with register
  render-plan     render ONE approved plan; requires complete audio/timing/rights
  render-route    render a fully-approved route; hard-stop on any missing element
"""
from __future__ import annotations
import argparse
import concurrent.futures
import csv
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

WIDTH = 1920
HEIGHT = 1080
SUBTITLE_BAND = 220
IMAGE_WITH_CAPTIONS = HEIGHT - SUBTITLE_BAND
BG = (8, 14, 26)
FORBIDDEN_VISUALS = ('rejet', 'rejected', 'old_qa', 'v6_qa', 'v7_qa', 'base_qa', 'assemblage_qa')


def sha256_file(path: Path) -> str:
    d = hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda: f.read(1024*1024), b''):
            d.update(b)
    return d.hexdigest()


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def read_manifest(path: Path) -> dict:
    d = json.loads(path.read_text(encoding='utf-8'))
    if 'route_id' not in d or 'scenes' not in d:
        raise ValueError('route_id et scenes requis')
    return d


def all_plans(manifest: dict):
    for scene in manifest['scenes']:
        if scene.get('deleted', False):
            continue
        for plan in scene.get('plans', []):
            yield scene, plan


def safe_asset(root: Path, value: str) -> Path:
    if not value or not isinstance(value, str):
        raise ValueError('Chemin source absent')
    p = (root / value).resolve()
    if not p.is_relative_to(root.resolve()):
        raise ValueError('Chemin sortant du dossier sources')
    return p


def audio_probe(p: Path):
    result = subprocess.run(['ffprobe','-v','error','-show_entries','format=duration',
                             '-of','default=noprint_wrappers=1:nokey=1',str(p)],
                            capture_output=True, text=True, timeout=30)
    if result.returncode: raise RuntimeError(result.stderr[:300])
    return float(result.stdout.strip())


def plan_problems(scene: dict, p: dict, root: Path, *, final: bool) -> list[str]:
    issues = []
    pid = p.get('id', '?')
    for f in ('id', 'kind', 'source', 'sha256'):
        if not p.get(f): issues.append(f'{pid}: {f} manquant')
    kind = p.get('kind')
    if kind not in ('photo', 'film'): issues.append(f'{pid}: kind inconnu')
    source = p.get('source')
    if source:
        try:
            f = safe_asset(root, source)
            if any(s in f.name.lower() for s in FORBIDDEN_VISUALS):
                issues.append(f'{pid}: source QA rejetée interdite')
            if not f.is_file(): issues.append(f'{pid}: fichier source absent')
            elif p.get('sha256') and sha256_file(f) != p['sha256']:
                issues.append(f'{pid}: SHA256 de la source incorrect')
        except (ValueError, OSError) as ex: issues.append(f'{pid}: {ex}')
    if not final:
        return issues
    if scene.get('editorial_lock') is not True: issues.append(f'{pid}: scène non LOCK')
    if p.get('media_lock') is not True: issues.append(f'{pid}: source média non LOCK')
    if p.get('commercial_rights') != 'cleared': issues.append(f'{pid}: droits non validés')
    duration = p.get('duration_seconds')
    if not isinstance(duration, (float,int)) or duration <= 0:
        issues.append(f'{pid}: durée réelle non validée')
    if p.get('timecodes_verified') is not True:
        issues.append(f'{pid}: placement de scène non synchronisé sur audio réel')
    speech = p.get('speech')
    if speech not in (True, False): issues.append(f'{pid}: speech non confirmé')
    if speech is True:
        if p.get('caption_lock') is not True or not p.get('captions'):
            issues.append(f'{pid}: sous-titres de paroles absents ou non verrouillés')
        if p.get('audio_lock') is not True:
            issues.append(f'{pid}: audio non verrouillé')
    # No forbidden empty band: spoken plans require captions; silent plans fill full frame.
    if p.get('kind') == 'photo' and speech is True and not p.get('audio'):
        issues.append(f'{pid}: narration audible sans fichier audio source')
    if p.get('captions'):
        try:
            cap=safe_asset(root,p['captions'])
            if not cap.is_file(): issues.append(f'{pid}: fichier sous-titre absent')
            elif cap.suffix.lower() != '.ass': issues.append(f'{pid}: format ASS requis pour bande distincte')
            elif 'Dialogue:' not in cap.read_text(encoding='utf-8-sig'):
                issues.append(f'{pid}: fichier ASS sans sous-titres réels')
        except (OSError,ValueError) as ex: issues.append(f'{pid}: {ex}')
    if p.get('kind') == 'photo' and p.get('audio'):
        try:
            f=safe_asset(root,p['audio'])
            if not f.is_file(): issues.append(f'{pid}: fichier audio absent')
            elif p.get('audio_sha256') and sha256_file(f)!=p['audio_sha256']:
                issues.append(f'{pid}: SHA256 audio incorrect')
            if p.get('audio_sha256') is None: issues.append(f'{pid}: empreinte audio non fournie')
        except ValueError as ex: issues.append(f'{pid}: {ex}')
    if p.get('kind') == 'film':
        if p.get('sound_mode')!='archive_original_only':
            issues.append(f'{pid}: film doit conserver sa bande sonore originale (ou mix distinct approuvé)')
        ss=p.get('source_start_seconds'); ee=p.get('source_end_seconds')
        if not isinstance(ss,(int,float)) or not isinstance(ee,(int,float)) or ee<=ss:
            issues.append(f'{pid}: bornes du film source absentes')
        elif isinstance(duration,(int,float)) and abs((ee-ss)-duration)>0.05:
            issues.append(f'{pid}: durée film != source_end-source_start')
    if p.get('transition_out',{'type':'cut'}).get('type') not in ('cut','fade'):
        issues.append(f'{pid}: transition inconnue')
    if p.get('transition_out',{'type':'cut'}).get('type') == 'fade':
        if not p['transition_out'].get('approved') or p['transition_out'].get('duration_seconds',0)<=0:
            issues.append(f'{pid}: fondu non verrouillé')
    return issues


def validate(manifest: dict, root: Path, final: bool):
    issues=[]; seen_scene=set(); seen_ids=set(); used_images={}
    for s in manifest['scenes']:
        sid=s.get('id','?')
        if sid in seen_scene: issues.append(f'doublon scene {sid}')
        seen_scene.add(sid)
        if s.get('deleted'):
            if s.get('plans'): issues.append(f'{sid}: supprimée mais possède des plans')
            continue
        if not s.get('plans'): issues.append(f'{sid}: aucun plan défini')
        for p in s.get('plans',[]):
            pid=p.get('id','?')
            if pid in seen_ids: issues.append(f'doublon plan {pid}')
            seen_ids.add(pid)
            issues.extend(plan_problems(s,p,root,final=final))
            if p.get('kind')=='photo' and p.get('sha256'):
                sha=p['sha256']; prior=used_images.get(sha)
                if prior and not p.get('reuse_explicitly_approved'):
                    issues.append(f'{pid}: photo répétée depuis {prior} sans autorisation')
                used_images[sha]=pid
    if final:
        if manifest.get('production_approved') is not True:
            issues.append('MANIFEST: production_approved manquant — export final interdit')
        if manifest.get('subtitles_synced') is not True:
            issues.append('MANIFEST: sous-titrage global non vérifié')
        if manifest.get('human_qa_complete') is not True:
            issues.append('MANIFEST: QA audio/visuelle finale non validée')
    return sorted(set(issues))


def report(manifest, root, final, out):
    errs=validate(manifest,root,final)
    plans=list(all_plans(manifest))
    result={'route_id':manifest['route_id'],'date_utc':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
            'mode':'FINAL' if final else 'SOURCES', 'pass':not errs,'scenes_declared':len(manifest['scenes']),
            'scenes_deleted':sum(bool(s.get('deleted')) for s in manifest['scenes']),
            'plans':len(plans),'problems':errs,
            'export_status':'PASS_LOCK_ELIGIBLE' if final and not errs else 'EXPORT_FINAL_REFUSED'}
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f"{manifest['route_id']}: {result['plans']} plans, {len(errs)} problèmes, {result['export_status']}")
    for e in errs[:30]: print('  -',e)
    return result


def extract_preview(movie: Path, offset: float):
    cmd=['ffmpeg','-hide_banner','-loglevel','error','-ss',str(max(0,offset)),'-i',str(movie),
         '-frames:v','1','-f','image2pipe','-vcodec','png','pipe:1']
    x=subprocess.run(cmd,capture_output=True,timeout=70)
    if x.returncode or not x.stdout:
        raise RuntimeError((x.stderr or b'')[-500:].decode(errors='replace'))
    return x.stdout


def frame_geometry(image, captioned: bool):
    from PIL import Image, ImageOps
    src=ImageOps.exif_transpose(image).convert('RGB')
    zone_h=IMAGE_WITH_CAPTIONS if captioned else HEIGHT
    w,h=src.size
    scale=min(WIDTH/w,zone_h/h)
    nw,nh=round(w*scale),round(h*scale)
    if nw > WIDTH or nh>zone_h: raise RuntimeError('Erreur de géométrie')
    pic=src.resize((nw,nh),Image.Resampling.LANCZOS)
    base=Image.new('RGB',(WIDTH,HEIGHT),BG)
    x=(WIDTH-nw)//2
    y=(zone_h-nh)//2
    base.paste(pic,(x,y))
    return base,{'source_dimensions': [w,h], 'display_dimensions':[nw,nh], 'image_zone_height':zone_h,
                 'top_internal_margin':y,'bottom_internal_margin':zone_h-y-nh,
                 'side_margin':x,'caption_band_px':HEIGHT-zone_h,
                 'original_visible_percent':100,'crop_applied':False}


def render_preview_one(s,p,root,output,cache_dir):
    from PIL import Image
    f=safe_asset(root,p['source'])
    sha=sha256_file(f)
    captioned = p.get('speech') is not False  # conservative: unknown = reserve band for QA
    key=sha256_bytes(f'{sha}:{captioned}:{WIDTH}:{HEIGHT}:{SUBTITLE_BAND}:v1'.encode())
    cached=cache_dir/(key+'.jpg')
    if cached.exists():
        rec=json.loads((cache_dir/(key+'.json')).read_text())
        rec.update({'scene_id':s['id'],'plan_id':p['id'],'cached':True})
    else:
        if p.get('kind')=='film':
            b=extract_preview(f,float(p.get('source_start_seconds',0))+0.5)
            img=Image.open(io.BytesIO(b))
        else: img=Image.open(f)
        frame, geom=frame_geometry(img,captioned)
        tmp=cached.with_suffix('.tmp.jpg')
        frame.save(tmp, quality=86, subsampling=0)
        os.replace(tmp,cached)
        rec={'source_sha256':sha,'source':p['source'],'scene_id':s['id'],'plan_id':p['id'],
             'kind':p['kind'],'captioned_preview':captioned,**geom, 'cached':False}
        (cache_dir/(key+'.json')).write_text(json.dumps(rec,ensure_ascii=False,indent=2))
    dest=output/f"{p['id']}.jpg"
    if dest.exists(): dest.unlink()
    try: os.link(cached,dest)
    except OSError: shutil.copy2(cached,dest)
    rec['preview_file']=dest.name
    return rec


def preview_batch(manifest,root,out,workers,shared_cache=None):
    out.mkdir(parents=True,exist_ok=True)
    cache=shared_cache if shared_cache else out/'_cache';cache.mkdir(parents=True,exist_ok=True)
    records=[]; errors=[]
    plans=[]
    for scene,plan in all_plans(manifest):
        if not plan.get('source'):
            continue
        try:
            if safe_asset(root,plan['source']).is_file(): plans.append((scene,plan))
        except ValueError as ex:
            errors.append(f"{plan.get('id','?')}: {ex}")
    start=time.monotonic()
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        jobs={pool.submit(render_preview_one,s,p,root,out,cache):(s['id'],p.get('id')) for s,p in plans}
        for job in concurrent.futures.as_completed(jobs):
            try: records.append(job.result())
            except Exception as e: errors.append(f"{jobs[job]}: {e}")
    records.sort(key=lambda r:r['plan_id'])
    with (out/'registre_photos_films.csv').open('w',encoding='utf-8',newline='') as f:
        fields=['scene_id','plan_id','source','source_sha256','kind','captioned_preview','cached','source_dimensions','display_dimensions', 'image_zone_height','caption_band_px','top_internal_margin','bottom_internal_margin','side_margin','crop_applied','original_visible_percent','preview_file']
        w=csv.DictWriter(f,fields,extrasaction='ignore'); w.writeheader()
        for r in records: w.writerow({k:json.dumps(v) if isinstance(v,(list,dict)) else v for k,v in r.items()})
    stats={'number_rendered':len(records),'reused_cached':sum(r['cached'] for r in records),
           'errors':errors,'wall_seconds':round(time.monotonic()-start,3),'workers':workers,
           'status':'QA_PREVIEWS_ONLY_NOT_FINAL'}
    (out/'stats.json').write_text(json.dumps(stats,indent=2,ensure_ascii=False))
    print('Prévisualisations:',json.dumps(stats,ensure_ascii=False))
    return stats


def ffmpeg_filter(with_caption: bool):
    h=IMAGE_WITH_CAPTIONS if with_caption else HEIGHT
    # No crop; any bars are computed as needed from original aspect ratio.
    return (f'scale={WIDTH}:{h}:force_original_aspect_ratio=decrease:flags=lanczos,'
            f'pad={WIDTH}:{h}:(ow-iw)/2:(oh-ih)/2:color=0x080e1a,'
            f'pad={WIDTH}:{HEIGHT}:0:0:color=0x080e1a,setsar=1,fps=25,format=yuv420p')


def encode_plan(scene,p,root,outdir):
    outdir.mkdir(parents=True,exist_ok=True)
    dest=outdir/(p['id']+'.mp4')
    if p['kind']=='photo':
        cmd=['ffmpeg','-y','-hide_banner','-loglevel','error','-loop','1','-framerate','25',
             '-i',str(safe_asset(root,p['source']))]
        if p.get('audio'):
            cmd.extend(['-i',str(safe_asset(root,p['audio']))])
        else:
            cmd.extend(['-f','lavfi','-i','anullsrc=r=48000:cl=stereo'])
        vf=ffmpeg_filter(p['speech'] is True)
        if p['speech'] is True:
            if not p.get('captions'): raise ValueError('Sous-titres requis')
            ass=safe_asset(root,p['captions']); vf+=f",ass=filename='{str(ass).replace(':', r'\:')}'"
        cmd.extend(['-vf',vf,'-map','0:v:0','-map','1:a:0',
                    '-t',str(p['duration_seconds']),'-c:v','libx264','-preset','veryfast',
                    '-crf','20','-r','25','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k',
                    '-ar','48000','-ac','2','-shortest','-movflags','+faststart',str(dest)])
    else:
        vf=ffmpeg_filter(p['speech'] is True)
        if p['speech'] is True:
            ass=safe_asset(root,p['captions']); vf+=f",ass=filename='{str(ass).replace(':', r'\\:')}'"
        cmd=['ffmpeg','-y','-hide_banner','-loglevel','error','-ss',str(p['source_start_seconds']),
             '-i',str(safe_asset(root,p['source'])),'-t',str(p['duration_seconds']),'-vf',vf,
             '-map','0:v:0','-map','0:a:0','-c:v','libx264','-preset','veryfast','-crf','20',
             '-r','25','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-ar','48000','-ac','2',
             '-movflags','+faststart',str(dest)]
    result=subprocess.run(cmd,capture_output=True,text=True,timeout=600)
    if result.returncode: raise RuntimeError(f"ffmpeg {p['id']} fail: {result.stderr[-800:]}")
    return dest


def stitch_segments(segments, plans, out):
    """Compose cut + approved audio/video crossfades; never guesses transitions."""
    if len(segments)==1:
        shutil.copy2(segments[0],out)
        return out
    cmd=['ffmpeg','-y','-hide_banner','-loglevel','error','-filter_complex_threads','1']
    for path in segments:cmd+=['-i',str(path)]
    chains=[]
    for i in range(len(segments)):
        chains.extend([f'[{i}:v]settb=1/25,setpts=N,fps=25,format=yuv444p[v{i}]',
                       f'[{i}:a]aresample=48000,asetpts=PTS-STARTPTS[a{i}]'])
    v='v0';a='a0';length=float(plans[0]['duration_seconds'])
    for i in range(1,len(segments)):
        tr=plans[i-1].get('transition_out',{'type':'cut'})
        new_v=f'vm{i}';new_a=f'am{i}'
        if tr.get('type')=='fade':
            dur=float(tr['duration_seconds'])
            if dur>=min(float(plans[i-1]['duration_seconds']),float(plans[i]['duration_seconds'])):
                raise RuntimeError('Fondu plus long que le plan, rejeté')
            offset=length-dur
            chains.append(f'[{v}][v{i}]xfade=transition=fade:duration={dur:.6f}:offset={offset:.6f}[{new_v}]')
            chains.append(f'[{a}][a{i}]acrossfade=d={dur:.6f}:c1=tri:c2=tri[{new_a}]')
        else:
            dur=0.0
            chains.append(f'[{v}][v{i}]concat=n=2:v=1:a=0[{new_v}]')
            chains.append(f'[{a}][a{i}]concat=n=2:v=0:a=1[{new_a}]')
        v=new_v;a=new_a
        length+=float(plans[i]['duration_seconds'])-dur
    cmd+=['-filter_complex',';'.join(chains),'-map',f'[{v}]','-map',f'[{a}]',
          '-c:v','libx264','-preset','veryfast','-crf','20','-r','25',
          '-pix_fmt','yuv420p','-c:a','aac','-b:a','160k',
          '-ar','48000','-ac','2','-movflags','+faststart',str(out)]
    x=subprocess.run(cmd,capture_output=True,text=True,timeout=1800)
    if x.returncode: raise RuntimeError('ffmpeg stitch failed: '+x.stderr[-900:])
    actual=audio_probe(out)
    if abs(actual-length)>0.15:
        raise RuntimeError(f'Durée incohérente: attendue {length:.3f}s, obtenu {actual:.3f}s')
    return out


def assert_final_then_render(manifest,root,outdir,route=False,workers=2,plan_id=None):
    plans=list(all_plans(manifest))
    if not route:
        found=[(scene,plan) for scene,plan in plans if plan['id']==plan_id]
        if len(found)!=1: raise RuntimeError('--plan-id requis et doit correspondre à un plan unique')
        scene,plan=found[0]
        issues=plan_problems(scene,plan,root,final=True)
        if issues: raise RuntimeError('EXPORT_PLAN_REFUSED: '+json.dumps(issues,ensure_ascii=False))
        return encode_plan(scene,plan,root,outdir)
    issues=validate(manifest,root,final=True)
    if issues:
        raise RuntimeError('EXPORT_FINAL_REFUSED: '+json.dumps(issues[:20],ensure_ascii=False))
    outdir.mkdir(parents=True,exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures=[pool.submit(encode_plan,s,p,root,outdir/'segments') for s,p in plans]
        segments=[job.result() for job in futures]
    output=outdir/(re.sub(r'[^a-zA-Z0-9_-]','-',manifest['route_id'])+'.mp4')
    # All connectors are read from the approved preceding plan in manifest.
    return stitch_segments(segments,[p for _,p in plans],output)


def batch_manifests(manifest_dir,root,out,workers):
    paths=sorted(manifest_dir.glob('*.json'))
    if not paths: raise RuntimeError('Aucun manifeste JSON à traiter')
    shared=out/'cache_commun_SHA256'
    total=0; reused=0; errors=[]; start=time.monotonic()
    for path in paths:
        manifest=read_manifest(path)
        local=out/re.sub(r'[^A-Za-z0-9_-]','-',manifest['route_id'])
        report(manifest,root,True,local/'audit.json')
        st=preview_batch(manifest,root,local,workers,shared_cache=shared)
        total+=st['number_rendered']; reused+=st['reused_cached']
        errors.extend(st['errors'])
    summary={'routes':len(paths),'plans_previsualises':total,'reprises_du_cache':reused,
             'seconds':round(time.monotonic()-start,3),'errors':errors,'mode':'QA_ONLY'}
    out.mkdir(parents=True,exist_ok=True)
    (out/'RAPPORT_GLOBAL.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False),encoding='utf-8')
    print('LOT MULTI-PARCOURS:',json.dumps(summary,ensure_ascii=False))
    return summary

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('command',choices=['audit','preview-batch','batch-previews','render-plan','render-route'])
    ap.add_argument('--manifest',type=Path)
    ap.add_argument('--manifest-dir',type=Path)
    ap.add_argument('--plan-id',help='plan approuvé à rendre isolément (commande render-plan)')
    ap.add_argument('--root',required=True,type=Path)
    ap.add_argument('--output',default='./out',type=Path)
    ap.add_argument('--workers',type=int,default=3)
    a=ap.parse_args()
    if a.command=='batch-previews':
        if not a.manifest_dir: ap.error('--manifest-dir nécessaire')
        res=batch_manifests(a.manifest_dir,a.root,a.output,a.workers)
        return 0 if not res['errors'] else 3
    if a.manifest is None: ap.error('--manifest nécessaire')
    d=read_manifest(a.manifest)
    if a.command=='audit':
        res=report(d,a.root,True,a.output/'audit.json')
        return 0 if res['pass'] else 2
    if a.command=='preview-batch':
        report(d,a.root,False,a.output/'audit_sources.json')
        stats=preview_batch(d,a.root,a.output,a.workers)
        return 0 if not stats['errors'] else 3
    if a.command.startswith('render'):
        try:
            result=assert_final_then_render(d,a.root,a.output,route=(a.command=='render-route'),workers=a.workers,plan_id=a.plan_id)
            print('OUTPUT',result)
            return 0
        except Exception as e:
            print(str(e),file=sys.stderr)
            return 2
    return 2

if __name__=='__main__': sys.exit(main())