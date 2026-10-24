#!/usr/bin/env python3
"""Mastodon ingest spool: durable intake, retryable Storage transfer, integrity-checked.
NO claim of complete Mastodon archiving until catalog readback is implemented.
NO customer-facing endpoints. Run on a trusted machine, with secrets in env.
"""
import argparse
import base64
import hashlib
import json
import mimetypes
import os
from pathlib import Path
import re
import sqlite3
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urljoin
from urllib.request import Request, urlopen
import uuid

BUCKET = "mastodon-originals"
CHUNK = 6 * 1024 * 1024
RETRY_CODES = {408, 423, 425, 429, 500, 502, 503, 504}
DEFAULT_QUEUE = Path.home() / ".local" / "share" / "velvet-passport" / "mastodon-spool"

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as handle:
        for part in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(part)
    return h.hexdigest()

def safe(value):
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}", value):
        raise ValueError("Unsafe or empty archive identifier")
    return value

def queue_db(root):
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(root, 0o700)
    (root / "blobs").mkdir(exist_ok=True, mode=0o700)
    os.chmod(root / "blobs", 0o700)
    conn = sqlite3.connect(root / "queue.sqlite3")
    os.chmod(root / "queue.sqlite3", 0o600)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=FULL")
    conn.execute("""CREATE TABLE IF NOT EXISTS entries (
       asset_id TEXT PRIMARY KEY, sha256 TEXT NOT NULL, local_path TEXT NOT NULL,
       bytes INTEGER NOT NULL, filename TEXT NOT NULL, metadata TEXT NOT NULL,
       storage_path TEXT NOT NULL, status TEXT NOT NULL, upload_url TEXT,
       upload_started INTEGER, attempts INTEGER DEFAULT 0, last_error TEXT,
       updated_at INTEGER NOT NULL
    )""")
    return conn

def atomic_copy(source, dest):
    temp = dest.with_name(dest.name + "." + uuid.uuid4().hex + ".part")
    try:
        with open(source, "rb") as src, open(temp, "xb") as dst:
            for part in iter(lambda: src.read(1024 * 1024), b""):
                dst.write(part)
            dst.flush()
            os.fsync(dst.fileno())
        os.chmod(temp, 0o600)
        os.replace(temp, dest)
    finally:
        if temp.exists():
            temp.unlink()

def enqueue(db, root, args):
    original = Path(args.file).resolve(strict=True)
    if not original.is_file() or original.stat().st_size == 0:
        raise ValueError("The original must be a nonempty regular file")
    aid = safe(args.asset_id)
    city, route, stop, story = [safe(x) for x in [args.city, args.route, args.stop, args.story]]
    digest = sha256_file(original)
    ext = original.suffix.lower() if re.fullmatch(r"\.[a-z0-9]{1,10}", original.suffix.lower()) else ".bin"
    storage_path = "/".join([city, route, stop, aid, digest + ext])
    blob = root / "blobs" / digest
    if not blob.exists():
        atomic_copy(original, blob)
    if sha256_file(blob) != digest:
        raise ValueError("Staging checksum mismatch, refusing enqueue")
    metadata = {
        "city": city, "route": route, "stop": stop, "story": story,
        "title": args.title, "source": args.source, "rights": "REVIEW_PENDING",
        "original_name": original.name
    }
    with db:
        previous = db.execute("SELECT sha256 FROM entries WHERE asset_id=?", (aid,)).fetchone()
        if previous and previous[0] != digest:
            raise ValueError("Asset ID already used for different bytes; assign new ID/version")
        if not previous:
            db.execute("""INSERT INTO entries
                (asset_id,sha256,local_path,bytes,filename,metadata,storage_path,status,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?)""", (aid,digest,str(blob),blob.stat().st_size,
                original.name,json.dumps(metadata,ensure_ascii=False),storage_path,"PENDING",int(time.time())))
    return {"asset_id":aid,"sha256":digest,"storage_path":storage_path,
            "status":"PENDING_OR_EXISTING","note":"LOCAL SPOOL ONLY, NOT MASTODON"}

def request(method, url, token, data=None, extra=None, timeout=90):
    headers={"Authorization":"Bearer " + token}
    if extra: headers.update(extra)
    req=Request(url,data=data,headers=headers,method=method)
    try:
        with urlopen(req,timeout=timeout) as res:
            return (res.status, dict(res.headers), res.read())
    except HTTPError as exc:
        body=exc.read(500)
        return (exc.code, dict(exc.headers), body)

