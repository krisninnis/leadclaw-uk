# LeadClaw — Billing Lifecycle Audit & Repair

**Date:** 2026-06-18  **Scope:** Stripe checkout, portal, webhooks, trial system, subscription persistence, portal display, Supabase records, upgrades, cancellation, trial expiry. Builds on the already-deployed Stripe environment guard.

> Working-tree only. Nothing committed. Do not commit corrupted files — see Risk R1 and verify integrity per file before staging.

---

## 1. Verdict on the four suspected issues

| # | Suspected issue | Finding | Status |
|---|-----------------|---------|--------|
| 1 | `current_period_end` not persisted | **Confirmed.** Webhook never read/passed it; in Stripe SDK 20.4.1 (basil API) it lives on the subscription **item**, not the subscription. | **Fixed** |
| 2 | Duplicate subscriptions via Checkout | **Confirmed.** Checkout only blocked the *same-plan* active case, so an active subscriber could create a 2nd Stripe subscription (e.g. Growth→Pro) instead of using the Portal. | **Fixed** |
| 3 | Portal shows "Timing unavailable" | **Confirmed — same root cause as #1.** With `current_period_end` always null, active paid subs render "Timing unavailable" / "—". | **Fixed (via #1)** |
| 4 | `past_due` access rules | **Verified.** `past_due` grants full access (grace period) consistently in `subscription-access.ts` and the portal page, with a "Payment issue detected" notice. Behaviour is correct; no change made. | **Verified** |

---

## 2. Root causes

**RC-1 — `current_period_end` never persisted (drives bugs 1 & 3).**
`webhook/route.ts` built the `upsertStripeSubscription(...)` payload without `currentPeriodEnd`, even though `upsertStripeSubscription` already writes `current_period_end: toIso(input.currentPeriodEnd)`. Additionally, the SDK is **20.4.1** (basil API), where `current_period_end` was **removed from the Subscription object and moved to the subscription item** (`subscription.items.data[i].current_period_end` — confirmed in `node_modules/stripe/types/SubscriptionItems.d.ts`). So even a naive `sub.current_period_end` read would have been `undefined`.

**RC-2 — Checkout duplicate-subscription gap (bug 2).**
`checkout/route.ts` blocked only `existingStatus === "active" && existingPlan === requestedPaidPlan`. Any other case (active Growth → buy Pro, etc.) created a **second** live Stripe subscription. The trial gate (`trial-subscription-gate.ts`) already redirected active subscribers, but checkout had no equivalent guard.

---

## 3. Task 1 — every writer to `subscriptions.*` (traced)

| Writer | Columns written | Notes |
|--------|-----------------|-------|
| `lib/subscriptions.ts` → `upsertStripeSubscription` (called by webhook) | user_id, email, stripe_customer_id, stripe_subscription_id, stripe_price_id, plan, status, trial_end, **current_period_end (now fed)**, cancel_at_period_end | The only Stripe-state-driven writer. |
| `api/trial/start` | status=`trialing`, plan, trial_end=+7d, stripe_subscription_id=`trial_<uid>`, current_period_end=`null`, cancel_at_period_end=`true` | No-card trial; placeholder sub id. |
| `api/basic-signup` | plan=`basic`, status=`basic`, current_period_end=`null` | Free plan. |
| `api/billing/trial-run` (cron) | status=`expired`, plan=`basic` (on no-card trial expiry) | Does not touch current_period_end (correct). |
| `lib/trial-subscription-gate` → `buildTrialRedirectSubscriptionPatch` | status=`expired`, plan=`basic`, current_period_end=`null`, cancel_at_period_end=`true` | When a used trial re-enters. |
| `api/auth/callback` | current_period_end=`null` (+ account-link fields) | Account linking rows. |
| `api/account/delete`, `api/auth/check-account`, `api/retention/run`, `api/widget/*` | peripheral / reads or account-lifecycle | Not Stripe billing-state. |

Conclusion: Stripe-driven billing state flows through exactly one path (`upsertStripeSubscription`); the others deterministically set trial/basic/expired with `current_period_end = null` by design.

## Task 2 — webhook event → column mapping (after fix)

| Event | Handling |
|-------|----------|
| `checkout.session.completed` | Retrieves the subscription, upserts plan/status/price/customer/sub id, trial_end, **current_period_end**, cancel_at_period_end; provisions workspace; syncs application plan. |
| `customer.subscription.created` | **Newly handled** — same upsert path (covers portal/API-created subs). |
| `customer.subscription.updated` | Upserts status/plan/price/**current_period_end**/trial_end/cancel_at_period_end (upgrades, cancellations-at-period-end). |
| `customer.subscription.deleted` | Upsert sets status=`canceled` → `resolvedPlan` logic downgrades plan to `basic`. |
| `invoice.payment_failed` | Logs a billing warning (no row write). |

