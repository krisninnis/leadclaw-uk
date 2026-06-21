# Website Audit & AI Visibility — Hardening Pass

**Date:** 2026-06-20  **Scope:** Website Audit + AI Visibility only (billing, Stripe,
outreach, lead finder, telephony, missed-call recovery untouched).
**Environment limits:** `next build` cannot run in the sandbox (no native SWC binary);
`.git/index.lock` is stuck (mount forbids unlink) so the commit must be made on Windows.
Validation here used scoped `tsc` + `jest`.

---

## 1. Architecture map

### Website Audit — flow: URL → Fetch → Parse → Score → Recommend → Store → Portal

| Stage | Source | Tables | API routes | Key failure points |
|------|--------|--------|-----------|--------------------|
| Entry (public) | `app/api/audit/public/route.ts`, `components/audit/public-audit-widget.tsx`, `/free-audit` | `audit_leads` | `POST /api/audit/public` | rate-limit; **fail-closed** if lead capture fails (503, no report) |
| Entry (authed) | `app/portal/audit/*`, `components/audit/run-audit-form.tsx` | `website_audits` | `POST /api/audit/run`, `/refresh`; `GET /api/audit/latest`, `/history` | auth; admin client env |
| Normalise | `lib/audit/fetch-site.ts` → `normalizeAuditUrl` | — | — | forces https; SSRF rejects |
| Fetch | `lib/audit/fetch-site.ts` → `fetchSite`, `fetchAux` | — | — | DNS-pin + redirect re-validation; 8s timeout; **aux origin / sitemap location** |
| Parse | `lib/audit/parse-html.ts` | — | — | regex-only; no JS render; **JSON-LD @type extraction** |
| Check | `lib/audit/checks.ts` (30 checks ×5 categories) | — | — | consumes `robotsFound`/`sitemapFound`/`signals` |
| Score | `lib/audit/score.ts` | — | — | category + overall 0..100 |
| Store | `lib/audit/store.ts` (`website_audits`), `lib/audit/leads-store.ts` (`audit_leads`) | both | — | **schema drift / PostgREST cache** |
| Render | `app/portal/audit/page.tsx`, `[id]/page.tsx`, `public-report.ts` | — | — | — |

`website_audits` (migration `20260615`) and `audit_leads` (migrations `20260619143634` +
`20260619151202`) are **intentionally defined in migrations, not `schema.sql`** (the file
documents this). Both are RLS-protected, service-role writes, user-reads-own.

### AI Visibility — flow: latest audit → derive scores → store → portal

| Piece | Source | Status |
|------|--------|--------|
| Orchestrator | `lib/visibility/run-scan.ts` (`runVisibilityScan` → `buildScanFromAudit`) | **complete** — derives from latest `website_audits` row |
| Scoring | `lib/visibility/score.ts`, `factors.ts` | **complete** — maps audit checks → content/authority/citation/schema → visibility score |
| Persistence | `lib/visibility/store.ts` (`ai_visibility_scans`), dedup by `sourceAuditId` | **complete** |
| API | `POST /api/visibility/run` | **complete** (no `/latest`/`/history` — portal reads the store server-side) |
| Portal | `app/portal/visibility/page.tsx` + 7 components | **complete & honestly labelled "AI Readiness"** |
| Providers | `lib/visibility/providers.ts` (ChatGPT/Perplexity/Google AIO/Claude) | **PLACEHOLDER** — intentional stubs, `coming_soon`, `meta.providers = []` |
| Competitors | `components/visibility/competitor-placeholder.tsx` | **PLACEHOLDER** |

`ai_visibility_scans` (migration `20260620_add_ai_visibility_scans.sql`) is complete
(RLS, indexes, `updated_at` trigger).

---

## 2. Root-cause report (false positives + persistence)

