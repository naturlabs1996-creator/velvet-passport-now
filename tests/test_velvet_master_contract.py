#!/usr/bin/env python3
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts' / 'production'))
from velvet_master_contract import inspect, MASTER

class ContractTests(unittest.TestCase):
    def manifest(self):
        return {"route_id":"VP-TEST", "segments":[{"id":"S01"}],
                "global_video_template":MASTER,"release_requested":False}
    def test_draft_can_exist_without_media(self):
        result=inspect(self.manifest(),"test.json")
        self.assertEqual(result["status"],"DRAFT_PASS_NOT_RELEASE")
        self.assertFalse(result["issues"])
    def test_master_cannot_be_forgotten(self):
        m=self.manifest();del m["global_video_template"]
        self.assertIn("MASTER_GABARIT_NOT_LINKED",inspect(m,"test.json")["issues"])
    def test_publication_fails_without_evidence(self):
        m=self.manifest();m["release_requested"]=True
        self.assertIn("PUBLICATION_BLOCKED:source_first_media_qa_passed",inspect(m,"test.json")["issues"])
        self.assertIn("PUBLICATION_BLOCKED:fr:subtitle_audio_alignment_reviewed",inspect(m,"test.json")["issues"])
    def test_legacy_qa_images_are_prohibited(self):
        m=self.manifest();m["assets"]=[{"id":"A","local_file":"REJETE_STOP04_V7_QA.mp4"}]
        self.assertIn("A:REJECTED_LEGACY_SOURCE",inspect(m,"test.json")["issues"])
    def test_release_needs_human_qa(self):
        m=self.manifest();m["release_requested"]=True
        self.assertIn("PUBLICATION_BLOCKED:final_human_approval",inspect(m,"test.json")["issues"])

if __name__ == "__main__":
    unittest.main()