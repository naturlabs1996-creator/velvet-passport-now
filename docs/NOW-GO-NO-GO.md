# Paris NOW — Master Go / No-Go

Launch decision is based on traveler safety, operational reliability, and commercial integrity. A green build alone is not a launch approval.

## Decision states

- **PASS** — expected behavior verified.
- **DEGRADED** — primary path failed but a verified fallback preserved the traveler experience without fabrication.
- **FAIL** — incorrect, unsafe, misleading, or commercially dangerous behavior.
- **BLOCKED** — test cannot currently be executed because an external prerequisite is unavailable.

## Absolute NO-GO conditions

Paris NOW is **NO-GO** if any of the following is true:

1. A traveler can be shown stale or unverified ticket availability as bookable.
2. A provider failure creates a dead screen instead of a safe fallback.
3. NOW fabricates GPS, weather, opening hours, disruptions, availability, prices, or routing.
4. A route can silently consume the protected ticket margin.
5. Food or pharmacy can be inserted after it no longer fits the remaining protected time.
6. A double click can create two independent Stripe purchase attempts for the same intent.
7. A paid Pass can activate incorrectly, activate twice, or remain usable after authoritative revocation.
8. Critical commerce or Pass configuration is missing in production.
9. A red Health Engine state still reports the traveler as safe.
10. A critical regression appears after a correction elsewhere.

## Block A — NOW Engine

| Test | Expected result | Launch state |
|---|---|---|
| 2h20 available + rain + blocked street + pharmacy in 30m + Chinese food | One coherent route; pharmacy deadline protected; true Chinese choices only; blocked street avoided; optional stops dropped first | PENDING |
| GPS denied | No fabricated location and no proactive location-specific claim | PENDING |
| GPS outside Paris | Request rejected cleanly | AUTOMATED |
| Weather multi-source healthy | Green signal | PENDING |
| Weather single source | Amber, conservative wording | PENDING |
| Weather unavailable | Neutral route; no weather-specific claim | PENDING |
| Rain Ahead alert | Ask traveler before adjustment | PENDING |
| Rain Ahead unavailable | No alert; route preserved | PENDING |
| Disruption provider unavailable | Do not claim street is clear | PENDING |
| Transport PRIM unavailable | Clearly labelled estimate fallback | PENDING |
| Walking router unavailable | Deterministic estimate, marked fallback | PENDING |

## Block B — Live Needs

| Test | Expected result | Launch state |
|---|---|---|
| Pharmacy request | Open / usable choices prioritized; closing-too-soon filtered | PENDING |
| Food request | Up to 3 time-feasible choices | PENDING |
| Chinese request with no true match | No substitute presented | PENDING |
| Food would break protected margin | Food omitted; route stays safe | PENDING |
| Legacy “I’m hungry” | Same protected-time discipline as composable planner | PENDING |
| No usable live-need option | Explicit degraded or unavailable state; no fake choice | PENDING |

## Block C — Ticket Intelligence / Viator

| Test | Expected result | Launch state |
|---|---|---|
| 3 fresh verified offers | Exactly 3 displayed | PENDING |
| Only 1–2 verified offers | 0 displayed; degraded no-ticket fallback | AUTOMATED |
| Product removed | Removed immediately | PENDING |
| Slot disappears | Offer removed immediately | PENDING |
| Provider timeout | No stale evidence survives | PENDING |
| Price changes | Fresh price replaces old price; no inferred promotion | PENDING |
| Generic Viator URL | Rejected | PENDING |
| Sandbox data | Never booking-ready for traveler | PENDING |
| Direct booking future mode | `/availability/check` required immediately before booking | ARCHITECTURE LOCKED |

## Block D — Commerce / Stripe

| Test | Expected result | Launch state |
|---|---|---|
| Single purchase intent | One Checkout Session | PENDING |
| Rapid double-click | Same attempt; no duplicate independent Checkout | CODE HARDENED / PENDING RUNTIME |
| Two tabs, same plan, same intent window | Idempotent Checkout attempt | CODE HARDENED / PENDING RUNTIME |
| Payment interrupted | No false entitlement | PENDING |
| Async payment success | Entitlement becomes active only after authoritative event | PENDING |
| Async payment failure | No entitlement | PENDING |
| Refund / dispute | Entitlement revoked | PENDING |
| Activation | Starts clock once, explicitly | PENDING |
| Second activation attempt | Cannot reset or extend clock | PENDING |
| Stripe transient read failure with valid signed active pass | Traveler not stranded; controlled fail-open | PENDING |
| Stripe authoritative revoked state | Access denied | PENDING |
| Webhook configured on exact production origin | Required before GO | BLOCKED — exact origin / env setup |

## Block E — Health Engine

| Test | Expected result | Launch state |
|---|---|---|
| All primary providers healthy | Global GREEN | PENDING |
| Noncritical provider down with safe fallback | Global AMBER | PENDING |
| Critical component down without fallback | Global RED + `travelerSafe=false` | AUTOMATED CONTRACT / PENDING DEEP |
| Health endpoint without key | Hidden (404) | AUTOMATED |
| Component roll-up | One dominant status and reason per component | CODE COMPLETE |
| Auto-repair boundaries | No autonomous code/DB/payment/security mutation | ARCHITECTURE LOCKED |

## Block F — UX resilience

| Test | Expected result | Launch state |
|---|---|---|
| Browser Back during active flow | No corrupted state / no duplicate action | PENDING |
| Weak network | Loading state and recoverable retry | PENDING |
| Reconnect after temporary failure | Fresh revalidation, stale state discarded | PENDING |
| Multiple rapid actions | No duplicate commerce or route corruption | PENDING |
| Mobile layout | No title overflow, inaccessible button, or trapped navigation | PENDING |
| Health dashboard | Readable desktop/mobile; private key required | CODE COMPLETE / BUILD BLOCKED |

## Current blockers

- Vercel is currently refusing new builds because of the project/team build-rate limit. This is an external deployment quota condition, not a confirmed code failure.
- Exact production origin is still required to complete Stripe webhook configuration safely.
- `NOW_HEALTH_KEY`, provider keys, Stripe secrets and Pass secret must be present in the deployment environment before deep production health can return meaningful results.

## Launch rule

**GO** requires:

- No unresolved FAIL in Blocks A–F.
- All critical commerce, Pass and safety tests PASS.
- DEGRADED results only where the fallback is explicit, verified and traveler-safe.
- Stripe webhook live and tested without duplicate entitlement behavior.
- Global Health Engine can distinguish GREEN, AMBER and RED correctly.
- Final adversarial combined scenario passes.

Until then the product decision remains **NO-GO / TESTING**.