**robots.txt falsely "missing".** `runAudit` probed `/robots.txt` against the **pre-redirect**
origin derived from the *typed* URL, not `site.finalUrl`. A homepage that redirects
apex→www or http→https serves robots on the **final** host, so the probe could 404. Evidence:
old `run-audit.ts` used `origin` from `normalizeAuditUrl(inputUrl)` for `fetchAux`, while
`fetchSite` followed redirects to a different `finalUrl`.

**sitemap.xml falsely "missing".** Only the literal `/sitemap.xml` was probed. Real sites
(esp. WordPress/Yoast) serve `/sitemap_index.xml` or declare the sitemap via a `Sitemap:`
directive in robots.txt. Those were never checked → present sitemaps reported missing.

**Structured data "incomplete".** `@type` was extracted with a single string regex
(`/"@type"\s*:\s*"([^"]+)"/`). It missed **array** types (`"@type":["LocalBusiness","Dentist"]`),
**`@graph`** wrappers (Yoast's default), and **microdata** (`itemtype="…schema.org/…"`).
JSON-LD-typed checks (local SEO, FAQ, reviews) and microdata-only sites under-scored.

**`audit_leads` "schema cache" error.** The table, its 7 hardening columns, and the
`(email, website_url)` **unique key** the upsert needs live only in migrations. If those
migrations weren't applied to prod (or PostgREST's cache wasn't reloaded), the upsert fails.
Because the public route is **fail-closed** (it refuses to release a report when lead capture
fails), that drift silently blocked **every** public audit with a 503.

**Working-tree corruption (reliability).** Several in-scope files were truncated mid-statement
in the working tree (clean in HEAD) — the known mount/file-tool corruption. These break the
build/tests independent of logic.

---

## 3. Fixes applied (in scope only)

1. **`lib/audit/run-audit.ts`** — aux files now fetched against the **post-redirect origin**
   (`deriveAuxOrigin`). Sitemap presence = any of `/sitemap.xml`, `/sitemap_index.xml`
   (parallel) **or** a same-origin `Sitemap:` directive from robots.txt (`declaredSitemapPaths`,
   bounded & SSRF-safe). Both helpers are pure + exported + unit-tested.
2. **`lib/audit/parse-html.ts`** — robust JSON-LD `@type` extraction via `JSON.parse` +
   recursive walk (handles string/array `@type`, `@graph`, nesting) with regex fallback for
   invalid JSON; added schema.org **microdata** detection; new `structuredDataCount` /
   `structuredDataTypes` signals.
3. **`lib/audit/checks.ts`** — the `structured_data` check now uses the combined count/types,
   so microdata and array/`@graph` JSON-LD get credit. (Golden-score regression test unchanged.)
4. **`supabase/migrations/20260620160000_ensure_audit_persistence_and_reload_cache.sql`** —
   idempotently re-asserts the full `audit_leads` shape (columns + `(email, website_url)`
   unique key + grants + RLS) and runs `notify pgrst, 'reload schema'`. Self-healing where
   prod is partially migrated; safe no-op where already correct.
5. **Corruption repairs (reliability):** restored 8 truncated in-scope files to clean HEAD —
   `fetch-site.ts`, `leads-store.ts`, `api/audit/public/route.ts`, `lib/rate-limit.ts`
   (shared infra the public route depends on), `components/audit/public-audit-widget.tsx`,
   and 3 audit test files. No logic change; bytes verified == HEAD, 0 NUL.
6. **New tests:** `src/__tests__/audit-aux-and-structured-data.test.ts` (aux origin, sitemap
   directive parsing, array/`@graph`/microdata/regex-fallback).

> Note: "missing wiring" turned out to be a non-issue — AI Visibility is fully wired
> (portal reads the store server-side; the run API exists). The only unwired piece is the
> *intentional* provider stubs.

---

## 4. Validation

- **tsc `--noEmit`:** audit/visibility surface type-clean (0 errors in any touched file).
- **jest:** 88/88 passing across audit/visibility suites, including the **golden-score
  regression guard** (scores unchanged) and the new false-positive tests. The jsdom widget
  suite couldn't finish within the sandbox's compile wall, but the component and its test are
  byte-identical to HEAD (the known-good committed pair).
- **Corruption:** every changed/new file is NUL-free and parses; no NUL/truncation remains in
  any audit/visibility file.
- **`next build`:** not runnable in-sandbox — **run on Windows before committing.**

---

## 5. Remaining blockers (to sell "AI Visibility Monitoring" standalone)

**CRITICAL**
- **Real AI provider monitoring does not exist.** The product measures AI *readiness*
  (derived from the website crawl), not live presence in ChatGPT/Perplexity/Google AI
  Overviews/Claude. `providers.ts` is intentional stubs; `meta.providers` is always `[]`.
  Selling "Monitoring" (live tracking) requires implementing ≥1 real provider. *(Mitigation:
  the UI already labels this "AI Readiness" and the engines as "coming soon", so it is not
  currently misrepresented — but the standalone "Monitoring" product is unbuilt.)*
- **Out-of-scope working-tree corruption will block `next build`** until repaired:
  `app/layout.tsx`, `lib/billing-view.ts`, `app/lp/[slug]/page.tsx`, `app/seo/[slug]/page.tsx`,
  `app/portal/billing/page.tsx`, `app/portal/page.tsx`, `components/manage-billing-button.tsx`,
  `components/portal-plan-upgrade.tsx`, `lib/checkout-guard.ts`, `app/api/trial/start/intake/route.ts`.
  Repair with `forensics/Guard-FileIntegrity.ps1` + `git checkout -- <file>` (left untouched: out of scope).

**HIGH**
- **`audit_leads` production parity:** apply the new migration to prod and confirm the
  PostgREST cache reload. Until then public audits fail closed (503, no report).
- **Competitor benchmarking is a placeholder** with a visible "Competitors" section and no data.

**MEDIUM**
- **Bot-UA blocking:** some servers 403 the `LeadClawAuditBot` UA for robots/sitemap → still
  counted as missing. Consider treating 401/403 as "exists but restricted", or a fallback UA.
- **No `/api/visibility/latest|history` routes** (SSR reads the store directly) — needed only
  if a client-side refresh-without-reload is wanted.
- **Homepage-only + no JS rendering** (documented V1 scope): SPA/JS-rendered sites under-detected.

**LOW**
- Structured-data scoring is coarse (0 / 0.7 / 1 by block count); could weight by type relevance.
- Phone/address heuristics are UK-centric.

---

## 6. Recommendation — next major build phase

**"AI Visibility Monitoring V1 — real provider signal."** Implement one credentialed provider
end-to-end behind the existing `VisibilityProvider` interface (recommend **Perplexity API** or
**Google AI Overviews via a licensed SERP provider** — both expose citations; avoid
ToS-violating ChatGPT scraping). Flow: build queries from the business profile →
`getAvailableProviders()` runs them → persist `ProviderResult[]` into `meta.providers`
(schema already reserves the space) → render in `ProviderCoverage`. Add competitor
benchmarking on the same queries (mention/rank vs rivals) to fill the placeholder. That
converts today's defensible "AI Readiness" score into a sellable "AI Visibility Monitoring"
product without touching the schema or UI scaffolding.

---

## 7. Commit (must run on Windows — sandbox `.git/index.lock` is stuck)

After `npm run build` passes locally, stage **only** these files (do **not** `git add -A` —
the working tree still holds unrelated corrupted files):

```
git add src/lib/audit/checks.ts src/lib/audit/parse-html.ts src/lib/audit/run-audit.ts ^
        src/__tests__/audit-aux-and-structured-data.test.ts ^
        supabase/migrations/20260620160000_ensure_audit_persistence_and_reload_cache.sql
git commit -m "feat(audit): harden website audit and ai visibility systems"
```

Then apply the migration to production (`supabase db push` or your migration runner) and
confirm a public audit returns a report (no 503).
