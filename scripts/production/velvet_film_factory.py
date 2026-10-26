#!/usr/bin/env python3
"""Velvet Passport: reproducible source-checked sequence assembly.

PRIVATE previews may contain PENDING rights, but public releases fail closed.
This assembler does not select images, create narration, or grant rights.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import uuid
import xml.etree.ElementTree as ET


def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as handle:
        for part in iter(lambda: handle.read(1024*1024),b''):
            h.update(part)
    return h.hexdigest()


def probe(path):
    p=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_type,codec_name,width,height,r_frame_rate', '-of','json',str(path)],capture_output=True,text=True,check=True)
    return json.loads(p.stdout)


def add_property(parent,key,value):
    p=ET.SubElement(parent,'property',{'name':key});p.text=str(value)


def mlt_project(project, clips, audio_path, folder, frames, fps):
    """Generate an independently editable, portable MLT/Kdenlive XML timeline.

    Separate media chains allow real edits; assets live next to the project.
    Acceptance in the actual Kdenlive GUI must still be tested.
    """
    root=ET.Element('mlt',{'LC_NUMERIC':'C','version':'7.25.0','producer':'main_bin','root':'.'})
    ET.SubElement(root,'profile',{'description':'HD 1080p 25 fps','width':'1920','height':'1080','progressive':'1','sample_aspect_num':'1','sample_aspect_den':'1','display_aspect_num':'16','display_aspect_den':'9','frame_rate_num':str(fps),'frame_rate_den':'1','colorspace':'709'})
    black=ET.SubElement(root,'producer',{'id':'black','in':'0','out':str(frames-1)})
    for name,value in [('resource','black'),('mlt_service','color'),('kdenlive:playlistid','black_track'),('mlt_image_format','rgba')]:add_property(black,name,value)
    for i,item in enumerate(clips):
        chain=ET.SubElement(root,'chain',{'id':f'chain{i}','in':'0','out':str(item['frames']-1)})
        for name,value in [('resource',str(Path('media')/Path(item['file']).name)),('mlt_service','avformat'),('kdenlive:id',i+1),('kdenlive:clipname',item['title']),('kdenlive:clip_type','0'),('kdenlive:folderid','-1')]:add_property(chain,name,value)
    voice=ET.SubElement(root,'chain',{'id':'voice','in':'0','out':str(frames-1)})
    for name,value in [('resource',str(Path('media')/audio_path.name)),('mlt_service','avformat'),('kdenlive:id',1000),('kdenlive:clipname',f"VOICE {project['lang'].upper()} ORIGINAL"),('kdenlive:clip_type','1')]:add_property(voice,name,value)
    playlists=[ET.SubElement(root,'playlist',{'id':f'playlist{i}'}) for i in range(4)]
    for i,item in enumerate(clips):
        entry=ET.SubElement(playlists[0],'entry',{'producer':f'chain{i}','in':'0','out':str(item['frames']-1)})
        add_property(entry,'kdenlive:id',i+1)
    entry=ET.SubElement(playlists[2],'entry',{'producer':'voice','in':'0','out':str(frames-1)})
    add_property(entry,'kdenlive:id',1000)
    for trackid,mutes in ((0,'audio'),(1,'video')):
        tractor=ET.SubElement(root,'tractor',{'id':f'tractor{trackid}','in':'0','out':str(frames-1)})
        add_property(tractor,'kdenlive:audio_track',trackid)
        for i in range(2):ET.SubElement(tractor,'track',{'producer':f'playlist{trackid*2+i}','hide':mutes})
    sequence='{'+str(uuid.uuid5(uuid.NAMESPACE_URL,f"{project['route_id']}/{project['lang']}/{project['chapter']}"))+'}'
    t=ET.SubElement(root,'tractor',{'id':sequence,'in':'0','out':str(frames-1)})
    values={'kdenlive:uuid':sequence,'kdenlive:clipname':f"{project['route_id']} {project['chapter']} {project['lang']}", 'kdenlive:sequenceproperties.hasAudio':1,'kdenlive:sequenceproperties.hasVideo':1,'kdenlive:sequenceproperties.tracksCount':2,'kdenlive:sequenceproperties.activeTrack':0,'kdenlive:sequenceproperties.audioTarget':1,'kdenlive:duration':frames,'kdenlive:maxduration':frames,'kdenlive:id':5000,'kdenlive:clip_type':0,'kdenlive:producer_type':17}
    for k,v in values.items():add_property(t,k,v)
    for i in range(2):ET.SubElement(t,'track',{'producer':f'tractor{i}'})
    transition=ET.SubElement(t,'transition',{'id':'transition0','in':'0','out':str(frames-1)})
    for k,v in {'a_track':0,'b_track':1,'mlt_service':'mix','always_active':1,'sum':1}.items():add_property(transition,k,v)
    library=ET.SubElement(root,'playlist',{'id':'main_bin'})
    for k,v in {'kdenlive:docproperties.version':'1.1','kdenlive:docproperties.documentid':'2026102506','kdenlive:docproperties.audioChannels':2,'kdenlive:docproperties.profile':'atsc_1080p_25','kdenlive:docproperties.uuid':sequence,'kdenlive:docproperties.opensequences':sequence,'kdenlive:docproperties.activetimeline':sequence,'kdenlive:docproperties.kdenliveversion':'26.08.0','kdenlive:docproperties.compositing':1,'kdenlive:docproperties.enableproxy':0,'xml_retain':1}.items():add_property(library,k,v)
    for i,item in enumerate(clips):ET.SubElement(library,'entry',{'producer':f'chain{i}','in':'0','out':str(item['frames']-1)})
    ET.SubElement(library,'entry',{'producer':'voice','in':'0','out':str(frames-1)})
    ET.SubElement(library,'entry',{'producer':sequence,'in':'0','out':str(frames-1)})
    final=ET.SubElement(root,'tractor',{'id':'final_tractor','in':'0','out':str(frames-1)})
    add_property(final,'kdenlive:projectTractor',1)
    ET.SubElement(final,'track',{'producer':sequence,'in':'0','out':str(frames-1)})
    dest=folder/f"{project['route_id']}_{project['chapter']}_{project['lang']}.kdenlive"
    ET.indent(root)
    ET.ElementTree(root).write(dest,encoding='utf-8',xml_declaration=True)
    ET.parse(dest)  # XML validation, NOT GUI-open validation.
    return dest


def audit(project, base, public):
    errors=[];warn=[];shots=[];total=0
    fps=int(project.get('fps',0))
    if fps!=25:errors.append('CURRENT_FACTORY_PROFILE_IS_25FPS_ONLY')
    if project.get('lang') not in ('fr','en'):errors.append('INVALID_LANGUAGE')
    if project.get('route_id','').strip()=='' or project.get('chapter','').strip()=='':errors.append('MISSING_ROUTE_OR_CHAPTER')
    if not project.get('clips'):errors.append('NO_CLIPS')
    audio=(base/project.get('voice','MISSING_VOICE')).resolve()
    if not audio.is_relative_to(base.resolve()):errors.append('VOICE_PATH_ESCAPES_PACKAGE')
    if not audio.is_file():errors.append(f'MISSING_VOICE: {audio}')
    else:
        if digest(audio)!=project.get('voice_sha256'):errors.append('VOICE_SHA256_MISMATCH')
        try:
            info=probe(audio)
            dur=float(info['format']['duration'])
            if abs(dur-float(project.get('voice_seconds',0)))>0.03:errors.append(f'VOICE_DURATION_MISMATCH {dur}')
        except (subprocess.CalledProcessError,ValueError,KeyError) as exc:errors.append('VOICE_UNREADABLE: '+str(exc))
    for i,shot in enumerate(project.get('clips',[])):
        name=shot.get('file','');p=(base/name).resolve()
        if not p.is_relative_to(base.resolve()):errors.append(f'SHOT_{i+1}_MEDIA_PATH_ESCAPES_PACKAGE')
        frames=shot.get('frames',0)
        if not isinstance(frames,int) or frames<1:errors.append(f'SHOT_{i+1}_INVALID_FRAMES')
        else:total+=frames
        if not shot.get('asset_id'):errors.append(f'SHOT_{i+1}_MISSING_ASSET_ID')
        if not str(shot.get('source_url','')).startswith('https://'):errors.append(f'SHOT_{i+1}_MISSING_PROVENANCE')
        if public and not shot.get('provenance_verified'):errors.append(f'SHOT_{i+1}_SOURCE_NOT_AUTHENTICATED')
        if not shot.get('cue_text'):errors.append(f'SHOT_{i+1}_MISSING_NARRATIVE_CUE')
        if not p.is_file():errors.append(f'SHOT_{i+1}_MISSING_SOURCE {name}')
        else:
            if digest(p)!=shot.get('sha256'):errors.append(f'SHOT_{i+1}_SHA256_MISMATCH')
            try:
                meta=probe(p)
                vs=[s for s in meta['streams'] if s['codec_type']=='video']
                if len(vs)!=1 or vs[0].get('width')!=1920 or vs[0].get('height')!=1080 or vs[0].get('r_frame_rate')!='25/1':errors.append(f'SHOT_{i+1}_PROFILE_MISMATCH')
                dur=float(meta['format']['duration'])
                if abs(dur-(frames/25.0))>0.045:errors.append(f'SHOT_{i+1}_DURATION_MISMATCH {dur:.3f}')
            except (subprocess.CalledProcessError,ValueError,KeyError) as exc:errors.append(f'SHOT_{i+1}_UNREADABLE {exc}')
        if shot.get('rights')!='cleared':
            (errors if public else warn).append(f'SHOT_{i+1}_RIGHTS_NOT_CLEARED')
        if shot.get('narrative_sync')!='approved':
            (errors if public else warn).append(f'SHOT_{i+1}_SYNC_NOT_APPROVED')
        if shot.get('mastodon_receipt') in (None,''):
            (errors if public else warn).append(f'SHOT_{i+1}_MASTODON_NOT_VERIFIED')
        shots.append({'id':shot.get('asset_id'),'from_seconds':round((total-frames)/fps,3) if fps else None,'to_seconds':round(total/fps,3) if fps else None,'frames':frames,'rights':shot.get('rights'),'sync':shot.get('narrative_sync')})
    if fps and abs(total/fps-float(project.get('voice_seconds',0)))>.05:errors.append(f'AUDIO_VIDEO_DURATION_GAP: {total/fps:.3f} vs {project.get("voice_seconds")}')
    if public:
        if not project.get('all_chapters_covered'):errors.append('NOT_ALL_CHAPTERS_COVERED')
        if not project.get('publisher_release_approved'):errors.append('NO_PUBLISHER_RELEASE')
        if not project.get('now_pass_qa_approved'):errors.append('NO_NOW_APP_QA')
    return {'route':project.get('route_id'),'chapter':project.get('chapter'),'language':project.get('lang'),'intent':'PUBLIC_RELEASE' if public else 'PRIVATE_REVIEW','duration_seconds':round(total/fps,3) if fps else None,'shot_count':len(shots),'shots':shots,'errors':errors,'warnings':warn,'ready':not errors,'commercial_release_ready':public and not errors}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('manifest',type=Path)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--public',action='store_true',help='Require release-level identity, rights, synchs, Mastodon and NOW QA')
    parser.add_argument('--render',action='store_true',help='Render source-checked sequence to private review MP4')
    args=parser.parse_args()
    project=json.loads(args.manifest.read_text(encoding='utf8'))
    base=args.manifest.resolve().parent
    folder=args.output.resolve();folder.mkdir(parents=True,exist_ok=True)
    report=audit(project,base,args.public)
    (folder/'QA_REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'ready':report['ready'],'shots':report['shot_count'],'duration':report['duration_seconds'],'errors':report['errors'],'warnings':len(report['warnings'])},ensure_ascii=False))
    if report['errors']:
        print('STOP: source/rights/timing gate failed; no render or release',file=sys.stderr)
        return 2
    clips=project['clips'];audio=base/project['voice']
    # Assemble paths relative to project folder for portability.
    md=folder/'media';md.mkdir(exist_ok=True)
    import shutil
    for file in [audio]+[base/c['file'] for c in clips]:
        dst=md/file.name
        if not dst.exists() or digest(dst)!=digest(file):shutil.copy2(file,dst)
    mlt=mlt_project(project,clips,audio,folder,sum(c['frames'] for c in clips),25)
    report['kdenlive_project']=mlt.name
    if args.render:
        playlist=folder/'concat.ffconcat'
        # FFmpeg concat demuxer for codec-compatible prepared scenes.
        playlist.write_text('ffconcat version 1.0\n'+''.join("file '"+str((md/Path(c['file']).name).resolve()).replace("'","'\\''")+"'\n" for c in clips),encoding='utf8')
        mp4=folder/(f"{project['route_id']}_{project['chapter']}_{project['lang']}_PRIVATE_WORKPRINT.mp4")
        cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-safe','0','-f','concat','-i',str(playlist),'-i',str(md/audio.name),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','160k','-ar','48000','-t',str(round(sum(c['frames'] for c in clips)/25,3)),'-movflags','+faststart',str(mp4)]
        subprocess.run(cmd,check=True)
        v=probe(mp4);n=float(v['format']['duration'])
        if abs(n-report['duration_seconds'])>.08:raise RuntimeError('RENDER_DURATION_MISMATCH')
        report['workprint_mp4']=mp4.name
        report['workprint_sha256']=digest(mp4)
        # Decode-to-null QA: do not confuse with artistic signoff.
        subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(mp4),'-f','null','-'],check=True)
        report['decoded_ok']=True
    (folder/'QA_REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    return 0

if __name__=='__main__':sys.exit(main())