## Task 3 — persistence fixes
- **current_period_end**: now extracted via `getSubscriptionCurrentPeriodEnd(sub)` (item-level with legacy fallback) and passed on every subscription event.
- **trial_end** and **cancel_at_period_end**: already persisted by the webhook → verified correct, no change needed.

## Task 4 — duplicate prevention
`checkout/route.ts` now calls `shouldRedirectExistingToPortal(existing)`: if the most-recent matching row is a **real** Stripe subscription (`stripe_subscription_id` starts with `sub_`) and status is `active`/`trialing`/`past_due`, checkout returns `409 { error: "active_subscription_exists", usePortal: true }`. No-card trials (`trial_` placeholder) and canceled/basic rows are still allowed through (trial→paid conversion and resubscribe both preserved). `portal-plan-upgrade.tsx` shows a clear message for this case.

---

## 4. Files changed

**New**
- `src/lib/stripe-subscription.ts` — `getSubscriptionCurrentPeriodEnd()` (item-level read + legacy fallback).
- `src/lib/checkout-guard.ts` — `isRealStripeSubscriptionId()`, `shouldRedirectExistingToPortal()`.
- `src/__tests__/billing-lifecycle.test.js` — 10 regression tests.

**Modified**
- `src/app/api/stripe/webhook/route.ts` — added `customer.subscription.created`; pass `currentPeriodEnd` on all subscription upserts.
- `src/app/api/stripe/checkout/route.ts` — duplicate-subscription guard → Billing Portal.
- `src/components/portal-plan-upgrade.tsx` — message for `active_subscription_exists`.

**Recovered from mount NUL-corruption (your edited versions; de-NUL'd, unchanged in intent)**
- `src/lib/stripe-environment.ts`, `src/lib/app-url.ts`, `src/app/api/stripe/diagnostics/route.ts`, `src/__tests__/stripe-environment.test.js`.

---

## 5. Test results

```
jest billing-lifecycle billing-plans   -> 16 passed (10 new lifecycle + 6 plans)
jest trial-subscription-gate           -> 7 passed
jest stripe-environment                -> 4 passed (your simplified suite)
TOTAL                                  -> 27 passed, 0 failed
```
All 8 changed/new source files pass a TypeScript syntax check.

**Build:** `npm run build` is **environment-blocked in this sandbox** — only the Windows SWC binary (`@next/swc-win32-x64-msvc`) is installed; the Linux build needs `@next/swc-linux-x64-gnu`, which `next build` tries to fetch from `registry.npmjs.org` → `EAI_AGAIN` (no network). Run the full build on Vercel/CI, where the correct binary and network exist.

---

## 6. Remaining risks

- **R1 — Worktree NUL/truncation gremlin (CRITICAL).** During this session the mount silently injected NUL bytes / truncated files *after* they were written — including your own edited `stripe-environment.ts`, `app-url.ts`, `diagnostics/route.ts`, and `stripe-environment.test.js` (3402 NULs). All were recovered. **Before staging, verify each file:** `tr -cd '\000' < f | wc -c` is 0 and `tail -c 40 f` ends sensibly. Recovery recipe: `tr -d '\000' < f > tmp && cat tmp > f`. Safest path: commit/build on your own machine, not this mount.
- **R2 — `past_due` access duplicated.** The full-access rule is defined both in `subscription-access.ts` and inline in `portal/billing/page.tsx`; they agree today but can drift. Consolidate onto the lib.
- **R3 — Portal billing email match.** `portal/billing/page.tsx` queries `eq("email", user.email)` (not lowercased, not by `user_id`). If stored casing differs, the page could miss the row. Harden to match `user_id` OR lowercased email.
- **R4 — Webhook idempotency.** No dedup on Stripe `event.id`; retried deliveries reprocess. Low risk (upsert is idempotent) but worth a processed-events table.
- **R5 — current_period_end uses item[0].** Correct for single-plan Growth/Pro subscriptions; multi-item subscriptions would need per-item handling (not applicable today).
- **R6 — Trial-run vs real Stripe trials.** The cron downgrades any `trialing` row past `trial_end` to `expired/basic`. LeadClaw uses no-card trials (placeholder id), so this is safe; if real Stripe card-trials are ever introduced, gate the cron on `trial_` ids to avoid racing Stripe.

---

## 7. Recommended next actions

1. **Verify on Vercel** (the env guard is already live): run the full build, then a test-mode `4242` checkout on Preview and confirm the new row has a populated `current_period_end` and the portal shows the renewal date (closes bugs 1 & 3 end-to-end).
2. **UX polish:** have the upgrade UI auto-open the Billing Portal on `active_subscription_exists` (call `/api/stripe/portal`), and/or render `ManageBillingButton` on the billing page for active subscribers (it currently lives only on the portal home).
3. **Pin the Stripe API version** in `new Stripe(key, { apiVersion })` so future SDK upgrades don't silently move fields again (this is exactly how the `current_period_end` location changed).
4. **Add a webhook idempotency table** keyed on `event.id`.
5. **Consolidate access rules** into `subscription-access.ts` and import them in the portal page (removes R2).
