#!/usr/bin/env python3
"""Recover only four identified museum photographs for internal STOP04 source QA.
No image synthesis, no final video export, no publication license assumptions.
"""
import os,re,json,hashlib,html,time,urllib.parse,sys
from io import BytesIO
import requests
from PIL import Image,ImageOps,ImageEnhance,ImageFilter,ImageDraw
from bs4 import BeautifulSoup
OUT='output'
os.makedirs(OUT,exist_ok=True)
UA={'User-Agent':'VelvetPassportHistoricalArchiveReview/1.0 (source QA; Wikimedia and Paris Musees only)'}
PAGES={
'S07-P01':('PH20748','https://commons.wikimedia.org/wiki/File:38,_avenue_de_l%27Op%C3%A9ra,_1er_arrondissement,_Paris._PH20748.jpg','1916 view, Charles Lansiaux, Wikimedia Commons'),
'S07-P02':('1992.266','https://www.parismuseescollections.paris.fr/fr/musee-jean-moulin/oeuvres/vehicules-allemands-a-gazogene-et-camoufles-gares-avenue-de-l-opera-pres','1944 vehicles, Andre Gandner, Paris Musees'),
'S12-P01':('1994.681.2','https://www.parismuseescollections.paris.fr/fr/musee-jean-moulin/oeuvres/soldats-de-la-2e-division-blindee-1-ou-311iii-rmt-et-leurs-prisonniers-0','Pierre Vals, 25 Aug 1944, Paris Musees'),
'S16-P01':('PH11026','https://www.parismuseescollections.paris.fr/fr/musee-carnavalet/oeuvres/liberation-de-paris-25-aout-1944-militaires-allemands-se-rendant-avenue-et','Agence LAPI, 25 Aug 1944, Paris Musees'),
}
KNOWN={'S07-P02':'1992.266','S12-P01':'aze_mlm1994.681.2','S16-P01':'lpdp_59961-6'}
S=requests.Session();S.headers.update(UA)
def get(url):
 for attempt in range(3):
  try:
   r=S.get(url,timeout=35)
   if r.ok:return r
   print('HTTP',r.status_code,url[:125],flush=True)
  except Exception as e:print('ERR',str(e)[:180],flush=True)
  time.sleep(2*(attempt+1))
 return None

def photo_candidates(page_url,identifier):
 rr=get(page_url)
 if not rr:return []
 print('PAGE',rr.status_code,len(rr.content),rr.url,flush=True)
 soup=BeautifulSoup(rr.text,'html.parser')
 vals=[]
 for e in soup.select('meta[property="og:image"],img,source,a,meta[name="twitter:image"]'):
  for a in ['content','src','data-src','data-original','data-lazy-src','href','srcset','data-srcset']:
   v=e.get(a)
   if not v:continue
   if a.endswith('set'):
    v=v.split(',')[0].split(' ')[0]
   if 'atoms/images' in v and '.jpg' in v:
    vals.append(urllib.parse.urljoin(rr.url,html.unescape(v)).replace('&amp;','&'))
 for found in re.findall(r'(?:https?:)?//[^\"\s<>]+?atoms/images/[^\"\s<>]+?\.jpg(?:\?[^\"\s<>]*)?',rr.text,re.I):
  vals.append(html.unescape(found.replace('\\/','/')))
 for found in re.findall(r'(/sites/default/files/[^\"\s<>]+?atoms/images/[^\"\s<>]+?\.jpg(?:\?[^\"\s<>]*)?)',rr.text,re.I):
  vals.append(urllib.parse.urljoin(rr.url,html.unescape(found)))
 vv=[];keys=set()
 for v in vals:
  v=v.replace('\\/','/').replace('&#039;',"'").replace('&#39;',"'")
  if v.startswith('//'):v='https:'+v
  parsed=urllib.parse.urlparse(v)
  base=os.path.basename(parsed.path).lower()
  if identifier=='S07-P02':
   # Paris Musees page may include other related images; primary is prefered via ordering later.
   pass
  # rank, enforce correct image from all page images by first image(s) and expected basename
  if v not in keys:vv.append(v);keys.add(v)
 print('CANDIDATES',identifier,len(vv),'samples',vv[:6],flush=True)
 return vv

