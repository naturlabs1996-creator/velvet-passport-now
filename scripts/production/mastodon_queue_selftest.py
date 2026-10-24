#!/usr/bin/env python3
"""Offline smoke checks; never contacts Supabase or needs credentials."""
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import mastodon_reliable_queue as q

def main():
    with tempfile.TemporaryDirectory() as temp:
        root=Path(temp)/"spool"
        original=Path(temp)/"portrait.jpg"
        original.write_bytes(b"test image bytes" * 100)
        db=q.queue_db(root)
        req=SimpleNamespace(file=str(original),asset_id="VP-PAR-05-SEBAI-VIS-TEST",
            city="PAR",route="VP-PAR-05",stop="STOP-SEBAI",story="STORY01",
            title="Test portrait",source="local smoke test")
        item=q.enqueue(db,root,req)
        original.unlink()
        assert q.status_report(db)["states"]=={"PENDING":1}
        assert q.sha256_file(root/"blobs"/item["sha256"])==item["sha256"]
        db.close()
        db=q.queue_db(root)
        assert q.status_report(db)["states"]=={"PENDING":1}, "queue failed to persist"
        reads=iter([False,True])
        with patch.object(q,"verify_download",side_effect=lambda *x: next(reads)):
            with patch.object(q,"standard_upload") as upload:
                result=q.push(db,"https://example.supabase.co","dummy-private-token")
                assert upload.call_count == 1
                assert result[0]["status"]=="STORED_CATALOG_PENDING"
        assert q.status_report(db)["states"]=={"STORED_CATALOG_PENDING":1}
        assert "INCOMPLETE" in q.status_report(db)["archival_proof"]
        # Replaying the worker must never overwrite a confirmed original.
        with patch.object(q,"standard_upload") as upload:
            assert q.push(db,"https://example.supabase.co","dummy-private-token")==[]
            assert upload.call_count == 0
        db.close()
        db=q.queue_db(root)
        assert q.status_report(db)["states"]=={"STORED_CATALOG_PENDING":1}
        # Simulate failed remote read: the source must remain locally available.
        another=Path(temp)/"second.png"
        another.write_bytes(b"another historical document" * 100)
        req.file=str(another)
        req.asset_id="VP-PAR-05-SEBAI-VIS-TEST-02"
        second=q.enqueue(db,root,req)
        another.unlink()
        with patch.object(q,"verify_download",side_effect=RuntimeError("simulated network outage")):
            failed=q.push(db,"https://example.supabase.co","dummy-private-token")
            assert failed[0]["status"]=="RETRY_PENDING"
        assert q.sha256_file(root/"blobs"/second["sha256"])==second["sha256"]
        with patch.object(q,"verify_download",return_value=True):
            recovered=q.push(db,"https://example.supabase.co","dummy-private-token")
            assert recovered[0]["status"]=="STORED_CATALOG_PENDING"
        assert q.status_report(db)["states"]=={"STORED_CATALOG_PENDING":2}
        attempts=iter([(503,{},b"temporarily unavailable"),(201,{},b"ok")])
        with patch.object(q.time,"sleep"):
            response=q.retry_request(lambda: next(attempts),retries=3)
        assert response[0]==201
        db.close()
    print("PASS durable spool / failure recovery / transient retry / checksum / no false archive claim")

if __name__=="__main__":
    main()
