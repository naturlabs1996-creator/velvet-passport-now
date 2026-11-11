# These portable unit tests run without historical pictures or audio files.
import sys
from pathlib import Path
import unittest
sys.path.insert(0,str(Path(__file__).parent))
from velvet_gabarit_maitre import fit_geometry,ffmpeg_video_filter,approved_source_name
class GlobalTemplateTests(unittest.TestCase):
    def test_photo_with_speech_is_maximized_and_uncropped(self):
        g=fit_geometry(1536,1023,'spoken')
        self.assertEqual(g['dest_height'],860)
        self.assertEqual(g['subtitle_band_height'],220)
        self.assertEqual(g['original_preserved_percent'],100)
    def test_silent_plan_cannot_carry_empty_footer(self):
        g=fit_geometry(320,240,'silent')
        self.assertEqual(g['dest_height'],1080)
        self.assertEqual(g['subtitle_band_height'],0)
    def test_panorama_has_unavoidable_vertical_letterbox(self):
        g=fit_geometry(4000,500,'spoken')
        self.assertEqual(g['dest_width'],1920)
        self.assertTrue(g['unavoidable_vertical_margin'])
    def test_refuses_legacy_qas(self):
        self.assertFalse(approved_source_name('REJETE_NE_PAS_MONTER__STOP04_V7_QA.mp4'))
    def test_spoken_video_cannot_render_without_verified_subtitle(self):
        with self.assertRaises(ValueError):
            ffmpeg_video_filter('spoken',None)
if __name__=='__main__': unittest.main()