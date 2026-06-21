# Engineering Stability Audit — LeadClaw UK

**Date:** 2026-06-18
**Scope:** Full repository scan — build blockers, git hygiene, test coverage.
**Branch state at scan:** 188 files dirty in `git status`; HEAD vs working tree diverge significantly (see Git Hygiene).
**Mode:** Read-only. No code modified.

---

## How to read this

Every finding lists: **file** · **line** · **risk** · **recommended fix**.
Severity = blast radius × likelihood of hitting production/CI.

- **Critical** — breaks the build/deploy or corrupts money/lead data right now.
- **High** — will break CI, reviews, or a critical flow soon; silent data risk.
- **Medium** — real debt that degrades reliability or review quality.
- **Low** — cleanliness; fix opportunistically.

> **Tooling note / limitation:** Full-project `tsc --noEmit` and `eslint` both exceed the 45s sandbox execution ceiling and could not be run to completion here. Findings below come from targeted static analysis (byte-level file inspection, import resolution, route/handler parsing, git plumbing). The truncated-file blocker (C-1) means a clean full `tsc`/`next build` **cannot currently pass** — fix C-1 first, then run the full suite in CI to enumerate any residual type errors.

---

## CRITICAL

### C-1 — Truncated, uncommitted API route will fail the build
- **File:** `src/app/api/leads/import/route.ts`
- **Line:** 235 (end of file)
- **Risk:** The working-tree copy is **cut off mid-statement**. The file ends literally at:
  ```
  const { error } = await (admin as unknown as SupabaseUntypedClient)
    .from("le
  ```
  (6,450 bytes, no closing of the string, call, `try/catch`, or function). This is a hard syntax error — `next build`, `tsc`, and `jest` on this module all fail. The committed HEAD version (6,434 bytes) is intact and ends correctly with a `catch (e: unknown)` block, so the corruption lives **only in the uncommitted working copy**. If this tree is committed or built as-is, the deploy breaks. The leads-import path is also a core data-entry route.
- **Fix:** Restore the file from HEAD (`git checkout -- src/app/api/leads/import/route.ts`) or re-apply the intended edit in full and confirm it ends with the complete `try/catch` and `}` before committing. Add a CI guard that rejects files which don't parse (a `tsc --noEmit` gate on PRs catches this class of truncation).

> **Note:** A clean copy of this file is visible through cached/index reads, which masks the problem in editors that read the index. Trust the on-disk working tree (verified at byte level) — it is the version that builds.

---

## HIGH

### H-1 — Missing `.gitattributes` + repo-wide CRLF churn
- **File:** repository root — `.gitattributes` is **absent**
- **Line:** n/a
- **Risk:** 162 tracked files are `LF` in the index but `CRLF` in the working tree, and `git status` shows **188 modified files** — most are pure line-ending noise, not real changes. This makes diffs unreviewable, hides genuine edits (like C-1) inside the churn, and guarantees merge/rebase friction across Windows/Linux/CI. It is the root cause of the giant dirty tree.
- **Fix:** Add a `.gitattributes` with `* text=auto eol=lf` (plus `*.ps1 text eol=crlf`, and `-text` for binaries like `*.png`). Then renormalize once: `git add --renormalize .` and commit. Verify CI runs on LF.

### H-2 — Stripe webhook & checkout flows have zero handler tests
- **Files:** `src/app/api/stripe/webhook/route.ts` (POST at line 39), `src/app/api/stripe/checkout/route.ts`, `src/app/api/stripe/portal/route.ts`
- **Line:** webhook handler entry `route.ts:39`
- **Risk:** The webhook handler (200 lines) does signature verification (`stripe.webhooks.constructEvent`), `upsertStripeSubscription`, and `provisionClinicWorkspace` — i.e. it is the code that turns a payment into a provisioned account. **No test exercises any Stripe route handler.** `billing-plans.test.js` only covers pure plan-mapping libs (`normalizePlan`, `resolveCheckoutPlan`, `planFromStripePriceId`); it never invokes the handlers. A regression in signature handling or provisioning would ship silently and either fail to provision paying customers or double-provision.
- **Fix:** Add integration tests for `POST /api/stripe/webhook` covering: invalid/missing signature → rejected; `checkout.session.completed` → subscription upserted + workspace provisioned; idempotency on duplicate events. Add a checkout test asserting the basic plan is rejected and price-env resolution works.

