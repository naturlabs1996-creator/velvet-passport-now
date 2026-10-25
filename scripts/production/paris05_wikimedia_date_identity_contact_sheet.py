#!/usr/bin/env python3
"""Visual contact sheet of dated Wikimedia Commons Rue Quatre Septembre photographs.
Public source research. No commercial reproduction permission implied.
"""
import pathlib,hashlib,urllib.parse,urllib.request,time,json
from PIL import Image,ImageOps,ImageDraw
out=pathlib.Path("dist/paris05-wikimedia-date-identity-check")
out.mkdir(parents=True,exist_ok=True)
dates=["2021-06-14","2023-06-21","2025-04-21","2026-01-12"]
results=[]
for date in dates:
 for n in [1,2]:
  name=f"Rue Quatre Septembre - Paris II (FR75) - {date} - {n}.jpg"
  media=name.replace(" ","_")
  h=hashlib.md5(media.encode()).hexdigest()
  url=f"https://upload.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{urllib.parse.quote(media)}/640px-{urllib.parse.quote(media)}"
  dest=out/f"{date}-{n}.jpg"
  issue=None
  for retry in range(3):
   try:
    req=urllib.request.Request(url,headers={"User-Agent":"VelvetPassport/1.0 (historical archival imagery comparison; see GitHub)"})
    with urllib.request.urlopen(req,timeout=28) as r:b=r.read()
    if not b.startswith(bytes.fromhex("ffd8ff")):raise ValueError("Not a JPG")
    dest.write_bytes(b);issue=None;break
   except Exception as ex:
    issue=str(ex);time.sleep(4*(retry+1))
  results.append({"date":date,"num":n,"source_page":"https://commons.wikimedia.org/wiki/File:"+urllib.parse.quote(media),"thumbnail_url":url,"local":dest.name if dest.exists() else None,"error":issue})
  print(date,n,"OK" if dest.exists() else issue,flush=True)
  time.sleep(2)
photos=[r for r in results if r["local"]]
if photos:
 cols=2;width=740;height=650
 sheet=Image.new("RGB",(cols*width,((len(photos)+1)//2)*height),"#dddddd")
 draw=ImageDraw.Draw(sheet)
 for i,r in enumerate(photos):
  x=i%2*width;y=i//2*height
  with Image.open(out/r["local"]) as im:
   im=ImageOps.contain(im.convert("RGB"),(720,590))
  sheet.paste(im,(x+(width-im.width)//2,y+20))
  draw.text((x+20,y+605),r["date"]+" — "+str(r["num"])+" / thumbnail Wikimedia",fill="black")
 sheet.save(out/"CONTACT-SHEET-DATED-WIKIMEDIA.jpg",quality=87)
(out/"SOURCES.json").write_text(json.dumps(results,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
if not photos:raise SystemExit(1)
