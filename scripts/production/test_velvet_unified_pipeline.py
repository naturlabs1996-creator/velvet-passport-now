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

 def test_archive_first_plan_checks_its_own_window(self):
  """Regression: an archive film as first plan must not reuse undefined d."""
  film=self.root/'archive1s.mp4'
  subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','color=c=black:s=64x64:r=25:d=1',
                  '-f','lavfi','-i','sine=frequency=450:duration=1','-shortest',
                  '-c:v','mpeg4','-c:a','aac',str(film)],check=True)
  m=self.basic();shot=m['scenes'][0]['plans'][0]
  shot.update({'kind':'archive_film','source':film.name,'sha256':checksum(film),
               'duration':1.4,'spoken':False,'captions':[],'audio':{'mode':'archive_original_only'},
               'sound_mode':'archive_original_only'})
  report=inspect(m,self.root)
  self.assertIn('S01-P01:SOURCE_WINDOW_OUT_OF_RANGE',report['issues'])

 def test_qa_reference_never_accepted_as_historical_original(self):
  folder=self.root/'references_QA';folder.mkdir(exist_ok=True)
  img=folder/'copie_QA.jpg';img.write_bytes((self.root/'testimage.jpg').read_bytes())
  m=self.basic();shot=m['scenes'][0]['plans'][0]
  shot['source']='references_QA/copie_QA.jpg';shot['sha256']=checksum(img)
  self.assertIn('S01-P01:UNTRUSTED_OR_REJECTED_SOURCE',inspect(m,self.root)['issues'])

 def test_full_private_qa_rejects_incomplete_plan_set(self):
  m=self.basic();m['expected_plan_ids']=['S01-P01','S01-P02']
  self.assertIn('EXPECTED_PLANS_INCOMPLETE',inspect(m,self.root)['issues'])
  self.assertNotIn('EXPECTED_PLANS_INCOMPLETE',inspect(m,self.root,scope='S01')['issues'])

 def test_exact_reuse_of_photo_requires_explicit_authorization(self):
  m=self.basic();other=copy.deepcopy(m['scenes'][0]['plans'][0])
  other['id']='S01-P02';m['scenes'][0]['plans'].append(other)
  m['expected_plan_ids'].append('S01-P02')
  self.assertIn('S01-P02:DUPLICATE_PHOTO_UNAUTHORIZED:S01-P01',inspect(m,self.root)['issues'])


 def test_stop04_canonical_manifest_never_loses_plan_or_approved_audio(self):
  path=Path(__file__).resolve().parents[2]/'docs/production/routes/VP-PAR-05-STOP04.unified-v2.json'
  manifest=json.loads(path.read_text(encoding='utf-8'))
  self.assertEqual(manifest['schema'],SCHEMA)
  self.assertEqual(len(manifest['expected_plan_ids']),30)
  plans=[p for scene in manifest['scenes'] if not scene.get('deleted') for p in scene.get('plans',[])]
  self.assertEqual(len(plans),30)
  self.assertEqual(sorted(p['id'] for p in plans),sorted(manifest['expected_plan_ids']))
  self.assertFalse(manifest.get('final_human_approval'))
  by_id={p['id']:p for p in plans}
  self.assertEqual(by_id['S15-P01']['audio']['mode'],'archive_original_only')
  self.assertEqual(by_id['S20-P02']['audio']['mode'],'archive_original_only')
  self.assertEqual(by_id['S20-P02']['transition_out']['seconds'],1.2)
  # A recovered source must replace old QA imagery and the old S12/S23 duplicate.
  for plan_id in ('S07-P01','S12-P01','S16-P01'):
   self.assertEqual(by_id[plan_id]['source_reconciliation_status'],'MATCHED_CATALOGUE_ORIGINAL_WEB_IMAGE_RECOVERED_20261117')
   self.assertNotIn('QA',by_id[plan_id]['source'].upper())
   self.assertFalse(by_id[plan_id]['plan_qa_pass'])
  self.assertNotEqual(by_id['S12-P01']['sha256'],by_id['S23-P01']['sha256'])
  s07extra=by_id['S07-P01']['supplementary_original_photo']
  self.assertEqual(s07extra['subslot'],'S07-P02')
  self.assertNotEqual(s07extra['sha256'],by_id['S07-P01']['sha256'])
  self.assertFalse(manifest['release_requested'])
  self.assertFalse(manifest['rights_signoff'])
  self.assertTrue(manifest['scenes'][22]['narration_voice_pending_three_plan_sync']['path'].startswith('audio/S23_'))

if __name__=='__main__':unittest.main(verbosity=2)
