# LeadClaw — Stripe Billing Audit, Repair & Verification

**Date:** 2026-06-18  **Branch:** `strip` (uncommitted)  **Scope:** full Stripe billing system (checkout, portal, webhook, subscription sync, env handling).

---

## 1. Verdict

The billing **code is fundamentally sound**. The reported symptom — a **Preview deployment minting `cs_live_` sessions** — is **not a code bug in the routes**; it is a **credential-binding defect**: the app trusted Vercel environment scoping with **no runtime check that the Stripe key's mode (live/test) matched the deployment environment**. A live `STRIPE_SECRET_KEY` reaching the Preview runtime therefore silently produced live Checkout Sessions.

This has been **fixed at the engineering level** (fail-closed guard) so it can never happen silently again, and a **safe diagnostics endpoint** has been added to prove the live state. The remaining root-cause action is an **environment-variable scoping correction in Vercel** (Section 8), which needs to be done in the Vercel dashboard.

### Success criteria status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Growth (£79) checkout works | Code path verified; needs live confirm |
| 2 | Pro (£149) checkout works | Code path verified; needs live confirm |
| 3 | Stripe **test** mode works in Preview | **Fix enables this**; confirm via diagnostic |
| 4 | Stripe **live** mode works in Production | Code path verified; confirm via diagnostic |
| 5 | Webhooks update Supabase | Code verified correct; needs live event |
| 6 | Billing page reflects subscriptions | Code verified correct |
| 7 | E2E checkout proven | **Pending live run** (diagnostic + 4242) |
| 8 | Root cause identified & documented | **Done** (Sections 2–3) |

---

## 2. Root cause (proven by elimination)

`getStripe()` did exactly this:

```ts
const key = process.env.STRIPE_SECRET_KEY;
if (!key) return null;
return new Stripe(key);   // mode of every session = mode of this key
```

The mode of every Checkout Session (`cs_test_` vs `cs_live_`) is decided **solely** by which secret-key string is present in `process.env` at runtime. The audit ruled out every other source:

- **No hardcoded keys** anywhere in `src` (grep for `sk_live_/sk_test_/pk_/whsec_/price_…` → none).
- **No committed env files** with secrets — only `.env.example` is tracked; `.gitignore` excludes `.env*`. The local `.env` contains **no Stripe variables at all**.
- **No build-time inlining** of the secret — it is server-only and read at runtime. The one module-level constant (`PRICE_IDS` in `stripe.ts`) was **dead/unused** and also read runtime env. (Removed.)
- **A single Stripe client** — exactly one `new Stripe(` (in `stripe.ts`), used by both checkout and portal. No alternate client, no edge runtime on the Stripe routes.
- `VERCEL_URL` is used only for base-URL building (`src/lib/config.ts`), never for key selection.

**Therefore:** a Preview deployment producing `cs_live_` proves, with certainty, that the **live `STRIPE_SECRET_KEY` is present in the Preview deployment's runtime environment**. Since the code cannot choose this, the live credential is being injected into Preview by Vercel. Two concrete mechanisms (both "Preview inherits Production"):

1. **Live `STRIPE_SECRET_KEY` / `STRIPE_PRICE_*` scoped to "All Environments"** (or Preview is ticked) in Vercel. Preview then gets the live values; the intended test values were never saved to the Preview scope (or were saved to a branch that isn't the one deployed, or couldn't override the All-Environments value).
2. **The URL being tested as "Preview" is actually a Production build/alias** (stale or mis-pointed deployment), so it legitimately uses live keys.

The **engineering root cause** is the missing fail-safe: the system never asserted key-mode == deployment-env. That is what allowed a live key to silently mint `cs_live_` in Preview. The diagnostic in Section 7 distinguishes mechanism (1) from (2) on the live deployment.

---

## 3. Investigation requirements — answered

1. **Which deployment is being tested?** Cannot be determined from the repo; the diagnostic reports `VERCEL_ENV` + `VERCEL_URL` + git SHA so you can confirm on the live URL.
2. **Which Stripe key is used at runtime?** Whatever `process.env.STRIPE_SECRET_KEY` resolves to in that deployment — sourced exclusively from Vercel. Diagnostic reports its mode (live/test) without exposing it.
3. **Which price IDs at runtime?** `STRIPE_PRICE_GROWTH` / `STRIPE_PRICE_PRO`, resolved server-side at request time via `getStripePriceIdForPlan(plan, process.env)`. Not `NEXT_PUBLIC`, not inlined.
4. **Build vs deploy vs runtime?** Secret key + price IDs = **runtime** (Node serverless). Only `NEXT_PUBLIC_*` values are build-time inlined, and none of those feed checkout. The dead `PRICE_IDS` const was module-load (still runtime in serverless) — removed regardless.
5. **Preview inheriting Production variables?** This is the most likely mechanism. Confirm via the diagnostic / Vercel env scoping (Sections 7–8).
6. **Hardcoded values?** None.
7. **Stale deployments?** Possible (mechanism 2); diagnostic's `VERCEL_ENV` + git SHA settles it.
8. **Different Stripe client than expected?** No — single client via `getStripe()`.

