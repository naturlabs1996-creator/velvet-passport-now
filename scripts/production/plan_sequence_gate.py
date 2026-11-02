#!/usr/bin/env python3
"""Velvet Passport NOW — strict plan-sequence gate for private edits and release.

The ONLY authorized local workflow is: fill real facts + link original assets,
review every cue, receive user sign-off, issue separate approval seal, then render.
This checker cannot prevent another script from bypassing it: wire into every renderer.
"""
import argparse
import hashlib
import json
import math
import re
import sys
from datetime import datetime
from pathlib import Path

SHA = re.compile(r"^[0-9a-f]{64}$")
ROUTE = re.compile(r"^(PAR|MTL|QUE)-\d{2}$")
TOL = 0.055  # inclusive one 25fps frame plus float rounding


def sha_file(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for part in iter(lambda: f.read(1024 * 1024), b""):
            h.update(part)
    return h.hexdigest()


def object_at(root, rel):
    if not isinstance(rel, str) or not rel.strip():
        return None
    if Path(rel).is_absolute() or ".." in Path(rel).parts:
        return None
    path = (root / rel).resolve()
    try:
        path.relative_to(root.resolve())
    except ValueError:
        return None
    return path


def number(x):
    return type(x) in (int, float) and math.isfinite(x)


def nonempty(x):
    return isinstance(x, str) and bool(x.strip()) and x.strip() not in {"TODO", "TBD", "?", "À compléter", "A_COMPLETER"}


def check_plan(data, lang, root, stage="montage"):
    errors = []
    def err(code, message): errors.append(f"{code}: {message}")

    if not isinstance(data, dict) or data.get("schema_version") != "1.0":
        return ["FORMAT: schema_version doit être 1.0"]
    route = data.get("parcours_id")
    if not isinstance(route, str) or not ROUTE.fullmatch(route):
        err("ROUTE", "identifiant PAR/MTL/QUE-XX manquant ou non conforme")
    if lang not in {"fr", "en"}:
        return ["LANGUE: utiliser fr ou en"]

    narration = data.get("voix", {}).get(lang, {})
    length = narration.get("duree_seconds")
    if not number(length) or length <= 0:
        err("VOIX", f"{lang}: durée WAV vérifiée absente")
    if narration.get("transcription_integrale_verifiee") is not True:
        err("VOIX", f"{lang}: transcription intégrale non vérifiée à l'écoute")
    wavfile = object_at(root, narration.get("fichier"))
    if wavfile is None or not wavfile.is_file():
        err("VOIX", f"{lang}: WAV source physique absent / chemin invalide")
    else:
        if narration.get("sha256") != sha_file(wavfile):
            err("VOIX", f"{lang}: empreinte SHA256 du WAV incorrecte")

    sheet = data.get("planche_contact", {}).get(lang, {})
    path = object_at(root, sheet.get("fichier"))
    if path is None or not path.is_file() or sheet.get("sha256") != sha_file(path):
        err("PLANCHE", f"{lang}: planche contact réelle, numérotée et intègre absente")
    if sheet.get("tous_les_plans_visibles") is not True or sheet.get("controle_humain") is not True:
        err("PLANCHE", f"{lang}: toutes les images non présentées/contrôlées sur planche")

    chapters = data.get("chapitres", [])
    plans = data.get("plans", [])
    if not isinstance(chapters, list) or not chapters:
        err("CHAPITRES", "liste complète des chapitres absente")
        chapters = []
    if not isinstance(plans, list) or not plans:
        err("PLANS", "aucun plan image-texte-minutage")
        plans = []

    c_refs = set()
    ranges = []
    for ch in chapters:
        cid = ch.get("id") if isinstance(ch, dict) else None
        if not nonempty(cid) or cid in c_refs:
            err("CHAPITRES", "ID absent ou dupliqué")
            continue
        c_refs.add(cid)
        cue = ch.get(lang, {})
        a, b = cue.get("debut"), cue.get("fin")
        if not number(a) or not number(b) or a < 0 or b <= a:
            err("CHAPITRES", f"{cid}: bornes {lang} manquantes / invalides")
        else:
            ranges.append((float(a), float(b), cid))
    ranges.sort()
    for i, (a, b, cid) in enumerate(ranges):
        expected = ranges[i-1][1] if i else 0
        if abs(a-expected) > TOL:
            err("CHAPITRES", f"{cid}: intervalle manquant ou chevauchement après {expected:.2f}s")
    if ranges and number(length) and abs(ranges[-1][1]-length) > TOL:
        err("CHAPITRES", "chapitrage ne couvre pas la narration complète")

    seen = set()
    cues = []
    used_images = {}
    for p in plans:
        if not isinstance(p, dict):
            err("PLAN", "plan non structuré")
            continue
        pid = p.get("id")
        if not nonempty(pid) or pid in seen:
            err("PLAN", "ID plan absent/dupliqué")
            continue
        seen.add(pid)
        cid = p.get("chapitre_id")
        if cid not in c_refs:
            err("PLAN", f"{pid}: chapitre inconnu")
        cue = p.get(lang, {})
        a, b = cue.get("debut"), cue.get("fin")
        if not number(a) or not number(b) or a < 0 or b <= a:
            err("TIMECODE", f"{pid} {lang}: bornes manquantes ou inversées")
            continue
        cues.append((float(a), float(b), pid))
        if not any(c == cid and a >= cs-TOL and b <= ce+TOL for cs,ce,c in ranges):
            err("CHAPITRE_PLAN", f"{pid} {lang}: le plan déborde de son chapitre")
        text = cue.get("texte_exact")
        if not nonempty(text) or cue.get("confirme_par_ecoute") is not True:
            err("TEXTE", f"{pid} {lang}: texte exact non confirmé sur audio")
        if cue.get("minutage_confirme") is not True or cue.get("origine_calage") != "ECOUTE_WAV":
            err("TIMECODE", f"{pid} {lang}: minutage non confirmé sur WAV (ASR seul interdit)")
        if text != "[SILENCE]" and (not nonempty(cue.get("sous_titre")) or cue.get("sous_titre_verifie") is not True):
            err("SOUS_TITRE", f"{pid} {lang}: sous-titre non vérifié")
        img = p.get("image", {})
        if not isinstance(img, dict):
            img = {}
        path = object_at(root, img.get("fichier"))
        digest = img.get("sha256")
        if path is None or not path.is_file():
            err("IMAGE", f"{pid}: image physique absente / chemin invalide")
        elif digest != sha_file(path):
            err("IMAGE", f"{pid}: fichier source ne correspond pas au SHA256")
        if not nonempty(img.get("source_url_ou_cote")) or not nonempty(img.get("identification")):
            err("SOURCE", f"{pid}: source / identification manquante")
        if img.get("document_authentique") is not True or img.get("image_generee_ia") is not False:
            err("AUTHENTICITE", f"{pid}: authenticité non vérifiée / image IA interdite")
        if p.get("decision_client") != "APPROUVE" or p.get("synchronisation_validee") is not True:
            err("APPROBATION_IMAGE", f"{pid}: choix ou synchronisation non validé")
        if p.get("cadrage") != "CONTAIN_SANS_COUPE" or not nonempty(p.get("transition")):
            err("CADRAGE", f"{pid}: cadrage complet ou transition absent")
        if stage == "publication" and (img.get("droits") != "COMMERCIAL_CLEARED" or not nonempty(img.get("preuve_droits"))):
            err("DROITS", f"{pid}: droits commerciaux non certifiés")
        if nonempty(img.get("fichier")):
            file_id = img["fichier"]
            if file_id in used_images and not nonempty(p.get("justification_reutilisation")):
                err("REPETITION", f"{pid}: même image que {used_images[file_id]} sans justification")
            used_images[file_id] = pid
    cues.sort()
    for i, (a,b,pid) in enumerate(cues):
        expected = cues[i-1][1] if i else 0
        if abs(a - expected) > TOL:
            err("COUVERTURE", f"{pid}: blanc ou superposition à {expected:.2f}→{a:.2f}s")
    if cues and number(length) and abs(cues[-1][1] - length) > TOL:
        err("COUVERTURE", f"dernier plan finit {cues[-1][1]:.2f}s, voix finit {length:.2f}s")
    for cs, ce, cid in ranges:
        if not any(p.get("chapitre_id") == cid for p in plans if isinstance(p,dict)):
            err("CHAPITRES", f"{cid}: aucune image planifiée")
    return errors


def validate(manifest_path, lang, root, seal_path=None, stage="montage"):
    try:
        raw = manifest_path.read_bytes()
        data = json.loads(raw)
    except (OSError, ValueError) as e:
        return [f"LECTURE: {e}"]
    problems = check_plan(data, lang, root, stage)
    if seal_path is None or not seal_path.is_file():
        problems.append("SIGNATURE: approbation séparée du plan absente")
    else:
        try:
            approval = json.loads(seal_path.read_text(encoding="utf-8"))
            if approval.get("manifest_sha256") != hashlib.sha256(raw).hexdigest():
                problems.append("SIGNATURE: plan changé après approbation")
            if approval.get("parcours_id") != data.get("parcours_id") or lang not in approval.get("langues_approuvees", []):
                problems.append("SIGNATURE: ce parcours / cette langue non approuvé")
            if not nonempty(approval.get("approbateur")) or not nonempty(approval.get("date_iso")):
                problems.append("SIGNATURE: nom ou date d'approbation absent")
            else:
                datetime.fromisoformat(approval["date_iso"].replace("Z", "+00:00"))
        except (OSError, ValueError, TypeError) as e:
            problems.append(f"SIGNATURE: approbation invalide ({e})")
    return problems


def empty_manifest(route, city):
    return {"schema_version":"1.0","parcours_id":route,"ville":city,
            "statut":"BLOQUE_AVANT_MONTAGE","chapitres":[],
            "planche_contact":{"fr":{"fichier":None,"sha256":None,"tous_les_plans_visibles":False,"controle_humain":False},"en":{"fichier":None,"sha256":None,"tous_les_plans_visibles":False,"controle_humain":False}},
            "voix":{"fr":{"fichier":None,"sha256":None,"duree_seconds":None,"transcription_integrale_verifiee":False},
                    "en":{"fichier":None,"sha256":None,"duree_seconds":None,"transcription_integrale_verifiee":False}},
            "plans":[],"note":"Ne pas inventer des visuels, des répliques ou des timecodes."}


def main():
    ap = argparse.ArgumentParser(description="Bloque tout montage tant que le plan-séquence n'est pas approuvé")
    sub = ap.add_subparsers(dest="cmd", required=True)
    check = sub.add_parser("check", help="Contrôle bloquant : exit 1 si une seule erreur")
    check.add_argument("--manifest", type=Path, required=True)
    check.add_argument("--lang", choices=["fr","en"], required=True)
    check.add_argument("--assets-root", type=Path, required=True)
    check.add_argument("--seal", type=Path, required=True)
    check.add_argument("--stage", choices=["montage","publication"], default="montage")
    init = sub.add_parser("init", help="Crée un brouillon vide, TOUJOURS bloqué")
    init.add_argument("--route", required=True)
    init.add_argument("--city", required=True)
    init.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    if args.cmd == "init":
        if not ROUTE.fullmatch(args.route):
            ap.error("Route: PAR/MTL/QUE-XX")
        if args.out.exists():
            ap.error("Refus d'écraser un plan existant")
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(empty_manifest(args.route,args.city),ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        print(f"BROUILLON BLOQUÉ créé: {args.out}")
        return 0
    errors = validate(args.manifest,args.lang,args.assets_root,args.seal,args.stage)
    if errors:
        print(f"STOP: {len(errors)} non-conformité(s) — aucun film {args.lang} autorisé")
        for e in errors: print(" - "+e)
        return 1
    print(f"PASS: plan-séquence {args.lang} approuvé pour {args.stage}; monter uniquement cette version signée")
    return 0

if __name__ == "__main__":
    sys.exit(main())