### H-3 — Widget capture flow untested
- **Files:** `src/app/api/widget/submit/route.ts` (POST at line 91, 429 lines), `src/app/api/widget/ping/route.ts`, `src/app/api/widget/bootstrap.js/route.ts`
- **Line:** `widget/submit/route.ts:91`
- **Risk:** `widget/submit` is the embedded lead-capture endpoint running on third-party clinic sites; it gates on `canUseLeadClawProduct` and inserts leads. It is CORS-open (`Access-Control-Allow-Origin: *` per `next.config.ts`) and 429 lines of branching logic with **no tests**. A regression here silently drops customer leads — the product's core value.
- **Fix:** Add tests for `POST /api/widget/submit`: active vs inactive subscription gating, valid payload → lead inserted, malformed payload → 4xx, and ping/bootstrap availability. Treat this as a critical-path suite.

### H-4 — Orphaned/misplaced database migration
- **File:** `src/lib/supabase/migrations/supabase/migrations/20260307_add_clinics_and_enquiries.sql`
- **Line:** n/a (wrong path)
- **Risk:** Canonical migrations live in `supabase/migrations/` (10 files, earliest `20260314_prod_hardening.sql`). The `20260307_add_clinics_and_enquiries.sql` migration — which creates the **clinics and enquiries** tables that much of the app depends on — exists only in a doubly-nested `src/lib/supabase/migrations/supabase/migrations/` path. A standard Supabase migration runner will not pick it up, so a fresh environment may be missing those tables while every later migration assumes they exist.
- **Fix:** Confirm whether `20260307` was already applied to prod another way. If it belongs in the pipeline, move it to `supabase/migrations/20260307_add_clinics_and_enquiries.sql` and delete the nested `src/lib/supabase/migrations/` tree. Verify migration ordering against `supabase/schema.sql`.

### H-5 — Customer onboarding/provisioning routes untested
- **Files:** `src/app/api/onboarding/run/route.ts` (POST line 36), `src/app/api/onboarding/intake/route.ts`, `src/app/api/trial/start/route.ts`, `src/app/api/trial/intake/route.ts`
- **Line:** `onboarding/run/route.ts:36`
- **Risk:** These insert into `retention_tasks` / `onboarding_reports` and drive trial-to-customer conversion. None have route-level tests, so provisioning regressions surface only in production.
- **Fix:** Add handler tests for the onboarding `run`/`intake` and `trial/start` paths covering the happy path and the main failure branches.

---

## MEDIUM

### M-1 — Junk fragment file committed next to a real route
- **File:** `src/app/api/agent/command/route.tses`
- **Line:** 1
- **Risk:** A 13-line, 208-byte fragment (`route.ts` + stray `es`) sitting beside the valid `route.ts`. It is an orphaned partial of the handler (begins mid-object `success: true,`). Next.js ignores the `.tses` extension so it is not a live route, but it is committed dead code that confuses search, grep, and reviewers, and signals a botched save.
- **Fix:** Delete `route.tses`. Add a lint/CI check rejecting files under `app/` whose extension isn't a recognized source extension.

### M-2 — Commit message accidentally saved as a tracked file
- **File:** `idebar nav, mascots, pricing refactor, portal and widget polish` (tracked, name ends with a stray glyph `U+F022`)
- **Line:** n/a
- **Risk:** A file whose name is a commit message — classic artifact of a botched `git commit -m` (a `>` redirect typo). There is also a **second**, untracked variant in the tree (`idebar nav, ... polish"`). Both are noise; the non-ASCII/space-laden names break tooling and shell globs.
- **Fix:** `git rm "idebar nav, mascots, pricing refactor, portal and widget polish"*` and delete the untracked twin. Confirm no script references them.

### M-3 — Build artifacts neither tracked nor ignored (commit risk)
- **Files:** `tsconfig.tsbuildinfo` (2.7 MB), `tsconfig.landing.tsbuildinfo` (192 KB), `tsconfig.queue.tmp.tsbuildinfo` (107 KB)
- **Line:** n/a (`.gitignore`)
- **Risk:** `git check-ignore` confirms none are ignored. They show as untracked and will be swept into someone's `git add .`, polluting history with large, machine-specific incremental-build state. `tsconfig.queue.tmp.tsbuildinfo` is doubly suspect — there is no `tsconfig.queue.json`, so it's an orphan temp artifact.
- **Fix:** Add `*.tsbuildinfo` to `.gitignore`. Delete the orphan `tsconfig.queue.tmp.tsbuildinfo`. If a queue tsconfig is intended, add the real `tsconfig.queue.json`.