---

## 4. Files changed

**Created**
- `src/lib/stripe-environment.ts` — key-mode + deployment-env detection and the fail-closed evaluation.
- `src/lib/app-url.ts` — environment-correct base-URL resolver for redirects/return URLs.
- `src/app/api/stripe/diagnostics/route.ts` — safe, admin/token-gated diagnostics (no secrets).
- `src/__tests__/stripe-environment.test.js` — 13 tests for the guard + URL resolver.

**Modified**
- `src/lib/stripe.ts` — `getStripe()` now fails closed on a key/env mismatch; removed dead `PRICE_IDS`.
- `src/app/api/stripe/checkout/route.ts` — uses `getAppBaseUrl()` for success/cancel URLs.
- `src/app/api/stripe/portal/route.ts` — uses `getAppBaseUrl()` for the return URL.
- `src/app/api/basic-signup/route.ts` — uses `getAppBaseUrl()` for the invite redirect.
- `.env.example` — documents the live/test contract + `STRIPE_ALLOW_MODE_MISMATCH`.

**Recovered (worktree corruption — see Risk R1)**
- `package.json` — working copy was **truncated** (missing `optionalDependencies` + closing brace; 1280 vs 1306 bytes). Restored from the git index.

---

## 5. The fix

### 5.1 Fail-closed environment guard (`src/lib/stripe-environment.ts` + `getStripe()`)
- Detects key mode from prefix (`sk_/rk_/pk_` × `live/test`).
- Detects deployment env from **`VERCEL_ENV`** — deliberately **not** `NODE_ENV`, because Vercel Preview builds also run with `NODE_ENV=production` (the classic trap). Anything not explicitly `production`/`preview` is treated as `development`.
- Production expects **live**; Preview/Development expect **test**.
- On mismatch, `getStripe()` **returns `null`** (callers already surface this as `stripe_not_configured`) and logs a non-secret reason. A live key in Preview can no longer create `cs_live_`.
- Escape hatch `STRIPE_ALLOW_MODE_MISMATCH=true` for non-Vercel hosting where `VERCEL_ENV` is absent.

### 5.2 Diagnostics endpoint (`/api/stripe/diagnostics`)
- Gated by an authenticated admin session **or** header `x-diagnostics-token: <ADMIN_EXPORT_TOKEN>`.
- Returns `VERCEL_ENV`, `VERCEL_URL`, git ref/SHA, secret-key **mode**, publishable-key mode, webhook-secret presence, **masked** price IDs, consistency + blocked flags, and a plain-English `cs_test_`/`cs_live_` expectation. **No secret is ever returned.**

### 5.3 Base-URL correctness (`src/lib/app-url.ts`)
- Billing routes previously read `NEXT_PUBLIC_APP_URL` and fell back to `http://localhost:3000` — so a Preview checkout's success/cancel URLs left the deployment or hit localhost, making Preview E2E impossible. New resolver: production → configured custom domain (unchanged); **preview → the deployment's own `VERCEL_URL`**; dev → localhost. Production behaviour is byte-for-byte unchanged when `NEXT_PUBLIC_APP_URL` is set.

### 5.4 Dead-code removal
- Removed the unused `PRICE_IDS` export (confirmed no importers repo-wide).

---

## 6. Test results

```
npx jest src/__tests__/stripe-environment.test.js src/__tests__/billing-plans.test.js
  PASS  billing-plans.test.js
  PASS  stripe-environment.test.js
  Tests: 19 passed, 19 total
```

Key assertions proven:
- **live key + Preview → blocked** (the reported bug, now prevented).
- test key + Preview → allowed; live key + Production → allowed; test key + Production → blocked.
- `NODE_ENV=production` alone is **never** treated as a production deployment.
- `getAppBaseUrl` uses the Preview URL on preview and the custom domain in production.

`trial-subscription-gate.test.js` also passes. All 7 changed/created billing source files pass a TypeScript syntax check.

> Note: a full `next build` was **not** completed in the audit sandbox — `tsc` over the whole project runs ~40s and the worktree carries pre-existing corruption in unrelated files and stale `.next` artifacts. Run `npm run build` in CI/Vercel. The only project-source type errors `tsc` reported were the two truncation errors this audit then fixed (`checkout/route.ts`, `basic-signup/route.ts`).

---

## 7. How to verify on the live deployments

After deploying this branch to Preview (and Production), confirm the root cause and the fix:

### A. Fastest proof — Vercel dashboard (no deploy needed)
Project → Settings → Environment Variables. For `STRIPE_SECRET_KEY`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_PRO` check the **Environments** column:
- If any **live** value is scoped to **Preview** (or "All Environments") → that is the leak (mechanism 1).
- Preview values should be `sk_test_…` + test price IDs; Production values `sk_live_…` + live price IDs.

### B. Runtime proof — diagnostics endpoint (after deploying this branch)
```
# In a browser, logged in as an admin:
https://<preview-url>/api/stripe/diagnostics
https://<production-url>/api/stripe/diagnostics

