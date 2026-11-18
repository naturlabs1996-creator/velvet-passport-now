#!/usr/bin/env python3
"""One-pass single original-photo/WAV source timeline per scene; NEVER reads rendered MP4 segments.
Only a narrow QA of voice-to-photo cut timing: no publication or approval inference.
"""
import sys,json,hashlib,subprocess,argparse
from pathlib import Path
P=argparse.ArgumentParser();P.add_argument('--scene',required=True);P.add_argument('--out',required=True);P.add_argument('--root',required=True,type=Path);P.add_argument('--word-cues',required=True,type=Path);args=P.parse_args()
ROOT=args.root.resolve()
EDL=args.word_cues.resolve()
data=json.loads(EDL.read_text());q=data['scenes'][args.scene];wav=ROOT/q['voice_source'];photos=q['plan_cues'];
assert photos and q['all_cues_recognized'] and not data['final_approved']
assert wav.suffix=='.wav' and hashlib.sha256(wav.read_bytes()).hexdigest()==q['voice_sha256']
cmd=['ffmpeg','-hide_banner','-loglevel','error','-y'];fc=[];labels=[]
for n,p in enumerate(photos):
 src=ROOT/p['source'];assert src.suffix.lower() in ('.jpg','.jpeg','.png','.webp') and src.is_file()
 assert hashlib.sha256(src.read_bytes()).hexdigest()==p['source_sha256']
 dur=p['duration_sec'];assert dur>0.2
 cmd+=['-loop','1','-framerate','25','-t',str(dur),'-i',str(src)]
 box=p['full_bleed_crop_after_trim'];trim=p['trim_scan_border']
 vf=f'[{n}:v]'
 if trim:
  vf+=f"crop={trim[2]-trim[0]}:{trim[3]-trim[1]}:{trim[0]}:{trim[1]},"
 vf+=f'crop={box[2]-box[0]}:{box[3]-box[1]}:{box[0]}:{box[1]},format=gray,scale=1920:1080:flags=lanczos,format=yuv420p,setsar=1,trim=duration={dur},setpts=PTS-STARTPTS[v{n}]'
 fc.append(vf);labels.append(f'[v{n}]')
cmd+=['-i',str(wav)]
if len(labels)>1:fc.append(''.join(labels)+f'concat=n={len(labels)}:v=1:a=0[vout]')
else:fc.append(labels[0]+'null[vout]')
input_audio=len(photos)
fc.append(f'[{input_audio}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration={q["voice_duration_sec"]},asetpts=PTS-STARTPTS[aout]')
out=Path(args.out);out.parent.mkdir(parents=True,exist_ok=True)
cmd+=['-filter_complex',';'.join(fc),'-map','[vout]','-map','[aout]','-r','25','-c:v','libx264','-preset','veryfast','-crf','24','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-t',str(q['voice_duration_sec']),'-movflags','+faststart',str(out)]
print('REAL_SOURCE_INPUTS',len(photos),'PHOTO_INPUTS','1_RAW_WAV','NO_EXISTING_MP4_INPUTS','RUNNING',args.scene,flush=True)
subprocess.run(cmd,check=True)
r=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(out)])); actual=float(r['format']['duration']);assert abs(actual-q['voice_duration_sec'])<=.08,(actual,q['voice_duration_sec'])
print(json.dumps({'scene':args.scene,'status':'PRIVATE_QA_WORD_CUES_NOT_HUMAN_APPROVED','duration':actual,'source_count':len(photos),'cut_seconds':[p['at_sec'] for p in photos[1:]],'out':str(out)},ensure_ascii=False))