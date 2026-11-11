#!/usr/bin/env python3
# coding: utf-8
"""VELVET PASSPORT — MASTER GABARIT 65+ PARCOURS (source-first)

The same code is reused for every route/stop. It NEVER creates a final
video from missing, unapproved or rejected V6/V7 assets. Run with
  python velvet_gabarit_maitre.py audit --manifest STOP04_MANIFEST_SOURCE_FIRST.json --root ./sources
  python velvet_gabarit_maitre.py photo-qa --source original.jpg --output frame.jpg --mode spoken
  python velvet_gabarit_maitre.py archive-qa --source authentic.mp4 --output frame.jpg --at 3.0 --mode spoken

QA screenshots are evidence of geometry ONLY, never an approved movie.
Production assembly is refused until originals + lock + rights + real word timecodes are present.
"""
import argparse
import hashlib
import json
import math
import re
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

W, H = 1920, 1080
SUB_BAND = 220
IMAGE_WITH_CAPTIONS = H - SUB_BAND  # 860
BG = (8, 14, 26)
REJECTED_TOKENS = ('stop04_v6','stop04_v7','rejete_ne_pas_monter','_v6_qa','_v7_qa',
                   'assemblage_qa','source_qa','sous_titres_grands_v7')
FONT_CANDIDATES = [
 '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf',
 '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
]


def digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as stream:
        for b in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(b)
    return h.hexdigest()


def approved_source_name(name):
    n = str(name).lower().replace('\\', '/')
    return not any(t in n for t in REJECTED_TOKENS)


def photo_size(path):
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im)
        return im.width, im.height


def video_probe(path):
    command = ['ffprobe','-v','error','-show_entries',
               'stream=codec_type,width,height','-show_entries','format=duration',
               '-of','json',str(path)]
    p = subprocess.run(command,capture_output=True,text=True,check=True)
    return json.loads(p.stdout)


def fit_geometry(sw, sh, mode):
    if sw <= 0 or sh <= 0:
        raise ValueError('Source dimensions must be positive')
    if mode not in ('spoken','silent'):
        raise ValueError('mode must be spoken or silent')
    zone_height = IMAGE_WITH_CAPTIONS if mode == 'spoken' else H
    fraction = min(W / sw, zone_height / sh)
    dw = min(W, max(1, int(sw * fraction + 1e-8)))
    dh = min(zone_height, max(1, int(sh * fraction + 1e-8)))
    # Explains margins due to original aspect. No original pixel is removed.
    return {'src_width':sw,'src_height':sh,'dest_width':dw,'dest_height':dh,
            'x':(W-dw)//2,'y':(zone_height-dh)//2,'content_height':zone_height,
            'subtitle_band_height':H-zone_height,'mode':mode,
            'maximized':(dw>=W-1 or dh>=zone_height-1),
            'unavoidable_vertical_margin': bool(dh<zone_height-1 and dw>=W-1),
            'fit':'contain_no_crop','original_preserved_percent':100}


def _font(size):
    for f in FONT_CANDIDATES:
        if Path(f).is_file():
            return ImageFont.truetype(f,size)
    return ImageFont.load_default()


