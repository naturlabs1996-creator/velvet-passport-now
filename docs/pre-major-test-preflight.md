# Paris NOW — pre-major-test runtime preflight

## Build
- Consolidated B→E build: green on Vercel after private preflight endpoint was added.
- `package-lock.json`: restored from project history and matches current package versions.

## Private runtime preflight
Endpoint: `/api/now/preflight`
Header: `x-now-health-key: <NOW_HEALTH_KEY>`

The endpoint never returns secret values. It returns only configuration presence/readiness and the normalized Viator mode.

## Required runtime configuration

### Core / access
- `NOW_HEALTH_KEY`
- `PARIS_NOW_PASS_SECRET`

### Stripe
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NOW_PUBLIC_ORIGIN`

Stripe Checkout uses two fixed live Paris NOW price IDs in `lib/stripe-now.ts`.
The production webhook path is `/api/now/stripe-webhook`.
Do not create/configure the webhook until the exact production origin has been confirmed.

### Viator
- `VIATOR_API_KEY`
- `VIATOR_API_MODE`
  - `sandbox` for major pre-launch tests
  - `production` only for actual traveler-facing live verification

### Transport
At least one of:
- `IDFM_PRIM_API_KEY`
- `PRIM_API_KEY`

### Weather
At least one deployment route to the weather model gateway must resolve via:
- `NOW_WEATHER_MODEL_GATEWAY`, or
- Vercel runtime host variables (`VERCEL_URL` / `VERCEL_PROJECT_PRODUCTION_URL`).

## Current Stripe webhook audit
The connected live Stripe account currently has a Parent Ready webhook only.
No Paris NOW webhook endpoint has been verified as present yet.

## Launch-test gate
Before the major quasi-live test campaign:
1. Call `/api/now/preflight` on the exact deployed NOW origin.
2. Require `criticalReady: true`.
3. Require `providerReady: true` for the planned test mode.
4. Call `/api/now/health` with the same private key and record the global/component states.
5. Create/verify the Stripe webhook only against the exact confirmed production origin.