def require_success(response, accepted):
    status = response[0]
    if status not in accepted:
        raise RuntimeError(f"Remote HTTP {status}: " + response[2][:160].decode("utf8","replace"))
    return response

def retry_request(fn, retries=4):
    last=None
    for attempt in range(retries):
        try:
            answer=fn()
            if answer[0] not in RETRY_CODES:
                return answer
            last=RuntimeError(f"Retryable HTTP {answer[0]}")
        except (URLError, TimeoutError, OSError) as exc:
            last=exc
        if attempt < retries-1:
            time.sleep(min(2**attempt,8))
    raise RuntimeError(f"Transfer failed after retries: {last}")

def destination(base, storage_path):
    return base + "/storage/v1/object/" + quote(BUCKET,safe="") + "/" + quote(storage_path,safe="/")

def verify_download(base, token, row):
    """Stream private original back: don't load large video/PDF into RAM."""
    url = destination(base,row["storage_path"]).replace("/storage/v1/object/", "/storage/v1/object/authenticated/",1)
    for attempt in range(4):
        try:
            req=Request(url,headers={"Authorization":"Bearer "+token},method="GET")
            with urlopen(req,timeout=120) as remote:
                digest=hashlib.sha256()
                length=0
                for chunk in iter(lambda: remote.read(1024 * 1024),b""):
                    length += len(chunk)
                    digest.update(chunk)
                if length != row["bytes"] or digest.hexdigest() != row["sha256"]:
                    raise RuntimeError("CRITICAL remote checksum mismatch; no catalog receipt may be issued")
                return True
        except HTTPError as exc:
            if exc.code == 404: return False
            if exc.code not in RETRY_CODES: raise
        except (URLError, TimeoutError, OSError):
            pass
        if attempt < 3: time.sleep(min(2**attempt,8))
    raise RuntimeError("Remote readback failed after retries")

def standard_upload(base,token,row):
    blob=Path(row["local_path"]).read_bytes()
    url=destination(base,row["storage_path"])
    response=retry_request(lambda: request("POST",url,token,blob,{
        "Content-Type":mimetypes.guess_type(row["filename"])[0] or "application/octet-stream",
        "x-upsert":"false"},timeout=120))
    if response[0] in (400,409):
        # An interrupted prior attempt may already have completed: verify by reading.
        if verify_download(base,token,row): return
    require_success(response,{200,201})

def upload_tus(base,token,row,db):
    tus_base=base.replace(".supabase.co", ".storage.supabase.co")
    meta={"bucketName":BUCKET,"objectName":row["storage_path"],
          "contentType":mimetypes.guess_type(row["filename"])[0] or "application/octet-stream",
          "cacheControl":"3600"}
    auth={"Tus-Resumable":"1.0.0"}
    def head(location):
        response=retry_request(lambda: request("HEAD",location,token,extra=auth))
        if response[0] in (404,410): return None
        require_success(response,{200,204})
        return int(next((v for k,v in response[1].items() if k.lower()=="upload-offset"),"0"))
    location=row.get("upload_url")
    if location and int(time.time()) - (row.get("upload_started") or 0) > 23*3600:
        location=None
    offset=head(location) if location else None
    if offset is None:
        metadata=",".join(k+" "+base64.b64encode(v.encode()).decode() for k,v in meta.items())
        response=retry_request(lambda: request("POST",tus_base+"/storage/v1/upload/resumable",token,b"",{
          **auth,"Upload-Length":str(row["bytes"]),"Upload-Metadata":metadata,
          "Content-Type":"application/offset+octet-stream"}))
        require_success(response,{201,204})
        raw_loc=next((v for k,v in response[1].items() if k.lower()=="location"),None)
        if not raw_loc: raise RuntimeError("TUS upload URL missing")
        location=urljoin(tus_base+"/",raw_loc)
        # The upload URL must remain under the expected project host.
        if not location.startswith(tus_base+"/storage/v1/upload/resumable/"):
            raise RuntimeError("Unexpected TUS Location endpoint")
        offset=0
        with db:
            db.execute("UPDATE entries SET upload_url=?,upload_started=?,updated_at=? WHERE asset_id=?",
              (location,int(time.time()),int(time.time()),row["asset_id"]))
    with open(row["local_path"],"rb") as src:
        while offset < row["bytes"]:
            src.seek(offset)
            part=src.read(min(CHUNK,row["bytes"]-offset))
            for attempt in range(5):
                try:
                    response=request("PATCH",location,token,part,{
                        **auth,"Upload-Offset":str(offset),
                        "Content-Type":"application/offset+octet-stream"},timeout=180)
                    if response[0] in (200,204):
                        nextoffset=int(next((v for k,v in response[1].items() if k.lower()=="upload-offset"),str(offset+len(part))))
                        if nextoffset < offset+len(part): raise RuntimeError("Partial TUS patch acknowledgement")
                        offset=nextoffset
                        break
                    if response[0] not in RETRY_CODES and response[0] != 409:
                        raise RuntimeError(f"TUS patch status {response[0]}")
                except (URLError,TimeoutError,OSError):
                    pass
                updated=head(location)
                if updated is None: raise RuntimeError("TUS session expired; retry next worker run")
                if updated >= offset+len(part):
                    offset=updated
                    break
                if updated != offset: raise RuntimeError("Unexpected TUS offset")
                if attempt==4: raise RuntimeError("TUS retries exhausted")
                time.sleep(min(2**attempt,8))
    # The client must never equate 'all bytes transferred' with catalogued.
    if offset != row["bytes"]: raise RuntimeError("TUS final offset differs from original size")