def make_photo_qa(src, dst, mode='spoken', label=None):
    # QA output is intentionally labelled; no fabricated narrative subtitles.
    if not approved_source_name(src):
        raise ValueError('Rejected QA/legacy visual file is prohibited')
    with Image.open(src) as opened:
        original = ImageOps.exif_transpose(opened).convert('RGB')
    g = fit_geometry(original.width,original.height,mode)
    result = Image.new('RGB',(W,H),BG)
    image = original.resize((g['dest_width'],g['dest_height']),Image.Resampling.LANCZOS)
    result.paste(image,(g['x'],g['y']))
    draw = ImageDraw.Draw(result)
    if mode == 'spoken':
        draw.line([(0,860),(W,860)],fill=(85,91,102),width=2)
        draw.text((W//2, H-110), 'APERÇU TECHNIQUE — SOUS-TITRES NON CALÉS',
                  fill=(217,218,224), font=_font(38), anchor='mm')
    # Small QA identifier is outside the historically protected image.
    if label:
        draw.text((W-18,18),f'QA · {label}',fill='white',font=_font(25),anchor='ra',
                  stroke_width=2,stroke_fill='black')
    dst = Path(dst); dst.parent.mkdir(parents=True,exist_ok=True)
    result.save(dst,quality=92,subsampling=0)
    return g


def _archive_frame(src, seconds):
    cmd = ['ffmpeg','-hide_banner','-nostdin','-loglevel','error',
           '-ss',str(seconds),'-i',str(src),'-frames:v','1','-f','image2pipe','-vcodec','mjpeg','pipe:1']
    p = subprocess.run(cmd,capture_output=True,check=True)
    import io
    with Image.open(io.BytesIO(p.stdout)) as image:
        return image.convert('RGB')


def make_archive_qa(src,dst,seconds,mode='spoken',label=None):
    if not approved_source_name(src):
        raise ValueError('Rejected QA/legacy video is forbidden')
    info = video_probe(src)
    streams = [s for s in info.get('streams',[]) if s.get('codec_type') == 'video']
    if not streams:
        raise ValueError('No video stream')
    source = _archive_frame(src,seconds)
    g = fit_geometry(source.width,source.height,mode)
    result = Image.new('RGB',(W,H),BG)
    result.paste(source.resize((g['dest_width'],g['dest_height']),Image.Resampling.LANCZOS),
                 (g['x'],g['y']))
    draw=ImageDraw.Draw(result)
    if mode == 'spoken':
        draw.line([(0,860),(W,860)],fill=(85,91,102),width=2)
        draw.text((W//2,H-110),'APERÇU TECHNIQUE — ARCHIVE À SOUS-TITRER',
                  fill=(215,215,222),font=_font(38),anchor='mm')
    if label:
        draw.text((W-18,18),f'QA · {label}',fill='white',font=_font(25),anchor='ra',
                  stroke_width=2,stroke_fill='black')
    dst=Path(dst);dst.parent.mkdir(parents=True,exist_ok=True)
    result.save(dst,quality=92,subsampling=0)
    return g


def ffmpeg_video_filter(mode='spoken', srt=None):
    """Can be used by all future FFmpeg route assemblers.
    No crop/cover; must preserve the original film's audio stream separately.
    Subtitle mode only supports real verified SRT, never estimates.
    """
    if mode == 'spoken' and not srt:
        raise ValueError('Refuse spoken FINAL without verified SRT')
    h = IMAGE_WITH_CAPTIONS if mode == 'spoken' else H
    # FFmpeg force_original_aspect_ratio=decrease, even scales for YUV420.
    result=(f'scale={W}:{h}:flags=lanczos:force_original_aspect_ratio=decrease:'
            f'force_divisible_by=2,pad={W}:{h}:(ow-iw)/2:(oh-ih)/2:color=0x080e1a')
    if mode == 'spoken':
        result += f',pad={W}:{H}:0:0:color=0x080e1a'
        # End-to-end caption timing should be certified before invoking.
        escaped = str(Path(srt).resolve()).replace('\\','\\\\').replace(':','\\:').replace("'", "\\'")
        result += (f",subtitles=filename='{escaped}':force_style="
                   "'FontName=Inter,FontSize=72,Bold=1,PrimaryColour=&H00FFFFFF,"
                   "Outline=0,Shadow=0,Alignment=2,MarginV=35'")
    return result


def subtitle_file_verified(path):
    if not path.is_file():
        return False
    text=path.read_text(encoding='utf-8-sig',errors='replace')
    # Timecodes must be explicit and ordered; this is structural checking,
    # not a substitute for listening to the actual soundtrack.
    cues=[]
    for line in text.splitlines():
        if '-->' not in line:continue
        try:
            left,right=[t.strip() for t in line.split('-->',1)]
            def to_seconds(t):
                parts=re.match(r'^(\d{2}):(\d{2}):(\d{2})[,\.](\d{3})$',t)
                if not parts:raise ValueError(t)
                h,m,s,ms=map(int,parts.groups())
                return h*3600+m*60+s+ms/1000
            a,b=to_seconds(left),to_seconds(right)
            cues.append((a,b))
        except Exception:
            return False
    return bool(cues) and all(b>a>=0 and (i==0 or a>=cues[i-1][1]-0.02)
                              for i,(a,b) in enumerate(cues))


def audit(manifest,root,for_distribution=False):
    src=json.loads(Path(manifest).read_text(encoding='utf-8'))
    root=Path(root)
    details=[]; blockers=[]; verified=[]
    scenes=src.get('scenes',[])
    if not isinstance(scenes,list) or not scenes:
        blockers.append('SCENES_MISSING')
    identities=set()
    for s in scenes:
        sid=s['scene_id']
        plans=s.get('plans',[])
        if sid=='S13' and s.get('deleted'):
            if plans: blockers.append('S13_DELETED_BUT_HAS_PLANS')
            details.append({'scene':sid,'status':'DELETED_LOCK'})
            continue
        if not plans:
            blockers.append(f'{sid}:NO_PLANS')
        scene_errors=[]
        for p in plans:
            pid=p.get('plan_id') or '?'
            if pid in identities: scene_errors.append(f'{pid}:DUPLICATE_PLAN_ID')
            identities.add(pid)
            rel=p.get('source_path')
            if not rel:
                scene_errors.append(f'{pid}:SOURCE_MISSING');continue
            if not approved_source_name(rel):
                scene_errors.append(f'{pid}:REJECTED_VISUAL_SOURCE');continue
            full=root/rel
            if not full.is_file():
                scene_errors.append(f'{pid}:NOT_ON_DISK');continue
            expected=p.get('source_sha256')
            actual=digest(full)
            if not expected or actual!=expected:
                scene_errors.append(f'{pid}:SOURCE_SHA256_NOT_VERIFIED');continue
            kind=p.get('kind','photo')
            if kind=='photo':
                try:
                    sw,sh=photo_size(full)
                    g=fit_geometry(sw,sh,p.get('mode','spoken'))
                    if not g['maximized']: scene_errors.append(f'{pid}:NOT_MAXIMIZED')
                except Exception as e:
                    scene_errors.append(f'{pid}:IMAGE_READ_ERROR:{e}')
            elif kind=='archive_film':
                try:
                    streams=video_probe(full)['streams']
                    if not any(x.get('codec_type')=='video' for x in streams):
                        scene_errors.append(f'{pid}:NO_VIDEO_STREAM')
                    if p.get('audio_mode')!='archive_original_only':
                        scene_errors.append(f'{pid}:ARCHIVE_ORIGINAL_AUDIO_REQUIRED')
                    if not any(x.get('codec_type')=='audio' for x in streams):
                        scene_errors.append(f'{pid}:NO_ARCHIVE_AUDIO')
                except Exception as e:
                    scene_errors.append(f'{pid}:FILM_PROBE_ERROR:{e}')
            else: scene_errors.append(f'{pid}:UNKNOWN_MEDIA_KIND')
            verified.append(pid)
            if p.get('mode')=='spoken':
                subs=p.get('verified_subtitle_file')
                if not subs or not subtitle_file_verified(root/subs):
                    scene_errors.append(f'{pid}:NO_VERIFIED_SUBTITLES')
                if not p.get('subtitle_audio_alignment_reviewed'):
                    scene_errors.append(f'{pid}:SUBTITLE_VOICE_ALIGNMENT_NOT_REVIEWED')
                if not p.get('real_audio_lock'):
                    scene_errors.append(f'{pid}:AUDIO_NOT_LOCKED')
                if kind=='photo':
                    audio=p.get('voice_wav_path')
                    if not audio or not (root/audio).is_file() or not p.get('voice_sha256') or digest(root/audio)!=p.get('voice_sha256'):
                        scene_errors.append(f'{pid}:VOICE_WAV_SHA_NOT_VERIFIED')
            if not p.get('timing_verified'):
                scene_errors.append(f'{pid}:TIMING_NOT_VERIFIED')
            if for_distribution and p.get('commercial_rights_verified') is not True:
                scene_errors.append(f'{pid}:RIGHTS_NOT_VERIFIED')
        details.append({'scene':sid,'plans':len(plans),'status':'READY' if not scene_errors else 'BLOCKED',
                        'blockers':scene_errors})
        blockers.extend(scene_errors)
    # For a route, any unverified plan means final cannot happen.
    output={'schema':'velvet-master-frame/v1','route':src.get('route_id'),
            'stop':src.get('stop_id'),'scene_count':len(scenes),
            'active_scene_count':len([s for s in scenes if not s.get('deleted')]),
            'source_sha_verified_plan_count':len(verified),
            'blocking_issue_count':len(blockers),
            'export_status':'REFUSED' if blockers else 'ELIGIBLE_FOR_FINAL_QA',
            'details':details,'issues':blockers,
            'note':'ELIGIBLE_FOR_FINAL_QA is not PASS_LOCK: listening and complete playback remain mandatory'}
    return output


def main():
    p=argparse.ArgumentParser(description=__doc__,formatter_class=argparse.RawDescriptionHelpFormatter)
    cmd=p.add_subparsers(dest='command',required=True)
    x=cmd.add_parser('audit');x.add_argument('--manifest',required=True);x.add_argument('--root',required=True)
    x.add_argument('--distribution',action='store_true');x.add_argument('--output',default=None)
    x=cmd.add_parser('photo-qa');x.add_argument('--source',required=True);x.add_argument('--output',required=True)
    x.add_argument('--mode',choices=['spoken','silent'],default='spoken');x.add_argument('--label')
    x=cmd.add_parser('archive-qa');x.add_argument('--source',required=True);x.add_argument('--output',required=True)
    x.add_argument('--at',type=float,default=0.0);x.add_argument('--mode',choices=['spoken','silent'],default='spoken');x.add_argument('--label')
    x=cmd.add_parser('filter');x.add_argument('--mode',choices=['spoken','silent'],required=True);x.add_argument('--srt')
    a=p.parse_args()
    if a.command=='audit':
        r=audit(a.manifest,a.root,a.distribution)
        out=json.dumps(r,ensure_ascii=False,indent=2)
        if a.output:Path(a.output).write_text(out,encoding='utf-8')
        print(out)
        sys.exit(2 if r['blocking_issue_count'] else 0)
    if a.command=='photo-qa':
        print(json.dumps(make_photo_qa(a.source,a.output,a.mode,a.label),ensure_ascii=False))
    if a.command=='archive-qa':
        print(json.dumps(make_archive_qa(a.source,a.output,a.at,a.mode,a.label),ensure_ascii=False))
    if a.command=='filter':print(ffmpeg_video_filter(a.mode,a.srt))

if __name__=='__main__':main()