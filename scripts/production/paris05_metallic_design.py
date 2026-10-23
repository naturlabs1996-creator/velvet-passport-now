import os,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
lang=os.environ["LC"]; out=Path("frames");out.mkdir(exist_ok=True)
data=json.loads(Path("docs/production/paris05-measured-master-chapter-timecodes.json").read_text())["tracks"][lang]["chapters"]
names=["OPÉRA / PARIS 05","ERNEST APPERT","RUE LOUIS-LE-GRAND","LAÏD SEBAÏ · 1977","PROMENADE","JOSÉPHINE DE BEAUHARNAIS","VERS L'OPÉRA","PARIS · 1944","VERS RUE D'ANTIN","BEAUFORT ET NEMOURS","FIN DU PARCOURS"] if lang=="fr" else ["OPERA / PARIS 05","ERNEST APPERT","RUE LOUIS-LE-GRAND","LAÏD SEBAÏ · 1977","THE WALK","JOSÉPHINE DE BEAUHARNAIS","TOWARDS THE OPERA","PARIS · 1944","TOWARDS RUE D'ANTIN","BEAUFORT AND NEMOURS","END OF THE WALK"]
font="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
a=ImageFont.truetype(font,43);b=ImageFont.truetype(font,26)
timeline=[]
for i,c in enumerate(data):
 im=Image.new("RGB",(1280,720),(24,35,50));d=ImageDraw.Draw(im)
 for j in range(65):
  y=25+j*10
  v=35+j//7
  d.line((25,y,1255,y),fill=(v,v+9,v+20))
 d.rounded_rectangle((52,50,1228,670),radius=20,outline=(165,177,191),width=3)
 d.line((95,145,1185,145),fill=(218,187,122),width=5)
 d.line((95,566,1185,566),fill=(218,187,122),width=2)
 d.text((96,90),"VELVET PASSPORT  /  PARIS 05",font=b,fill=(233,222,194))
 d.text((96,290),names[i],font=a,fill=(249,249,245))
 d.text((96,614),f"{i+1:02d} / 11",font=b,fill=(218,187,122))
 d.text((900,614),"FRANÇAIS" if lang=="fr" else "ENGLISH",font=b,fill=(196,203,212))
 path=out/f"chapter-{i:02d}.png";im.save(path)
 s=float(c["start_seconds"]);e=float(c["end_seconds"])
 splice=711.82 if lang=="fr" else 718.94
 delta=18.08 if lang=="fr" else 16.28
 if s>splice:s+=delta
 if e>splice:e+=delta
 if i==10:e=3694.30 if lang=="fr" else 3750.76
 timeline.append((path,e-s))
def esc(p):return str(p.resolve()).replace("'","")
out.joinpath("playlist.ffconcat").write_text("ffconcat version 1.0\n"+"".join("file '"+esc(p)+"'\nduration "+f"{d:.3f}"+"\n" for p,d in timeline)+"file '"+esc(timeline[-1][0])+"'\n")
print(lang,len(timeline),sum(x[1] for x in timeline))
