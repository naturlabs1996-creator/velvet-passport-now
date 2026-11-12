import hashlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from PIL import Image
from vp_factory import frame_geometry, plan_problems, validate, preview_batch, encode_plan

class FactoryTests(unittest.TestCase):
    def test_narrow_image_uses_height_no_crop(self):
        im=Image.new('RGB',(600,900),'white')
        frame,rec=frame_geometry(im,True)
        self.assertEqual(frame.size,(1920,1080))
        self.assertEqual(rec['display_dimensions'][1],860)
        self.assertEqual(rec['top_internal_margin'],0)
        self.assertEqual(rec['bottom_internal_margin'],0)
        self.assertFalse(rec['crop_applied'])
        self.assertEqual(rec['caption_band_px'],220)

    def test_wide_image_uses_width_without_crop(self):
        im=Image.new('RGB',(2200,500),'white')
        frame,rec=frame_geometry(im,True)
        self.assertEqual(rec['display_dimensions'][0],1920)
        self.assertGreater(rec['top_internal_margin'],0) # unavoidable original aspect ratio
        self.assertEqual(rec['original_visible_percent'],100)

    def test_silent_plan_full_height(self):
        im=Image.new('RGB',(640,480),'white')
        _,rec=frame_geometry(im,False)
        self.assertEqual(rec['display_dimensions'][1],1080)
        self.assertEqual(rec['caption_band_px'],0)

    def test_missing_audio_is_blocker(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); im=root/'img.jpg';im.write_bytes(b'notanimage')
            sha=hashlib.sha256(im.read_bytes()).hexdigest()
            p={'id':'S01-P01','kind':'photo','source':'img.jpg','sha256':sha,
               'speech':True,'caption_lock':True,'media_lock':True,
               'commercial_rights':'cleared','timecodes_verified':True,
               'duration_seconds':4.5,'audio_lock':True,'captions':'missing.ass'}
            issues=plan_problems({'id':'S01','editorial_lock':True},p,root,final=True)
            self.assertTrue(any('narration audible sans' in e for e in issues))
            self.assertTrue(any('sous-titre absent' in e or 'fichier sous-titre absent' in e for e in issues))

    def test_duplicate_photo_across_scenes_is_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);p=root/'image.jpg';p.write_bytes(b'x')
            sha=hashlib.sha256(b'x').hexdigest()
            d={'route_id':'test','scenes':[{'id':f'S{i:02}', 'plans':[{'id':f'P{i}', 'kind':'photo','source':'image.jpg','sha256':sha}]} for i in (1,2)]}
            self.assertTrue(any('répétée' in e for e in validate(d,root,False)))

    def test_refused_final_on_incomplete_package(self):
        root=Path(__file__).parent/'sources'
        d=json.loads((Path(__file__).parent/'STOP04_MANIFEST_FACTORY_QA.json').read_text())
        issues=validate(d,root,True)
        self.assertGreater(len(issues),50)
        self.assertTrue(any('S01' in e for e in issues))

    def test_silent_photo_actual_video_encoding(self):
        if __import__('shutil').which('ffmpeg') is None:self.skipTest('ffmpeg absent')
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);src=root/'source.png';Image.new('RGB',(160,120),'white').save(src)
            p={'id':'S01-TEST','kind':'photo','source':'source.png',
               'duration_seconds':0.6,'speech':False}
            encoded=encode_plan({'id':'S01'},p,root,root/'out')
            self.assertGreater(encoded.stat().st_size,1000)
            self.assertTrue(encoded.read_bytes()[:100].find(b'ftyp')>-1)

    def test_real_approved_fade_synchronizes_audio_video(self):
        if __import__('shutil').which('ffmpeg') is None:self.skipTest('ffmpeg absent')
        from vp_factory import stitch_segments, audio_probe
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);src=root/'source.png';Image.new('RGB',(240,160),'white').save(src)
            p1={'id':'S01-TEST','kind':'photo','source':'source.png',
                'duration_seconds':0.8,'speech':False,'transition_out':
                {'type':'fade','duration_seconds':0.2,'approved':True}}
            p2={'id':'S02-TEST','kind':'photo','source':'source.png',
                'duration_seconds':0.8,'speech':False,'transition_out':{'type':'cut'}}
            c1=encode_plan({'id':'S01'},p1,root,root/'out')
            c2=encode_plan({'id':'S02'},p2,root,root/'out')
            target=root/'joined.mp4';stitch_segments([c1,c2],[p1,p2],target)
            self.assertTrue(target.exists())
            self.assertAlmostEqual(audio_probe(target),1.4,delta=0.15)

if __name__=='__main__':unittest.main()