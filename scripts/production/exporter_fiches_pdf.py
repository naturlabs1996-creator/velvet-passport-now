#!/usr/bin/env python3
"""Export printable visual storyboard — no rendering of film, even for drafts.
Requires reportlab: pip install reportlab; all images stay as original photos.
"""
import argparse
import html
import json
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image, Table, TableStyle, KeepTogether
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FONT = 'Helvetica'
FONT_PATH = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
if FONT_PATH.is_file():
    pdfmetrics.registerFont(TTFont('VelvetSans', str(FONT_PATH)))
    FONT = 'VelvetSans'

def esc(x):
    return html.escape(str(x or '—')).replace('\n','<br/>')

def stamp(canvas, doc):
    canvas.saveState()
    canvas.setFont(FONT, 8)
    canvas.setFillColor(colors.HexColor('#6a7280'))
    canvas.drawString(42, 29, 'Velvet Passport NOW — FICHE DE VALIDATION AVANT MONTAGE')
    canvas.drawRightString(A4[0]-42, 29, f'Page {doc.page}')
    canvas.restoreState()

def image_block(root, rel, maxw=490, maxh=255):
    if not rel or Path(rel).is_absolute() or '..' in Path(rel).parts:
        return None
    path = (root/rel).resolve()
    try: path.relative_to(root.resolve())
    except ValueError: return None
    if not path.is_file(): return None
    try:
        iw,ih = ImageReader(str(path)).getSize()
        scale = min(maxw/iw,maxh/ih)
        return Image(str(path), width=iw*scale, height=ih*scale)
    except Exception:
        return None

def timeval(x):
    if isinstance(x,(int,float)):
        mins = int(x//60)
        return f'{mins:02d}:{x%60:05.2f}'
    return 'À CALER'

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--manifest',type=Path,required=True)
    ap.add_argument('--assets-root',type=Path,required=True)
    ap.add_argument('--out',type=Path,required=True)
    args=ap.parse_args()
    data=json.loads(args.manifest.read_text(encoding='utf-8'))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    styles=getSampleStyleSheet()
    styles.add(ParagraphStyle(name='VelvetHead',fontName=FONT,fontSize=16,leading=22,textColor=colors.HexColor('#162842'),spaceAfter=12))
    styles.add(ParagraphStyle(name='VelvetBase',fontName=FONT,fontSize=9,leading=14,spaceAfter=8,wordWrap='CJK'))
    styles.add(ParagraphStyle(name='VelvetSmall',fontName=FONT,fontSize=8,leading=11,textColor=colors.HexColor('#4d5662'),spaceAfter=7,wordWrap='CJK'))
    styles.add(ParagraphStyle(name='VelvetWarn',fontName=FONT,fontSize=10,leading=15,textColor=colors.HexColor('#9b3529'),spaceAfter=10))
    s=[]
    s.append(Paragraph(f"<b>{esc(data.get('parcours_id'))} — Plan-séquence, avant tout montage</b>",styles['VelvetHead']))
    s.append(Paragraph("<b>NON APPROUVÉ — AUCUN MONTAGE AUTORISÉ.</b><br/>" +
        'Ce document montre les sources, images et minutages. Chaque ligne doit être confirmée en écoutant la voix originale. Aucun contenu manquant ne sera inventé.',styles['VelvetWarn']))
    s.append(Paragraph(f"Ville : {esc(data.get('ville'))} | Plans trouvés : {len(data.get('plans',[]))} | Schéma : {esc(data.get('schema_version'))}",styles['VelvetBase']))
    for p in data.get('plans',[]):
        s.append(PageBreak())
        s.append(Paragraph(f"<b>{esc(p.get('id'))}</b> — Chapitre {esc(p.get('chapitre_id'))}",styles['VelvetHead']))
        im=p.get('image') or {}
        pic=image_block(args.assets_root,im.get('fichier'))
        if pic:
            t=Table([[pic]],colWidths=[510])
            t.setStyle(TableStyle([('ALIGN',(0,0),(-1,-1),'CENTER'),('VALIGN',(0,0),(-1,-1),'MIDDLE')]))
            s.append(t)
        else:
            s.append(Paragraph('PHOTO NON DISPONIBLE — aucune image de remplacement inventée.',styles['VelvetWarn']))
        s.append(Spacer(1,12))
        s.append(Paragraph(f"<b>Photo :</b> {esc(im.get('fichier'))}<br/><b>Identification :</b> {esc(im.get('identification'))}<br/><b>Source :</b> {esc(im.get('source_url_ou_cote'))}<br/><b>Droits :</b> {esc(im.get('droits'))}",styles['VelvetSmall']))
        for lang in ('fr','en'):
            cue=p.get(lang) or {}
            s.append(Paragraph(f"<b>{lang.upper()} {timeval(cue.get('debut'))} → {timeval(cue.get('fin'))}</b> — Texte exact : {esc(cue.get('texte_exact'))}",styles['VelvetBase']))
            s.append(Paragraph('Sous-titre : ' + esc(cue.get('sous_titre')) + ' | Calage à l’écoute : ' + ('OUI' if cue.get('minutage_confirme') else 'NON'),styles['VelvetSmall']))
        s.append(Paragraph(f"Cadrage : {esc(p.get('cadrage'))} | Mouvement : {esc(p.get('mouvement'))} | Transition : {esc(p.get('transition'))}<br/>"+
            f"Décision image : <b>{esc(p.get('decision_client'))}</b> | Synchronisation validée : {('OUI' if p.get('synchronisation_validee') else 'NON')}",styles['VelvetBase']))
    pdf=SimpleDocTemplate(str(args.out),pagesize=A4,leftMargin=40,rightMargin=40,topMargin=42,bottomMargin=50,
            title='Plan séquence — '+str(data.get('parcours_id')),author='Velvet Passport NOW')
    pdf.build(s,onFirstPage=stamp,onLaterPages=stamp)
    print(f'FICHES PDF {args.out} — plans: {len(data.get("plans",[]))}; statut: à approuver')

if __name__=='__main__': main()