### M-4 — Oversized, duplicated favicon / brand PNGs
- **Files:** `public/favicon.png` (1.99 MB) — byte-identical (md5 `fe8a69d2…`) to `public/brand/icons/leadclaw-claw.png`; plus five brand PNGs at ~2 MB each (`leadclaw-logo-dark.png` 2.1 MB, `fox-starter.png` 2.1 MB, `leadclaw-logo.png` 2.0 MB, `dragon-elite.png` 2.0 MB)
- **Line:** n/a
- **Risk:** A 2 MB favicon ships on every page load and tanks LCP/Core Web Vitals (the SEO landing pages are the whole funnel). ~12 MB of duplicated/oversized raster assets bloat the repo and every deploy.
- **Fix:** Replace `favicon.png` with a proper 32–48px icon (`.ico`/small `.png`, a few KB) and reference the brand asset where the large image is actually needed. Compress brand PNGs (target < 200 KB) or serve via the Next image pipeline.

### M-5 — Untracked Python bytecode in the tree
- **File:** `leadclaw-lead-scraper/__pycache__/`
- **Line:** n/a (`.gitignore`)
- **Risk:** `__pycache__/` is untracked but not ignored — commit risk and noise.
- **Fix:** Add `__pycache__/` and `*.pyc` to `.gitignore`.

---

## LOW

### L-1 — Empty `.gitmodules` committed
- **File:** `.gitmodules`
- **Line:** 1
- **Risk:** Zero-byte but tracked. Implies a removed/abandoned submodule; some tooling treats presence of `.gitmodules` as "this repo has submodules."
- **Fix:** `git rm .gitmodules` if no submodules are intended.

### L-2 — `.gitignore` has a UTF-8 BOM
- **File:** `.gitignore`
- **Line:** 1
- **Risk:** The leading BOM (`﻿`) attaches to the first pattern (`# dependencies` comment here, so benign — but if the first line were a real rule it would silently fail to match). Symptomatic of Windows editors writing BOMs across the repo.
- **Fix:** Re-save `.gitignore` as UTF-8 without BOM. The `.gitattributes` normalization in H-1 will help prevent recurrence.

### L-3 — Mixed line endings inside source files
- **Files:** e.g. `.env.example`, `eslint.config.mjs`, `src/__tests__/outreach-drafts.test.ts`, `src/__tests__/outreach-eligibility.test.ts` (flagged `w/mixed` by `git ls-files --eol`)
- **Line:** n/a
- **Risk:** Mixed CRLF/LF within a single file causes confusing diffs and occasional tooling hiccups.
- **Fix:** Covered by the H-1 renormalization pass; verify these specific files afterward.

---

## What scanned clean

- **Broken imports:** 0 — full resolver pass over all relative (`./`) and `@/` aliased imports across `src/` resolved successfully.
- **Git merge-conflict markers:** none in source.
- **Dead routes:** every `app/api/**/route.ts` exports at least one HTTP method handler; every `page.tsx` has a default export.
- **Duplicate migration filenames:** none within the canonical `supabase/migrations/` directory (the only issue is the misplaced file in H-4).
- **NUL-byte corruption:** none (an early grep false-positive was disproved with byte-level counting).
- **Other suspected truncations:** `src/lib/legal.ts` and `src/lib/seo-pages.ts` flagged by the end-of-file heuristic were verified intact; only C-1 is genuinely truncated.

---

## Recommended fix order

1. **C-1** — restore `leads/import/route.ts` so the build can pass.
2. **H-1** — add `.gitattributes`, renormalize; this clears the 188-file dirty tree and makes everything else reviewable.
3. **H-4** — resolve the orphaned `20260307` migration before it bites a fresh environment.
4. **H-2 / H-3 / H-5** — add critical-path tests (billing webhook, widget submit, onboarding).
5. **M-1…M-5, L-1…L-3** — cleanup pass.
6. Run full `tsc --noEmit` and `eslint` in CI (not feasible in this sandbox) to enumerate any residual type/lint errors now that C-1 no longer aborts the run.
