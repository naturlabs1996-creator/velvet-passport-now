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
        # Large-file TUS: recover an interrupted PATCH by reading server offset.
        large=Path(temp)/"large-map.tif"
        large.write_bytes(b"x"*(q.CHUNK+13))
        req.file=str(large)
        req.asset_id="VP-PAR-05-MAP-LARGE-TEST"
        entry=q.enqueue(db,root,req)
        large.unlink()
        state={"patches":0,"offset":0}
        location="https://example.storage.supabase.co/storage/v1/upload/resumable/test-123"
        def fake_request(method,url,token,data=None,extra=None,timeout=90):
            if method=="POST" and "/upload/resumable" in url:
                assert url.startswith("https://example.storage.supabase.co/")
                return (201,{"Location":location},b"")
            if method=="HEAD":
                return (204,{"Upload-Offset":str(state["offset"])},b"")
            if method=="PATCH":
                state["patches"] += 1
                if state["patches"]==1:
                    return (503,{},b"connection reset")
                state["offset"] += len(data)
                return (204,{"Upload-Offset":str(state["offset"])},b"")
            raise AssertionError("Unexpected method "+method)
        with patch.object(q,"request",side_effect=fake_request):
            with patch.object(q,"verify_download",side_effect=[False,True]):
                with patch.object(q.time,"sleep"):
                    transferred=q.push(db,"https://example.supabase.co","dummy-private-token")
        assert transferred[0]["status"]=="STORED_CATALOG_PENDING"
        assert state["patches"]==3, state
        assert state["offset"]==q.CHUNK+13
        assert q.sha256_file(root/"blobs"/entry["sha256"])==entry["sha256"]
        db.close()
    print("PASS spool / reconnect / HTTP retry / TUS resume / checksum / no false archive claim")

if __name__=="__main__":
    main()