def commons_candidates():
 title='File:38, avenue de l\'Opéra, 1er arrondissement, Paris. PH20748.jpg'
 query=urllib.parse.urlencode({'action':'query','format':'json','prop':'imageinfo','iiprop':'url|size','titles':title})
 r=get('https://commons.wikimedia.org/w/api.php?'+query)
 urls=[]
 if r:
  try:
   js=r.json();print('COMMONS_META',str(js)[:1200],flush=True)
   for pg in js.get('query',{}).get('pages',{}).values():
    for i in pg.get('imageinfo',[]):urls.append(i['url'])
  except Exception as e:print('COMMONS_PARSE',str(e),flush=True)
 if not urls:
  urls.append('https://commons.wikimedia.org/wiki/Special:Redirect/file/'+urllib.parse.quote(title[5:],safe=''))
 return urls

def candidates_rank(url,known):
 path=urllib.parse.urlsplit(url).path
 base=os.path.basename(path).lower()
 score=0
 if known.lower() in base:score+=1000
 if '/atoms/images/' in path:score+=20
 if '/styles/' not in path:score+=200
 if 'pm_diaporama_zoom' in path:score+=80
 elif 'pm_diaporama/' in path:score+=45
 elif 'pm_notice/' in path:score+=10
 return score

def fetch_best(candidates,key,known):
 candidates=sorted(candidates,key=lambda u:candidates_rank(u,known),reverse=True)
 # Candidate selection must stay tied to exact file for known three names.
 if key in KNOWN:
  known2=KNOWN[key].lower()
  candidates=[u for u in candidates if known2 in os.path.basename(urllib.parse.urlsplit(u).path).lower()]
 print('FILT_CAND',key,len(candidates),flush=True)
 best=None
 for url in candidates[:18]:
  rr=get(url)
  if not rr:continue
  try:
   im=Image.open(BytesIO(rr.content)); im.verify()
   im=Image.open(BytesIO(rr.content));w,h=im.size
   if w<250 or h<250:continue
   rec=(w*h,len(rr.content),url,rr.content,w,h)
   if best is None or rec[:2]>best[:2]:best=rec
   print('FETCH_OK',key,w,h,len(rr.content),url[:130],flush=True)
  except Exception as e:print('INVALID_IMAGE',url[:140],str(e)[:100],flush=True)
 if not best:return None
 _,sz,url,blob,w,h=best
 path=os.path.join(OUT,key+'__'+KNOWN.get(key,'PH20748').replace('.','_')+'__ORIGINAL_WEB.jpg')
 open(path,'wb').write(blob)
 return {'path':path,'width':w,'height':h,'bytes':sz,'sha256':hashlib.sha256(blob).hexdigest(),'download_url':url}

results={}
for key,(inv,page,desc) in PAGES.items():
 print('\n===',key,inv,flush=True)
 urls=commons_candidates() if key=='S07-P01' else photo_candidates(page,key)
 result=fetch_best(urls,key,KNOWN.get(key,'PH20748'))
 if result:
  src=Image.open(result['path']); ex=ImageOps.exif_transpose(src).convert('RGB')
  # Only gentle luminance correction on a separate derivative; original untouched.
  ex=ImageOps.grayscale(ex)
  ex=ImageOps.autocontrast(ex,cutoff=0.35,preserve_tone=False)
  clean=Image.merge('RGB',(ex,ex,ex))
  path=os.path.join(OUT,key+'__NETTOYE_SANS_RECADRAGE.png')
  clean.save(path,optimize=True)
  result['clean_path']=path
  result['clean_width'],result['clean_height']=clean.size
  result['usable_for_1080p']=min(clean.width,clean.height)>=900 or (clean.width>=1500 and clean.height>=800)
  print('READY',key,result['width'],result['height'],result['sha256'][:12],flush=True)
 else:print('BLOCKED',key,flush=True)
 results[key]={**(result or {'status':'UNAVAILABLE'}),'inventory_id':inv,'description':desc,'source_page':page,'license_status':'SOURCE_REVIEW_ONLY; commercial use requires clearance (except verify Wikimedia CC0 independently)','production_slot':key}
json.dump(results,open(os.path.join(OUT,'RECUPERATION_QA.json'),'w'),ensure_ascii=False,indent=2)
print('SUMMARY',json.dumps({x:(y.get('width'),y.get('height')) if 'width' in y else 'UNAVAILABLE' for x,y in results.items()}),flush=True)