def push(db,base,token):
    rowdata=db.execute("""SELECT asset_id,sha256,local_path,bytes,filename,storage_path,
        status,upload_url,upload_started FROM entries
        WHERE status IN ('PENDING','RETRY_PENDING')
        ORDER BY updated_at""").fetchall()
    names=["asset_id","sha256","local_path","bytes","filename","storage_path",
           "status","upload_url","upload_started"]
    outcome=[]
    for vals in rowdata:
        row=dict(zip(names,vals))
        try:
            if sha256_file(row["local_path"]) != row["sha256"]:
                raise RuntimeError("CRITICAL original spool checksum mismatch")
            if not verify_download(base,token,row):
                if row["bytes"] <= CHUNK: standard_upload(base,token,row)
                else: upload_tus(base,token,row,db)
                if not verify_download(base,token,row):
                    raise RuntimeError("Remote read-back missing after upload")
            status="STORED_CATALOG_PENDING"  # catalog registration MUST be verified separately.
            error=None
        except Exception as exc:
            status="RETRY_PENDING"
            error=str(exc)[:500]
        with db:
            db.execute("""UPDATE entries SET status=?,last_error=?,attempts=attempts+1,updated_at=?
                         WHERE asset_id=?""",(status,error,int(time.time()),row["asset_id"]))
        outcome.append({"asset_id":row["asset_id"],"status":status,"error":error})
    return outcome

def status_report(db):
    counts=dict(db.execute("SELECT status,count(*) FROM entries GROUP BY status").fetchall())
    rows=db.execute("SELECT asset_id,status,attempts,last_error FROM entries ORDER BY asset_id").fetchall()
    return {"count":sum(counts.values()),"states":counts,
      "items":[{"asset_id":a,"status":s,"attempts":n,"last_error":e} for a,s,n,e in rows],
      "archival_proof":"INCOMPLETE: catalog readback not implemented"}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--queue-dir",default=os.environ.get("MASTODON_QUEUE_DIR",str(DEFAULT_QUEUE)))
    sub=parser.add_subparsers(dest="command",required=True)
    ent=sub.add_parser("enqueue")
    for field in ["file","asset-id","city","route","stop","story","title","source"]:
        ent.add_argument("--"+field,required=True)
    sub.add_parser("status")
    sub.add_parser("push")
    args=parser.parse_args()
    root=Path(args.queue_dir).expanduser()
    db=queue_db(root)
    if args.command=="enqueue": result=enqueue(db,root,args)
    elif args.command=="status": result=status_report(db)
    else:
        token=os.environ.get("MASTODON_STORAGE_TOKEN")
        base=os.environ.get("MASTODON_SUPABASE_URL","").rstrip("/")
        if not token or not base.startswith("https://") or not base.endswith(".supabase.co"):
            raise SystemExit("BLOCKED: missing private MASTODON_STORAGE_TOKEN / MASTODON_SUPABASE_URL")
        result=push(db,base,token)
    print(json.dumps(result,ensure_ascii=False,indent=2))
    db.close()

if __name__=="__main__":
    main()
