#!/usr/bin/env python3
"""Velvet Passport: reproducible PRIVATE audiovisual assembly from a checked media package.

Single-command reproducible assembly of timeline packages. Uses source media exactly,
verifies hashes before use, checks real audiovisual duration, preserves Kdenlive
project, rejects missing/mismatched media and never authorizes public release.
No image generation, no license guessing, no Mastodon ingest claims.

Usage:
 python velvet_factory.py /path/EDITABLE_PACKAGE.zip --output /path/output
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

DEFAULT_SPEC = {
    'route_id': 'VP-PAR-05', 'chapter_id': 'STOP-01', 'language': 'fr',
    'clips': ['media/first.mp4', 'media/scene-1.mp4', 'media/scene-2.mp4',
              'media/scene-3.mp4', 'media/scene-4.mp4'],
    'voice': 'media/PARIS05_FR_3MIN16_VOIX_ORIGINALE.wav'
}
EXPECTED_FPS = 25.0
FRAME_SEC = 1 / EXPECTED_FPS


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def command(args: list[str], capture=True):
    cp = subprocess.run(args, text=True, stdout=subprocess.PIPE if capture else None,
                        stderr=subprocess.PIPE if capture else None, check=False)
    if cp.returncode:
        raise RuntimeError(f"Command failed: {args[0]} ({cp.returncode}): {(cp.stderr or '')[-1000:]}")
    return cp.stdout


def probe(path: Path) -> dict:
    return json.loads(command(['ffprobe', '-v', 'error', '-show_entries',
                               'format=duration:stream=codec_name,codec_type,width,height,r_frame_rate',
                               '-of', 'json', str(path)]))


def validate_and_extract(source: Path, dest: Path) -> tuple[Path, list[dict]]:
    """Never operate on a partial or mutated package. Safe paths, exact hashes."""
    if not source.is_file():
        raise FileNotFoundError(source)
    extract = dest / 'source'
    extract.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(source) as z:
        if z.testzip() is not None:
            raise ValueError('ZIP CRC invalid')
        for item in z.infolist():
            p = Path(item.filename)
            if p.is_absolute() or any(part in {'..', ''} for part in p.parts):
                raise ValueError(f'Unsafe ZIP member {item.filename}')
            if (item.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError('Symlinks are not permitted in archival source packages')
        z.extractall(extract)
    manifest_path = extract / 'MANIFEST_SHA256.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf8'))
    if not isinstance(manifest, list) or not manifest:
        raise ValueError('Source SHA-256 manifest missing or empty')
    for entry in manifest:
        rel = Path(entry['file'])
        if rel.is_absolute() or '..' in rel.parts:
            raise ValueError(f'Unsafe manifest path: {rel}')
        p = extract / rel
        if not p.is_file():
            raise ValueError(f'MISSING_SOURCE_MEDIA: {rel}')
        if p.stat().st_size != entry['bytes'] or sha256_file(p) != entry['sha256']:
            raise ValueError(f'HASH_MISMATCH: {rel}')
    return extract, manifest


def validate_timeline(extract: Path, spec: dict):
    clip_info = []
    if not spec.get('clips') or not isinstance(spec['clips'], list):
        raise ValueError('MISSING_REQUIRED_CLIP_LIST')
    for n in spec['clips']:
        rel = Path(n)
        if rel.is_absolute() or '..' in rel.parts:
            raise ValueError('UNSAFE_SHOT_PATH')
        p = extract / rel
        if not p.is_file():
            raise ValueError(f'MISSING_SHOT: {n}')
        data = probe(p)
        video = [s for s in data['streams'] if s['codec_type'] == 'video']
        if len(video) != 1 or video[0]['width'] != 1920 or video[0]['height'] != 1080:
            raise ValueError(f'VIDEO_SHAPE_MISMATCH: {n}')
        num, den = map(int, video[0]['r_frame_rate'].split('/'))
        if abs(num / den - EXPECTED_FPS) > 0.001:
            raise ValueError(f'VIDEO_FPS_MISMATCH: {n}')
        clip_info.append({'file': str(rel), 'seconds': float(data['format']['duration'])})
    voice_ref = Path(spec['voice'])
    if voice_ref.is_absolute() or '..' in voice_ref.parts:
        raise ValueError('UNSAFE_VOICE_PATH')
    voice = extract / voice_ref
    if not voice.is_file():
        raise ValueError(f'MISSING_VOICE: {voice_ref}')
    a = probe(voice)
    audio = [s for s in a['streams'] if s['codec_type'] == 'audio']
    if len(audio) != 1 or audio[0]['codec_name'] != 'pcm_s24le':
        raise ValueError('SOURCE_VOICE_NOT_UNALTERED_PCM24')
    sum_clips = sum(x['seconds'] for x in clip_info)
    seconds_audio = float(a['format']['duration'])
    if abs(sum_clips - seconds_audio) > FRAME_SEC:
        raise ValueError(f'TIMELINE_NOT_ALIGNED: video={sum_clips}, audio={seconds_audio}')
    projects = list(extract.glob('*.kdenlive'))
    if len(projects) != 1:
        raise ValueError('ONE_EDITABLE_KDENLIVE_PROJECT_REQUIRED')
    return clip_info, seconds_audio, projects[0]


def render_private(extract: Path, output: Path, clips: list[dict], voice_seconds: float, voice_ref: str) -> Path:
    listfile = output / 'shot_order.ffconcat'
    listfile.write_text('ffconcat version 1.0\n' + ''.join(
        f"file '{(extract / item['file']).resolve()}'\n" for item in clips), encoding='utf8')
    target = output / 'PARIS05_APPERT_FR_PRIVATE_FACTORY_WORKPRINT.mp4'
    command(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
             '-f', 'concat', '-safe', '0', '-i', str(listfile),
             '-i', str(extract / voice_ref),
             '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy',
             '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
             '-movflags', '+faststart', '-t', str(voice_seconds), str(target)])
    data = probe(target)
    got = float(data['format']['duration'])
    if abs(got - voice_seconds) > 0.07:
        raise ValueError(f'RENDER_LENGTH_INCORRECT: got {got} expected {voice_seconds}')
    # Fast sample decode at beginning, middle and end (NOT full-video QA).
    for at in (0.5, voice_seconds / 2, max(0.0, voice_seconds - 1)):
        command(['ffmpeg', '-v', 'error', '-xerror', '-ss', f'{at:.3f}', '-i', str(target),
                 '-frames:v', '1', '-an', '-f', 'null', '-'])
    return target


def run(source: Path, output: Path, spec_path: Path | None = None, check_only: bool = False):
    output.mkdir(parents=True, exist_ok=True)
    extract, sources = validate_and_extract(source, output)
    if spec_path is None:
        spec_file = extract / 'FACTORY_SPEC.json'
        spec = json.loads(spec_file.read_text(encoding='utf8')) if spec_file.is_file() else DEFAULT_SPEC
    else:
        spec = json.loads(spec_path.read_text(encoding='utf8'))
    for key in ('route_id','chapter_id','language','clips','voice'):
        if key not in spec: raise ValueError(f'MISSING_SPEC_FIELD: {key}')
    clips, audio_seconds, kdenlive = validate_timeline(extract, spec)
    video = None if check_only else render_private(extract, output, clips, audio_seconds, spec['voice'])
    result = {
        'route': spec['route_id'], 'chapter': spec['chapter_id'], 'language': spec['language'],
        'type': 'PREFLIGHT_ONLY' if check_only else 'PRIVATE_AUTOMATED_REBUILD_TEST',
        'source_package': source.name, 'source_package_sha256': sha256_file(source),
        'render': video.name if video else None, 'render_sha256': sha256_file(video) if video else None,
        'render_duration_seconds': audio_seconds,
        'source_hashes_verified': len(sources), 'shots': clips,
        'kdenlive_project': str(kdenlive.relative_to(output)),
        'media_available_in_project_folder': True,
        'visual_spoken_word_sync_approved': False,
        'source_commercial_license_verified': False,
        'mastodon_ingestion_verified': False,
        'fr_editorial_qa_approved': False,
        'en_film_exists': False,
        'published_to_now': False,
        'release_ready': False,
        'note': 'Pipeline technical test only. Video content recycled from prior 3min15 private workprint, NOT a new film or a released tour.'
    }
    (output / 'factory_receipt.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    return result


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('source_zip', type=Path)
    p.add_argument('--output', type=Path, default=Path('dist/velvet-factory'))
    p.add_argument('--spec', type=Path, help='Optional route/chapter media spec; else use FACTORY_SPEC.json in ZIP')
    p.add_argument('--check-only', action='store_true', help='Validate package and timing without rendering')
    opts = p.parse_args()
    try:
        d=run(opts.source_zip, opts.output, opts.spec, opts.check_only)
        print(json.dumps({k:d[k] for k in ('type','render','render_duration_seconds','source_hashes_verified','release_ready')},indent=2))
    except Exception as e:
        print(f'FACTORY_HARD_STOP: {type(e).__name__}: {e}', file=sys.stderr)
        sys.exit(1)

if __name__=='__main__': main()