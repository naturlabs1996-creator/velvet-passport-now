"""No historical imagery is synthesized here; test pictures are isolated QA fixtures."""
import hashlib,json,subprocess,tempfile,sys,unittest,copy
from pathlib import Path
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parent))
from velvet_unified_pipeline import inspect,make_clip,concat_with_transitions,probe,SCHEMA,TEMPLATE

def checksum(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()

class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.base=tempfile.TemporaryDirectory();cls.root=Path(cls.base.name)
  # Internal geometry fixtures only, NOT historical documents.
  Image.new('RGB',(400,300),'gray').save(cls.root/'testimage.jpg')
  Image.new('RGB',(480,180),'white').save(cls.root/'panorama.jpg')
  subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','sine=frequency=460:duration=1.0',
                  '-ar','48000','-ac','1',str(cls.root/'voice.wav')],check=True)
 @classmethod
 def tearDownClass(cls):cls.base.cleanup()
 def basic(self):
  photo={'id':'S01-P01','kind':'photo','source':'testimage.jpg','sha256':checksum(self.root/'testimage.jpg'),
   'visual_approved':True,'rights':'not_verified','plan_qa_pass':False,'spoken':True,
   'duration':1.4,'captions':[],'audio':{'mode':'voice','path':'voice.wav','sha256':checksum(self.root/'voice.wav'),'offset':.1}}
  return {'schema':SCHEMA,'global_video_template':TEMPLATE,'route_id':'VP-QA','release_requested':False,
          'scenes':[{'id':'S01','plans':[photo]}],'expected_plan_ids':['S01-P01']}
 def test_pilot_src_verified_but_not_release(self):
  x=inspect(self.basic(),self.root)
  self.assertEqual(x['verified_media'],1)
  self.assertEqual(x['status'],'QA_ONLY_NOT_FINAL')
  self.assertIn('S01-P01:SPOKEN_SUBTITLES_MISSING',x['warnings'])
 def test_broken_sha_rejected(self):
  m=self.basic();m['scenes'][0]['plans'][0]['sha256']='bad'
  self.assertIn('S01-P01:SOURCE_SHA_MISMATCH',inspect(m,self.root)['issues'])
 def test_rejected_video_prohibited(self):
  m=self.basic();m['scenes'][0]['plans'][0]['source']='REJETE_STOP04_V7_QA.mp4'
  self.assertIn('S01-P01:UNTRUSTED_OR_REJECTED_SOURCE',inspect(m,self.root)['issues'])
 def test_final_blocked_even_with_valid_original(self):
  m=self.basic();x=inspect(m,self.root,final=True)
  self.assertEqual(x['status'],'EXPORT_FINAL_REFUSED')
  self.assertIn('S01-P01:SUBTITLE_ALIGNMENT_NOT_APPROVED',x['issues'])
  self.assertIn('HUMAN_APPROVAL_MISSING',x['issues'])
 def test_no_traversal(self):
  m=self.basic();m['scenes'][0]['plans'][0]['source']='../../../etc/passwd'
  self.assertTrue(any('SOURCE_ERROR' in x for x in inspect(m,self.root)['issues']))
 def test_wide_photo_is_preserved_not_cropped(self):
  x=self.basic()['scenes'][0]['plans'][0];x['source']='panorama.jpg';x['sha256']=checksum(self.root/'panorama.jpg')
  dest=self.root/'wide.mp4'
  hit=make_clip(x,self.root,dest,self.root/'cache')
  self.assertFalse(hit)
  self.assertTrue(make_clip(x,self.root,dest,self.root/'cache'))
  p=probe(dest);v=next(s for s in p['streams'] if s['codec_type']=='video')
  self.assertEqual((v['width'],v['height']),(1920,1080))
 def test_full_video_two_audio_modes_and_locked_fade(self):
  a=self.basic()['scenes'][0]['plans'][0];a['spoken']=False;a['audio']={'mode':'silence'}
  a['duration']=.9;a['transition_out']={'type':'crossfade','seconds':.2,'editorial_lock':True}
  b=copy.deepcopy(a);b['id']='S01-P02';b['duration']=.9;b['transition_out']={}
  c=[self.root/'a.mp4',self.root/'b.mp4']
  for shot,path in zip((a,b),c):make_clip(shot,self.root,path,self.root/'cache')
  dest=self.root/'joined.mp4';concat_with_transitions([a,b],c,dest)
  q=probe(dest);self.assertAlmostEqual(float(q['format']['duration']),1.6,delta=.19)
  self.assertEqual({s['codec_type'] for s in q['streams']},{'video','audio'})
if __name__=='__main__':unittest.main(verbosity=2)
