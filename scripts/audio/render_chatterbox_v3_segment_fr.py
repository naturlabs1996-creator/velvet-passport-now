#!/usr/bin/env python3
import argparse, json, re
from pathlib import Path

def sentence_chunks(text):
    return [x.strip() for x in re.split(r"(?<=[.!?])\s+", text.strip()) if x.strip()]

def safe_id(value):
    return re.sub(r"[^A-Za-z0-9_-]+", "-", value.strip()).strip("-")

def main():
    p=argparse.ArgumentParser()
    p.add_argument('manifest', type=Path)
    p.add_argument('output', type=Path)
    p.add_argument('--segment-id', required=True)
    p.add_argument('--exaggeration', type=float, default=0.72)
    p.add_argument('--cfg-weight', type=float, default=0.30)
    p.add_argument('--temperature', type=float, default=0.80)
    p.add_argument('--pause-ms', type=int, default=420)
    p.add_argument('--tempo', type=float, default=0.96)
    a=p.parse_args()
    import librosa, numpy as np, torch, torchaudio
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    data=json.loads(a.manifest.read_text(encoding='utf-8'))
    seg=next((s for s in data['segments'] if s['id']==a.segment_id), None)
    if not seg: raise ValueError(f'Segment not found: {a.segment_id}')
    model=ChatterboxMultilingualTTS.from_pretrained(device='cpu', t3_model='v3')
    silence=torch.zeros(int(model.sr*a.pause_ms/1000), dtype=torch.float32)
    parts=[]
    chunks=sentence_chunks(seg['text'])
    for i,sentence in enumerate(chunks):
        wav=model.generate(sentence, language_id='fr', exaggeration=a.exaggeration,
            cfg_weight=a.cfg_weight, temperature=a.temperature).squeeze(0).cpu()
        if a.tempo!=1.0:
            wav=torch.from_numpy(np.asarray(librosa.effects.time_stretch(np.asarray(wav,dtype=np.float32), rate=a.tempo),dtype=np.float32))
        parts.append(wav)
        if i < len(chunks)-1: parts.append(silence)
    final=torch.cat(parts)
    a.output.mkdir(parents=True, exist_ok=True)
    sid=safe_id(seg['id'])
    out=a.output/f'{sid}-fr-chatterbox-v3-tempo-096x.wav'
    torchaudio.save(str(out), final.unsqueeze(0), model.sr)
    meta={'id':seg['id'],'title':seg['title'],'file':out.name,'duration_seconds':len(final)/model.sr,'sample_rate':model.sr}
    (a.output/f'{sid}.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(meta,ensure_ascii=False))
if __name__=='__main__': main()
