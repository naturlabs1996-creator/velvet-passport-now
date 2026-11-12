#!/usr/bin/env python3
"""Contract tests for source-first scene batches. No photo or audio AI generated."""
import hashlib, json, subprocess, sys, tempfile, unittest, wave
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"/"production"))
import velvet_scene_batch as batch

class SceneBatchTests(unittest.TestCase):
    def setUp(self):
        self.ctx=tempfile.TemporaryDirectory();self.addCleanup(self.ctx.cleanup)
        self.root=Path(self.ctx.name)
        self.img=self.root/'real_photo.jpg';self.img.write_bytes(b'original-verified-unique-test-only')
        self.wav=self.root/'voice.wav'
        with wave.open(str(self.wav),'wb') as f:
            f.setnchannels(1);f.setsampwidth(2);f.setframerate(24000);f.writeframes(b'\0\0'*24000)
        self.plan={'plan_id':'S01-P01','kind':'photo','source':self.img.name,'sha256':batch.sha(self.img),
                   'duration':1.6,'voice':self.wav.name,'voice_sha256':batch.sha(self.wav),
                   'voice_delay':.25,'subtitle_status':'MISSING'}
        self.scene={'scene_id':'S01','plans':[self.plan], 'expected_plans':1,'audio_editorial_lock':False,'rights_verified':False}
        self.project={'template':batch.MASTER,'route_id':'PARIS05','stop_id':'STOP04','scenes':[self.scene]}
    def test_draft_can_be_previewed_but_never_released(self):
        r=batch.audit(self.project,self.root)
        self.assertTrue(r['scenes'][0]['qa_workprint_possible'])
        self.assertFalse(r['ready_for_release'])
    def test_media_tampering_fails(self):
        self.img.write_bytes(b'changed')
        r=batch.audit(self.project,self.root)
        self.assertFalse(r['scenes'][0]['qa_workprint_possible'])
        self.assertIn('MEDIA_HOLD',str(r))
    def test_rejected_qa_mp4_never_used(self):
        self.plan['source']='REJETE_NE_PAS_MONTER_STOP04_V7_QA.mp4'
        self.assertFalse(batch.audit(self.project,self.root)['scenes'][0]['qa_workprint_possible'])
    def test_voice_must_fit_without_cut(self):
        self.plan['duration']=.5
        r=batch.audit(self.project,self.root)
        self.assertFalse(r['scenes'][0]['qa_workprint_possible'])
        self.assertIn('VOICE_CUT_AT_PLAN_END',str(r))
    def test_missing_timing_blocks_even_if_source_present(self):
        self.plan['duration']=None
        r=batch.audit(self.project,self.root)
        self.assertFalse(r['scenes'][0]['qa_workprint_possible'])
        self.assertIn('PLAN_TIMING_NOT_CERTIFIED',str(r))
    def test_deleted_scene_is_not_rendered(self):
        self.project['scenes'].append({'scene_id':'S13','deleted':True,'plans':[]})
        r=batch.audit(self.project,self.root)
        self.assertEqual(r['active_scene_count'],1)
    def test_template_cannot_be_forgotten(self):
        self.project.pop('template')
        with self.assertRaisesRegex(ValueError,'Master template missing'):
            batch.audit(self.project,self.root)

if __name__=='__main__':unittest.main()