# Or via curl (requires ADMIN_EXPORT_TOKEN set for that environment):
curl -s -H "x-diagnostics-token: $ADMIN_EXPORT_TOKEN" https://<preview-url>/api/stripe/diagnostics | jq
```
**Expected, healthy:**
- Preview → `vercelEnv:"preview"`, `secretKeyMode:"test"`, `consistent:true`, expectation `cs_test_`.
- Production → `vercelEnv:"production"`, `secretKeyMode:"live"`, `consistent:true`, expectation `cs_live_`.

**If still broken:** Preview will show `secretKeyMode:"live"` + `blocked:true` — confirming the live key is in Preview.

### C. E2E checkout (test card 4242 4242 4242 4242)
On Preview (test mode): start Growth checkout → session URL should be `cs_test_…` → pay with `4242 4242 4242 4242`, any future expiry/CVC → redirect to `/portal?checkout=success`. Then verify:
- **Stripe (test dashboard):** subscription created on the test price.
- **Webhook:** Stripe → Developers → Webhooks → the `checkout.session.completed` delivery shows **HTTP 200**.
- **Supabase:** `subscriptions` row for that email has `status=active|trialing`, correct `plan`, `stripe_customer_id` (`cus_…`), `stripe_subscription_id` (`sub_…`).
- **Portal:** `/portal/billing` shows the plan + "Manage billing" opens the Stripe portal.

---

## 8. Vercel environment remediation (the production-side fix)

1. Remove any **live** Stripe values from the **Preview** and **Development** scopes.
2. Set, scoped to **Production only**: `STRIPE_SECRET_KEY=sk_live_…`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_…`, `STRIPE_PRICE_GROWTH`/`STRIPE_PRICE_PRO` = live price IDs, `STRIPE_WEBHOOK_SECRET` = live endpoint secret.
3. Set, scoped to **Preview (+ Development) only**: the `sk_test_…` / `pk_test_…` keys, **test** price IDs, and the **test** webhook secret.
4. Never use "All Environments" for Stripe variables.
5. Redeploy Preview and Production, then re-run Section 7. With this fix in place, even a future misconfiguration is blocked at runtime by the guard rather than silently charging live.

---

## 9. Remaining risks

- **R1 — Worktree corruption (CRITICAL).** The working tree carries NUL-byte/truncation corruption (`package.json` was truncated; `portal/route.ts` had NUL bytes; `checkout` + `basic-signup` were truncated by the editor during this session and rewritten cleanly). **If the corrupted working tree is committed, the Vercel build will fail.** Recommend: run a repo-wide scan for NUL bytes and truncated files, or re-clone from origin, before committing. The git **index** copy of `package.json` is clean.
- **R2 — Billing page email casing.** `portal/billing/page.tsx` queries `subscriptions` by `eq("email", user.email)` (not lowercased) and not by `user_id`. If stored email casing differs, the page could miss the row. Low risk (Supabase emails are usually normalized) but worth hardening to match by `user_id` OR lowercased email.
- **R3 — `config.ts#getAppUrl()` ordering.** It prefers `VERCEL_URL` even in production, so callers other than the billing routes may emit the `*.vercel.app` URL instead of the custom domain in prod. Out of billing scope but worth aligning with `getAppBaseUrl()`.
- **R4 — Fail-closed in production.** A test key in Production now disables checkout (by design). Intentional and safe; flip `STRIPE_ALLOW_MODE_MISMATCH=true` only as a deliberate, temporary override.
- **R5 — Early-access gating.** `portal-plan-upgrade.tsx` hides real checkout when `NEXT_PUBLIC_EARLY_ACCESS_MODE=true`. Ensure this flag is set as intended per environment when testing checkout.
- **R6 — Stale `.git/index.lock`.** A leftover lock blocks git operations; remove it if no git process is running.

---

## 10. Recommended next improvements

1. **Add an integration test** that imports the checkout route with a mocked Stripe + `VERCEL_ENV=preview` + a live key and asserts it returns `stripe_not_configured` (locks in the fix end-to-end).
2. **Surface the guard to ops** — emit a Sentry event (not just `console.error`) when `evaluateStripeEnvironment().blocked` fires, so a misconfigured deploy alerts immediately.
3. **Webhook idempotency** — record processed Stripe `event.id`s to make retried deliveries safe.
4. **Persist `current_period_end`** from subscription events (webhook currently passes it through `upsert` only when present; the billing page already reads it).
5. **CI guard** — a lint/test step that fails if a `sk_live`/`pk_live` literal or an env file with secrets is ever committed, plus a NUL-byte/truncation check to catch R1 automatically.
6. **Pin the Stripe API version** in `new Stripe(key, { apiVersion })` for deterministic behaviour across SDK upgrades.
