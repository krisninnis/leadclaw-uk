# LeadClaw — Efficiency & Maintainability Audit

**Date:** 2026-06-19
**Scope:** Full-project performance, cost, and maintainability review. **Read-only pass — no code changed, nothing staged or committed.**
**Codebase snapshot:** Next.js 16 (App Router) · React 19 · Supabase · Stripe · Upstash · Resend · Sentry. 324 TS/TSX files in `src/`, ~44.6k LOC.

---

## 1. Executive summary

The codebase is in better shape than its size suggests. The billing/plan layer is genuinely well-factored (clean central helpers in `lib/plans.ts`, `lib/subscription-access.ts`, `lib/billing-view.ts`, `lib/checkout-plans.ts`), auth is mostly centralised (`lib/api-auth.ts` `requireUser`/`requireAdmin`, used by ~26 routes), and the public SEO pages correctly use `force-static` so they never touch the database. There is no single catastrophic bottleneck.

The efficiency cost is spread across **repeated work that is never cached or shared**:

- The **same subscription row and the same "who is this workspace" lookup are re-queried on every portal navigation** — once in the layout, then again (sometimes twice) in each page. There is **zero use of React `cache()` or `unstable_cache` anywhere in the repo**, so nothing is deduped within a request.
- A handful of cron/automation routes contain **textbook N+1 loops** (a per-row `await` that fires 2 queries each), most clearly in the appointment-reminder job.
- Small **helpers are copy-pasted** rather than shared: `normalizeEmail` is redefined in 11 files, `escapeHtml` in 5, the email `from:` string in 4.
- One **live correctness bug**: `app/portal/billing/page.tsx` is **NUL-byte corrupted** (462 NUL bytes in a 10.8 KB file) — the known worktree gremlin struck again.
- **Schema and indexes live almost entirely outside the repo.** Only one migration file is committed (and it's buried at a doubled path). Index coverage on the hottest table (`subscriptions`) cannot be verified from source.

None of the top fixes require clever abstractions. They are: restore one corrupted file, batch two loops, wrap two reads in `cache()`, and extract three one-line helpers. These are small, testable, and remove duplicated work — exactly the brief.

**Headline numbers found**
- 191 service-role (`createAdminClient`) call sites; portal *read* pages use the admin (RLS-bypassing) client to read a user's own data.
- 291 `.from(` query sites; `subscriptions` queried directly in 20 files / 39 sites with **no shared getter**.
- 14 `await`-inside-loop sites; ~5 are true N+1, the rest are per-row writes that could batch.
- Largest files: `lib/ai-receptionist-pages.ts` (2,234 — static data), `components/landing/landing-page-editor.tsx` (1,157), `app/api/outreach/run/route.ts` (1,119).

---

## 2. Top 10 efficiency & maintainability opportunities

Each is rated **Impact** (perf/cost/maintainability benefit), **Risk** (of making the change), **Class** (Quick win / Medium refactor / Risky refactor / Do not touch yet), and **Timing** (safe now vs wait).

### #1 — Restore the corrupted billing page
- **What:** `app/portal/billing/page.tsx` contains 462 NUL bytes (binary-corrupted). It will not render/type-check correctly and any edit risks propagating corruption.
- **Files:** `src/app/portal/billing/page.tsx`
- **Impact:** High (a core authenticated page). **Risk:** Low. **Class:** Quick win. **Timing:** Safe now.
- **Fix:** Restore from the last clean commit (`git checkout -- src/app/portal/billing/page.tsx`) or rewrite from scratch, then re-validate with the NUL-scan before committing. See the worktree-corruption playbook already in the team memory.

### #2 — Add a request-cached `getSubscriptionForUser()` and stop re-querying
- **What:** `portal/layout.tsx` queries `subscriptions` by `email`; then `portal/page.tsx`, `portal/leads/page.tsx`, `portal/install/page.tsx` each query `subscriptions` **again** (leads and install query it *twice* — once user-scoped, once via admin). Same row, fetched 2–3× per page view. No caching exists.
- **Files:** `src/app/portal/layout.tsx`, `src/app/portal/page.tsx`, `src/app/portal/leads/page.tsx`, `src/app/portal/install/page.tsx`, `src/app/portal/billing/page.tsx` (+ new `src/lib/subscriptions-read.ts`)
- **Impact:** High (cuts portal DB reads ~50–66% per navigation; simplifies every portal page). **Risk:** Low–Med. **Class:** Medium refactor. **Timing:** Safe now (after #1).
- **Fix:** One helper `getSubscriptionForUser(userId, email)` wrapped in React `cache()` so repeated calls in the same render are deduped. Standardise the lookup **key** (today layout uses `email`, pages use `user_id` then `email` — pick one, prefer `user_id` with `email` fallback).

### #3 — Batch the appointment-reminder N+1
- **What:** `getWorkspaceName(clinicId)` runs **2 sequential queries per appointment** (`onboarding_sites` → `onboarding_clients`), inside two separate loops (48h + 2h). For N due appointments that's up to ~4N queries before any email is sent.
- **Files:** `src/app/api/appointments/remind/run/route.ts` (loops at lines ~134 and ~193, helper at ~104)
- **Impact:** Med–High on cron latency/cost (scales with volume). **Risk:** Low. **Class:** Quick win. **Timing:** Safe now — but **do not execute the route** while testing (it sends email).
- **Fix:** Collect all `clinic_id`s up front, fetch sites with `.in("clinic_id", ids)` and clients with `.in("id", clientIds)`, build a `Map`, resolve names from memory in the loop.

### #4 — Centralise the "resolve workspace from user" chain
- **What:** The chain `user.email → onboarding_clients → onboarding_sites → clinic_id` is reimplemented in `portal/page.tsx`, `portal/leads/page.tsx`, `portal/install/page.tsx` (and partially in crons). It's the single most duplicated multi-query pattern in the app.
- **Files:** `src/app/portal/page.tsx`, `src/app/portal/leads/page.tsx`, `src/app/portal/install/page.tsx` (+ new `src/lib/workspace.ts`)
- **Impact:** High (maintainability) + Med (perf, when combined with `cache()`). **Risk:** Med. **Class:** Medium refactor. **Timing:** Safe now, do **after** #2 so both share the cached-read pattern.
- **Fix:** `resolveWorkspaceForUser(email)` returning `{ clinicId, siteId, domain }`, wrapped in `cache()`.

### #5 — Extract the copy-pasted micro-helpers
- **What:** `normalizeEmail` defined in **11** files, `escapeHtml` in **5**, the literal `from: "LeadClaw <hello@leadclaw.uk>"` in **4**, and `subscriptions.ts` re-declares `normalizePlan`/`normalizeStatus` that already exist in `subscription-access.ts`.
- **Files (representative):** `lib/lead-enrichment.ts`, `lib/subscriptions.ts`, `lib/email.ts`, `app/api/stripe/checkout/route.ts`, `app/api/leads/import/route.ts`, `app/api/outreach/run/route.ts`, `app/api/webhooks/resend/route.ts`, `app/api/appointments/remind/run/route.ts`, `app/api/appointments/review/run/route.ts`, `app/api/enquiries/follow-up/run/route.ts`, `app/api/widget/submit/route.ts`, `lib/onboarding.ts`
- **Impact:** Med (maintainability; one bug fix instead of 11). **Risk:** Low. **Class:** Quick win. **Timing:** Safe now.
- **Fix:** `lib/text.ts` (`escapeHtml`), `lib/email-address.ts` (`normalizeEmail`/`isValidEmail`), and an `EMAIL_FROM` constant in `lib/email.ts`. Re-export the existing `normalizePlan`/`normalizeStatus` instead of redefining.

### #6 — Fix the `createAdminClient` null-cast footgun
- **What:** On missing env the non-optional overload returns `null as unknown as AdminClient` — the **type claims non-null but the value is null**. Callers that don't add a runtime `if (admin)` guard will throw "Cannot read properties of null (reading 'from')". 191 call sites depend on this.
- **Files:** `src/lib/supabase/admin.ts` (+ audit of unguarded callers)
- **Impact:** Med (correctness/robustness). **Risk:** Low. **Class:** Quick win. **Timing:** Safe now.
- **Fix:** Either make the function **throw** a clear error when env is absent, or make the return type honestly `AdminClient | null` everywhere and let TS force the guards. Don't lie in the type.

### #7 — Flatten / split the 1,119-line outreach route
- **What:** `app/api/outreach/run/route.ts` is one file with ~30 helper functions plus message templates, and sends emails + inserts `outreach_events` **one lead at a time** in a sequential loop (intentional pacing via `sleep`, so the loop itself is defensible). The problem is size and blast radius, not the pacing.
- **Files:** `src/app/api/outreach/run/route.ts`
- **Impact:** Med (maintainability/testability of the revenue engine). **Risk:** Med (it sends outreach). **Class:** Medium refactor. **Timing:** **Wait** — extract pure helpers (message rendering, email validation, filter counts) into `lib/outreach/*` behind unit tests **first**; never run the route to "test" it.
- **Fix:** Move the pure functions (`renderInitialMessage`, `renderFollowUp*`, `isBadEmail`, `buildOutreachFilterCounts`, `complianceFooter`) into tested modules; keep the route as orchestration only.

### #8 — Stop using the service-role client to read a user's own data
- **What:** Portal *read* pages (`portal/page.tsx`, `portal/leads`, `portal/install`) use `createAdminClient()` (service role, **bypasses RLS**) to read subscriptions/enquiries by email. That's 191 admin call sites overall; many reads don't need elevation.
- **Files:** `src/app/portal/page.tsx`, `src/app/portal/leads/page.tsx`, `src/app/portal/install/page.tsx` (pattern), `src/lib/supabase/admin.ts`
- **Impact:** Med (security posture + maintainability) — not a raw speed win. **Risk:** High (requires correct RLS policies before switching). **Class:** Risky refactor. **Timing:** **Do not touch yet** — depends on RLS being defined and tested in Supabase first.
- **Fix:** Use the user-scoped server client for "my own data" reads once RLS policies exist; reserve the admin client for genuine cross-tenant/cron work.

### #9 — Bring the schema & indexes into the repo; verify hot-path indexes
- **What:** Only **one** migration is committed (`.../migrations/supabase/migrations/20260307_add_clinics_and_enquiries.sql`), and it sits at a **doubled path**. It indexes `onboarding_sites(clinic_id)` and `enquiries(clinic_id, id)` — good — but `subscriptions`, `profiles`, `leads`, `widget_tokens`, `onboarding_clients`, `outreach_events` aren't defined in-repo, so their indexes can't be reviewed in PRs.
- **Files:** `src/lib/supabase/migrations/...` (structure), Supabase dashboard (verification)
- **Impact:** High (a missing `subscriptions(email)` index would slow the single hottest query path) + Med (maintainability). **Risk:** Low to verify; Med to add indexes. **Class:** Medium refactor. **Timing:** Safe now to **audit**; add indexes during a low-traffic window.
- **Verify these are indexed:** `subscriptions(email)`, `subscriptions(user_id)`, `subscriptions(stripe_subscription_id)`, `subscriptions(stripe_customer_id)`, `onboarding_clients(contact_email)`, `onboarding_sites(onboarding_client_id)`, `widget_tokens(onboarding_site_id, status)`, `enquiries(created_at)`.

### #10 — Generate Supabase types; retire `as unknown as SupabaseUntypedClient`
- **What:** Almost every DB call is cast through a hand-written `SupabaseUntypedClient`, so column typos and shape drift aren't caught at compile time — a recurring maintenance tax.
- **Files:** `src/types/supabase-untyped.d.ts` and ~all DB call sites
- **Impact:** Med–High (maintainability; prevents a class of runtime bugs). **Risk:** Low (additive) but broad. **Class:** Medium refactor. **Timing:** Safe now, incremental.
- **Fix:** `supabase gen types typescript` into `src/types/supabase.ts`, type the clients, migrate call sites file-by-file (start with billing/subscription).

---

## 3. Findings classified

| Class | Findings |
|---|---|
| **Quick win** | #1 corrupted file · #3 reminder N+1 · #5 duplicated helpers · #6 admin null-cast · housekeeping (dead files, below) |
| **Medium refactor** | #2 cached subscription getter · #4 workspace resolver · #7 split outreach route · #9 schema/indexes in-repo · #10 generated types · portal client→server pages (below) |
| **Risky refactor** | #8 admin-client → RLS reads |
| **Do not touch yet** | #8 (until RLS exists) · #7 route body (extract helpers first, never run it) |

**Additional smaller items (not in the top 10):**
- **Dead/cruft files** to remove: `__probe_delete_test`, `tsconfig.queue.tmp.tsbuildinfo`, the stray root file literally named `idebar nav, mascots, pricing refactor, portal and widget polish"`, and the empty `.gitmodules`. *(Quick win, safe now.)*
- **Inline auth in ~8 routes** still call `supabase.auth.getUser()` directly instead of `requireUser()` from `lib/api-auth.ts`. Standardise. *(Quick win.)*
- **Portal pages as client components doing client-side fetch:** `app/portal/profile/page.tsx` (292 LOC, `"use client"` + `fetch`) and `app/portal/settings/page.tsx` (177 LOC). Candidates to render server-side (less JS shipped, fewer round-trips). *(Medium.)*
- **`portal/page.tsx` sequential waterfall:** ~6 dependent awaits before the closing `Promise.all`. Some are inherently chained (client→site→clinic), but the subscription read is independent and can run in parallel with the workspace lookup. *(Medium, folds into #2/#4.)*
- **Per-row writes in loops** (`ops/hygiene/run`, `retention/run`, `onboarding/run`, `outreach/backfill`, `billing/trial-run`): correctness-fine for cron, but batchable later if volumes grow. *(Do not touch yet — low priority.)*

---

## 4. Recommended first 5 fixes (in order)

1. **#1 Restore `portal/billing/page.tsx`** — unblocks everything else and removes a live correctness bug. *(Quick win, ~20 min + validation.)*
2. **#5 Extract `escapeHtml` / `normalizeEmail` / `EMAIL_FROM`** — pure mechanical dedupe, immediately testable, touches no behaviour. *(Quick win.)*
3. **#6 Make `createAdminClient` honest** (throw or `| null`) — removes a latent crash class before you build more on top of it. *(Quick win.)*
4. **#3 Batch the appointment-reminder N+1** — the clearest, safest perf win; pure read-batching with a unit-testable helper. *(Quick win — do **not** run the route; test the batching helper in isolation.)*
5. **#2 `getSubscriptionForUser()` + React `cache()`** — the highest-leverage structural win; halves portal read load and sets the pattern reused by #4. *(Medium.)*

Leave #7, #8, #9, #10 for a second pass once tests exist and (for #8) RLS is in place.

---

## 5. Tests to add **before** changing code

These lock in current behaviour so the refactors above are provably safe. The repo already uses Jest + Testing-Library with good coverage on landing/outreach helpers — extend the same patterns.

1. **Subscription access matrix** — table-driven test over `canAccessPortal` / `hasFullLeadClawAccess` / `isLimitedSubscription` / `deriveBillingView` for every `{status × plan}` combo (`trialing/active/past_due/expired/canceled/none` × `basic/growth/pro`). Guards #2 and any plan/status touch. *(Unit — `lib/subscription-access.ts`, `lib/billing-view.ts`.)*
2. **`getWorkspaceName` / workspace resolver** — given seeded `onboarding_sites` + `onboarding_clients`, assert the resolved name; add a **query-count assertion** (mock the client) so the N+1→batch change in #3/#4 is verified to reduce calls. *(Unit with mocked Supabase.)*
3. **`normalizeEmail` / `escapeHtml` characterization** — snapshot current outputs across each of the 11/5 current copies, then assert the single shared helper matches all of them before deleting the duplicates. *(Unit — protects #5.)*
4. **`createAdminClient` env-missing behaviour** — assert the chosen contract (throws, or returns `null`) with env unset, and that a representative caller degrades gracefully. *(Unit — protects #6.)*
5. **Outreach pure helpers** — `renderInitialMessage`, `renderFollowUp1/2`, `isBadEmail`, `complianceFooter`, `buildOutreachFilterCounts` extracted and snapshot-tested **before** the route is split (#7). No network, no sends. *(Unit.)*
6. **Portal page smoke/integration** — render `portal/page.tsx` and `portal/leads` with a mocked Supabase and assert the number of `subscriptions` reads (should drop after #2). Catches accidental re-introduction of duplicate fetches. *(Integration.)*

> For the highest-risk items (#7 outreach, #8 RLS), run the verification as a separate focused review/sub-agent pass after tests are green — these touch sending and tenant isolation.

---

## 6. Guardrails honoured this pass

No code was edited, staged, or committed. No outreach was run, no emails sent, no Stripe calls made. No secrets are reproduced in this report. Unrelated WIP was not touched. All findings are read-only observations with file/line references for follow-up.
