#!/usr/bin/env python3
"""Check that the user-flagged misattributed Sebaï portrait is rejected by ID/hash."""
from paris05_image_exclusion import excluded

KNOWN_HASH="1f892f203e6c8ec1371634d9cd0c65d2ae4ab3284eb6bbd379e40d916af6c72d"

def test():
    assert excluded(sha256=KNOWN_HASH) is not None
    assert excluded(filename="1000013340.png") is not None
    assert excluded(asset_id="portrait-marc-ducarre-dst") is not None
    assert excluded(asset_id="portrait-marc-dufarre-dst") is not None
    assert excluded(asset_id="APPERT-NEUF-1867") is None
    assert excluded(asset_id="OPERA-1900") is None
    print("PASS: discredited portrait SHA-256, file name and name aliases blocked; legitimate images unaffected")

if __name__=="__main__":
    test()
