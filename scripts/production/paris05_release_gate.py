#!/usr/bin/env python3
"""Fail-closed documentary commercial release gate for Paris 05."""
import json,sys
from pathlib import Path
path=Path(sys.argv[1] if len(sys.argv)>1 else 'docs/production/paris05-commercial-release-evidence.json')
e=json.loads(path.read_text())
checks=('fr_audio_listening_approved','en_audio_listening_approved','fr_subtitles_proofread','en_subtitles_proofread','fr_video_qa_approved','en_video_qa_approved','mastodon_assets_physical_receipts_verified','stop_to_asset_image_cues_complete','retained_visuals_identity_and_context_verified','retained_visuals_commercial_rights_verified','all_unlicensed_visuals_replaced','fr_voice_commercial_rights_verified','en_voice_commercial_rights_verified','credits_and_attributions_verified','publisher_explicit_release_approval')
bad=[k for k in checks if e.get('evidence',{}).get(k,{}).get('approved') is not True or not e.get('evidence',{}).get(k,{}).get('reference')]
print(json.dumps({'route':'VP-PAR-05','commercial_release_ready':not bad,'blocked_checks':bad},indent=2))
sys.exit(1 if bad else 0)
