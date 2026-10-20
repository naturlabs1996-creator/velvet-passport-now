# Paris 05 — FR V4 — QA technique du rendu natif (2026-10-20)

GitHub Actions run: https://github.com/naturlabs1996-creator/velvet-passport-now/actions/runs/39438033625
Status: SUCCESS (11 of 11 jobs, 11 non-empty artifacts).
Reference voice: Developer-1; tempo 1.00; sample rate 24000 Hz; no time stretch.
Locked manifest sha256 (as measured): 6c1322b97c93affd56df3cc073d80f4074426303d3a7e1e814faf45e43ac6eec

| Segment | Seconds | Peak absolute | Stop >= 300s |
|---|---:|---:|---|
| INTRO | 120.30 | 0.8399 | n/a |
| STOP-01 Appert | 479.32 | 0.8838 | PASS |
| TRANSITION-01-SEBAI | 109.68 | 0.8992 | n/a |
| STOP-SEBAI-1977 | 733.92 | 0.9624 | PASS |
| TRANSITION-01-02 | 28.96 | 0.7552 | n/a |
| STOP-02 Malmaison | 489.30 | 0.9493 | PASS |
| TRANSITION-02-03 | 126.78 | 0.7702 | n/a |
| STOP-03 Kommandantur | 506.62 | 0.9788 | PASS |
| TRANSITION-03-04 | 120.10 | 0.9683 | n/a |
| STOP-04 Beaufort/Nemours | 883.70 | **1.0110** | PASS duration; **HOLD signal clipping headroom** |
| OUTRO | 81.12 | 0.7192 | n/a |

**Total rendered duration:** 3679.80s = 61m 19.8s (before compositing).

## QA verdict
- **PASS:** 11/11 jobs and artifacts; measured duration; five stops >= 5 minutes; native tempo 1.00; uniform manifest hash; no modifications to locked script.
- **HOLD:** STOP-04 absolute peak >1.0 (1.011) indicates potential clipping and requires inspection, safe gain/limiter and post-correction waveform QA. Actual clipped sample count and true peak not measured.
- **PENDING:** human listening for prosody/artifacts/pronunciation; integrated assembly/transitions; rights for commercial cloned voice; audiovisual asset rights; any FR/EN adaptation.
- Do not label finished masters PRODUCTION-READY until all checks pass.
