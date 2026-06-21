# Website Audit V2 — Product + Technical Plan

**Status:** Planning only. No code written. Read-only inspection of `main` (working tree has unrelated WIP).
**Date:** 2026-06-19
**Scope guardrails honoured:** billing, outreach, lead-finder, and unrelated WIP were inspected only where they border the audit funnel — nothing touched.

---

## 1. Executive summary

LeadClaw's audit is an honest, well-structured **single-page static-HTML scorer** living behind the portal login. The engine is clean: a declarative check catalogue (`src/lib/audit/checks.ts`), a pure scorer (`src/lib/audit/score.ts`), and a derived "AI Readiness" lens (`src/lib/visibility/*`) that reframes the same audit data without re-crawling. The persistence and history plumbing (`website_audits`, `ai_visibility_scans`) is production-grade.

The product's two biggest gaps are **not** technical depth — they are commercial:

1. **It is locked behind auth.** Every audit route calls `requireUser()`. There is no public "enter your URL, get a free score" lead magnet, even though the site already has `/demo`, `/pricing`, `/free-trial`, `/signup`, and 30+ SEO landing pages crying out for a top-of-funnel tool.
2. **The report has no conversion path.** The audit report (`/portal/audit/[id]`) ends in recommendations — there is **no "Book a demo" or "Upgrade" CTA anywhere in the audit UI**. Findings create concern but route nowhere.

So the highest-leverage V2 work is **not** Lighthouse or a crawler. It is: make the existing engine *credible* (evidence snippets), *persuasive* (urgency + CTA), and *public* (lead magnet). Crawl, PageSpeed, and real AI-provider checks are real upgrades but should follow, in that order, once the funnel exists to monetise them.

**The one-line recommendation:** Ship **V2.1a (evidence + copy + CTA, no schema change)** first — it is hours-to-days, pure-additive, zero new attack surface, and it is the change that turns the report into a sales asset. Then **V2.1b (public lead magnet)** to open the funnel. Defer crawl/PSI/AI-providers to V2.2+.

---

## 2. Current audit architecture map

### 2.1 The audit engine (`src/lib/audit/*`)

```
POST /api/audit/run  ──► runAudit(inputUrl)                     [run-audit.ts]
                           │
                           ├─ normalizeAuditUrl()  SSRF guard,   [fetch-site.ts]
                           │     forces https, strips hash
                           ├─ fetchSite(url)        single GET,   [fetch-site.ts]
                           │     8s timeout, 2MB cap, follow ≤5 redirects
                           ├─ fetchAux(/robots.txt) presence only [fetch-site.ts]
                           ├─ fetchAux(/sitemap.xml) presence only[fetch-site.ts]
                           ├─ parseHtml(html)       regex signals [parse-html.ts]
                           ├─ runChecks(input)      32 checks     [checks.ts]
                           ├─ buildScores(checks)   weighted avg  [score.ts]
                           └─ buildRecommendations()              [score.ts]
                           ▼
                        saveAudit() ──► website_audits row        [store.ts]
```

| Module | Responsibility | Notes |
|---|---|---|
| `run-audit.ts` | Orchestrator, pure (no DB) | Easy to unit test; persistence is separate. |
| `fetch-site.ts` | URL normalisation + SSRF guard + capped fetch | No headless browser by design. `LEADCLAW_USER_AGENT`. Aux fetches are presence-only. |
| `parse-html.ts` | Extract ~30 signals from raw HTML via regex | **Not a DOM parser.** JS-rendered content invisible. JSON-LD `@type` counted by string match, not validated. |
| `checks.ts` | 32 checks across 5 categories | Declarative `CheckDef[]`; each returns `{score 0..1, detail, recommendation}`. |
| `score.ts` | Category + overall scoring, recommendation ranking | Equal category weights; priority = severity×10 + miss×5. |
| `store.ts` | Service-role CRUD on `website_audits` | RLS = read-own; writes via admin client. |
| `types.ts` | Shared types + `AUDIT_ENGINE_VERSION = "v1"` | Scores persisted as columns; `checks`/`recommendations`/`meta` as jsonb. |

**The 5 categories and their checks** (32 total):
- **Health** (8): https, reachable, mobile_friendly (viewport), favicon, robots, sitemap, response_speed, lang_attr.
- **SEO** (8): title_tag, meta_description, h1_present, structured_headings, image_alt, internal_linking, canonical, local_seo.
- **Trust** (8): contact_info, address, phone, reviews, gallery, privacy, terms, about.
- **Conversion** (5): clear_cta, contact_form, online_booking, call_button, mobile_usability.
- **AI Readiness** (6): faq_content, treatment_pages, structured_data, author_info, review_content, knowledge_content.

### 2.2 The "AI Readiness" lens (`src/lib/visibility/*`)

This is **a second scoring lens over the same audit row — it does not crawl or call any AI provider.** It maps existing audit check IDs into four AI-framed categories.

```
POST /api/visibility/run ─► runVisibilityScan(userId)           [run-scan.ts]
                              ├─ getLatestAudit()  reuse Phase-2 crawl
                              ├─ calculateVisibilityScore(checks)[score.ts]
                              │    20 factors → content/authority/citation/schema
                              ├─ generateVisibilityRecommendations()
                              └─ persistScanOnce()  dedup by sourceAuditId [store.ts]
                              ▼
                           ai_visibility_scans row
```

- **Factors** (`factors.ts`) each declare a `sourceCheckId` → they read a 0..1 score straight from the audit's check of that ID. Missing source checks are *skipped, not zeroed* (no penalty for engine drift).
- **Providers** (`providers.ts`) — ChatGPT, Perplexity, Google AI Overviews, Claude — are **metadata-only stubs**, all `status: "coming_soon"`, all `REGISTERED_PROVIDERS` = `null`. `meta.providers` is reserved (`[]`) for when they ship. This is the correct, honest foundation for "Real AI Visibility."
- UI badge already reads **"AI Readiness"** (`src/app/portal/visibility/page.tsx`), but the route/dir/table/API are still named `visibility`. The rename is cosmetic-only so far.

### 2.3 API + UI surface

| Route | Auth | Limit | Purpose |
|---|---|---|---|
| `POST /api/audit/run` | `requireUser` | 6/min | Fresh audit + persist |
| `POST /api/audit/refresh` | `requireUser` | 6/min | Re-run latest/given URL |
| `GET /api/audit/latest` | `requireUser` | — | Newest audit |
| `GET /api/audit/history` | `requireUser` | — | History (≤100) |
| `POST /api/visibility/run` | `requireUser` | 10/min | Derive readiness scan |

UI: `src/app/portal/audit/page.tsx` (score ring, 5 category cards, top-5 recs, history), `src/app/portal/audit/[id]/page.tsx` (full per-check report), `src/components/audit/*` (form, rings, cards, list, scope notice). `AuditScopeNotice` is an honest "single page, static HTML, no Lighthouse" disclaimer.

**Stack:** Next.js 16 / React 19, Supabase (Postgres + RLS), Upstash rate-limit, Zod, native `fetch`. **No** Lighthouse, Playwright, Cheerio, jsdom (parsing), OpenAI/Anthropic SDKs are installed.

### 2.4 Data model

`website_audits`: scores as `int` columns (overall + 5 categories, all `0..100` checked), plus `checks`/`recommendations`/`meta` jsonb, `engine_version`, `status` (`queued|running|completed|failed` — async states reserved but unused), `user_id NOT NULL → auth.users`. Two indexes (user+url+created, user+created). RLS read-own + service-role-all.

`ai_visibility_scans`: same shape, 4 category scores + `visibility_score`, `meta` holds `{engineVersion, sourceAuditId, auditedAt, breakdown, providers}`.

---

## 3. Current limitations

| # | Limitation | Impact on a lead-gen product |
|---|---|---|
| L1 | **Auth-gated only** — no public audit | No top-of-funnel lead capture. Biggest commercial limiter. |
| L2 | **No CTA in the report** | Findings create concern but no path to demo/upgrade. |
| L3 | **Single page (homepage) only** | Can't say "23 of your pages are missing meta descriptions" — the line that sells a fix. |
| L4 | **Static HTML, regex parser** | JS-rendered/SPA sites score near-zero falsely → false findings destroy trust. |
| L5 | **No Lighthouse/PSI** | No real performance/Core Web Vitals/accessibility — the metrics owners recognise from Google. |
| L6 | **JSON-LD only counted, not validated** | "Structured data" check can't say *what's wrong*, only how many blocks exist. |
| L7 | **robots/sitemap presence-only** | Sitemap URLs aren't read; robots rules aren't parsed. |
| L8 | **No evidence snippets** | Findings are assertions ("No H1 found") without the proof a sceptical owner wants. |
| L9 | **No shareable/PDF report** | Nothing to forward to a colleague or leave behind after a demo. |
| L10 | **No competitor benchmark** | "You score 61, the average clinic near you scores 78" is missing — the strongest urgency lever. |
| L11 | **Audit engine has zero unit tests** | Only `visibility-score.test.ts` exists. Any refactor is currently unguarded. |
| L12 | **SSRF guard is literal-only** | Hostname/IP-literal checks, no DNS resolution (acknowledged in code). Matters more once public. |

---

## 4. V2 product vision

> **"Paste your website. In 20 seconds, see exactly where you're losing customers and where AI assistants can't find you — with the proof, and a one-click path to fixing it."**

The audit becomes LeadClaw's primary **lead-generation engine**: a public, credible, shareable diagnostic that (a) earns trust through specific evidence, (b) manufactures urgency through benchmarking and money-framed findings, and (c) routes every weak score toward "Book a demo" (done-for-you) or "Start free trial" (self-serve). The portal version becomes the logged-in, multi-page, tracked-over-time edition.

Three principles:
1. **Credibility before breadth.** A specific, evidenced finding about one page beats a shallow finding about ten. Evidence first, crawl second.
2. **Every finding has a destination.** Severity wording → CTA. High-severity gaps → "Book a demo." Medium → "Start free trial." Pass → "Keep it that way, track monthly."
3. **Never overclaim.** Keep the `AuditScopeNotice` honesty. Urgency comes from *real* gaps, not invented ones.

---

## 5. V2.1 — recommended implementation scope (ship first)

Two sub-phases. **V2.1a is the highest-ROI first task** (see §11). V2.1b opens the funnel.

### V2.1a — Report credibility + conversion (the quick wins) — *days, low risk, no schema change*

| Improvement | User value | Commercial value | Complexity | Risk | Files | Schema | Tests | Version |
|---|---|---|---|---|---|---|---|---|
| **Evidence snippets per check** (capture the matched title text, the missing tag name, the 2 of 9 images without alt, etc.) | High — proof, not assertions | High — credibility converts | Low–Med | Low (additive to `checks` jsonb) | `parse-html.ts`, `checks.ts`, `types.ts` (`CheckResult.evidence?`), `[id]/page.tsx`, `recommendations-list.tsx` | **None** (fits `checks` jsonb) | Parser fixture tests; check-level evidence assertions | V2.1a |
| **Rewrite recommendation copy** → money/urgency framing without overclaiming ("No click-to-call link — mobile visitors who'd have called are leaving") | High | High | Low | Low | `checks.ts` (recommendation strings), `factors.ts` | None | Snapshot of recommendation output | V2.1a |
| **Score labels + urgency band** ("Needs urgent attention / At risk / Healthy" with colour) | Med | High | Low | Low | `score-utils.ts`, `audit-score-ring.tsx`, `category-score-card.tsx` | None | Pure label-mapping unit test | V2.1a |
| **CTA block in report** — high-severity → "Book a demo"; medium → "Start free trial"; link to `/demo`, `/free-trial` | Med | **Very high** | Low | Low | `[id]/page.tsx`, `portal/audit/page.tsx`, new `audit-cta.tsx` | None | Render test (CTA present, correct target per band) | V2.1a |
| **Backfill audit-engine unit tests** (prerequisite safety net) | — | — (enables everything) | Med | Low | new `src/__tests__/audit-*.test.ts` | None | normalizeAuditUrl, parseHtml, runChecks, buildScores | V2.1a |

### V2.1b — Public free-audit lead magnet — *days–1 week, medium risk, small schema add*

| Improvement | User value | Commercial value | Complexity | Risk | Files | Schema | Tests | Version |
|---|---|---|---|---|---|---|---|---|
| **Public audit page** (`/free-website-audit` or `/audit`): paste URL → instant top-line score + 3 teaser findings | High | **Very high** | Med | Med (abuse, cost, SSRF) | new `src/app/free-website-audit/page.tsx`, new `src/components/audit/public-audit-widget.tsx` | — | E2E happy-path + invalid URL | V2.1b |
| **Public audit API** (unauth, stricter limit, no user_id) | — | — | Med | **Med–High** (SSRF surface, spam) | new `src/app/api/audit/public/route.ts`, reuse `runAudit()` | new `audit_leads` table | Rate-limit, SSRF-reject, email-validation tests | V2.1b |
| **Email gate** for full report → creates a lead | — | **Very high** | Med | Med (GDPR/PECR consent) | public widget, `audit_leads` store | `audit_leads` (email, url, scores, ip, consent, created) | Capture + consent-flag tests | V2.1b |
| **Harden SSRF** (DNS resolution + private-range block) before public exposure | — | — (safety) | Med | High if skipped | `fetch-site.ts` `assertPublicHost()` | None | Resolver-mock tests for private IPs/redirect rebinding | V2.1b |

> **Coupling note:** V2.1b email capture touches lead/consent territory adjacent to outreach + PECR (see your `pecr-classification-v2` memory). Keep the public audit lead as a *new, isolated* `audit_leads` table with its own explicit consent flag; do **not** wire it into the outreach queue in V2.1b. Outreach integration is a deliberate later decision.

---

## 6. V2.2 — recommended implementation scope (after the funnel exists)

Order within V2.2: **crawl → structured-data validation → PageSpeed**. Crawl unlocks the "X of your N pages" findings that make every other check more valuable.

| Improvement | User value | Commercial value | Complexity | Risk | Files | Schema | Tests | Version |
|---|---|---|---|---|---|---|---|---|
| **Small site crawl** — homepage + sitemap/internal-link discovery, hard caps (e.g. ≤15 pages, ≤30s, ≤2MB/page) | High | High | **High** | Med (timeouts, cost, traps) | new `src/lib/audit/crawl.ts`, `run-audit.ts`, `fetch-site.ts` | jsonb-only if capped (`meta.pages`); `audit_pages` child table if per-page history wanted | Link-discovery, dedup, page-cap, timeout, robots-respect (pure, fixture-based) | V2.2 |
| **Per-issue affected URLs** ("12 pages missing meta description") | High | High | Med | Low (depends on crawl) | `checks.ts`, `types.ts` (`affectedUrls?`), report UI | None (jsonb) | Aggregation tests | V2.2 |
| **Duplicate metadata + broken internal links + canonical/indexability** | High | Med | Med | Low | `crawl.ts`, new checks in `checks.ts` | None | Fixture multi-page tests | V2.2 |
| **Structured-data validation** (parse JSON-LD, validate required props per type, not just count) | High | Med | Med | Low | new `src/lib/audit/schema-validate.ts`, `parse-html.ts` | None | Valid/invalid JSON-LD fixtures | V2.2 |
| **PageSpeed Insights API integration** (real perf + Core Web Vitals + a11y, server-side, cached) | High | High | Med | Med (API key, quota, latency) | new `src/lib/audit/pagespeed.ts`, `run-audit.ts` | `meta.psi` jsonb; optional `performance_score` column | Adapter tests with mocked PSI JSON; score-mapping tests | V2.2 |
| **Shareable PDF / public report link** | High | High | Med | Low | report export route, share-token | optional `share_token` column | Token-auth + render tests | V2.2 |

> Use **PageSpeed Insights API** (Google-hosted Lighthouse), **not** self-hosted Playwright/Lighthouse on serverless — see §7.

---

## 7. What to explicitly avoid for now

1. **Self-hosted headless browser (Playwright/Lighthouse) on serverless.** Cold starts, memory, timeouts, and cost are prohibitive on Vercel functions. Use the **PageSpeed Insights API** for rendered metrics instead. Revisit a dedicated render worker only if PSI quota/latency becomes the bottleneck.
2. **Unofficial AI-provider scraping** (scraping ChatGPT, undocumented endpoints). ToS + legal risk. `providers.ts` already correctly avoids this. Real AI visibility waits for official, paid APIs (§later).
3. **Rewriting `parse-html.ts` into a full DOM parser before crawl exists.** Sequence: evidence snippets (regex is fine) → crawl → only then consider Cheerio/parse5 if regex fragility blocks new checks.
4. **Unbounded crawl.** Never ship a crawler without page-count, time, depth, and per-page byte caps, plus crawler-trap and same-origin guards.
5. **Touching billing, outreach queue, or lead-finder.** Per constraints. The public-audit lead lands in its own table; outreach wiring is a separate, later decision.
6. **Wiring `audit_leads` into PECR/outreach in V2.1b.** Capture + consent now; nurture/outreach integration later, deliberately.
7. **Removing the `AuditScopeNotice` honesty.** As scope grows, *update* it — don't drop it.

---

## 8. Required schema changes

**Principle:** the `checks`/`recommendations`/`meta` jsonb columns absorb most of V2 with **no migration**. New tables only where a genuinely new entity (a public lead) or query pattern (per-page history) appears.

| Phase | Change | Migration needed? |
|---|---|---|
| V2.1a | Evidence snippets, money-copy, labels, CTA | **No** — evidence rides inside `checks` jsonb; rest is UI. |
| V2.1b | `audit_leads` table: `id, email, website_url, input_url, overall_score, scores jsonb, meta jsonb, ip inet, consent boolean, source text, created_at`. RLS: service-role-all, **no** authenticated read (admin-only). | **Yes** — one new migration, isolated from `website_audits`. |
| V2.2 crawl | Per-issue `affectedUrls`, per-page summaries in `meta.pages` (capped) | **No** if capped in jsonb. **Optional** `audit_pages` child table if you want queryable per-page history. |
| V2.2 PSI | `meta.psi` block (LCP/CLS/INP/perf/a11y) | **No.** **Optional** `performance_score int` column to show in list views. |
| V2.2 share | Public report links | **Optional** `share_token text unique` column on `website_audits`. |
| Later | Real provider results | **No** — `meta.providers[]` already reserved. **Optional** `provider_visibility` child table for trend queries. |

> Do **not** make `website_audits.user_id` nullable to host public audits. Keep public audits in `audit_leads` to preserve the existing RLS model intact.

---

## 9. Required tests

**Prerequisite (V2.1a, do first): the audit engine currently has no tests.** Add a golden-file safety net before changing parser/checks.

- `normalizeAuditUrl`: scheme coercion, hash strip, trailing-slash, SSRF rejections (localhost, private IPv4 ranges, IPv6 loopback/ULA), invalid input.
- `parseHtml`: fixtures for a well-formed page, an empty/JS-shell page, missing title/meta/h1, multiple H1s, images-with/without-alt ratios, JSON-LD blocks/types, tel/mailto/booking links. Assert each extracted signal.
- `runChecks`: per-category, assert score/severity/recommendation presence for pass/partial/fail.
- `buildScores` / `buildRecommendations`: category aggregation, overall weighting, priority ordering (severity then miss).
- **Golden file:** one fixed HTML fixture → assert stable scores (regression guard for all future refactors).

**V2.1a feature tests:** evidence captured and rendered; recommendation copy snapshots; score→label band mapping; CTA block presence + correct target per severity band.

**V2.1b:** public-API rate-limit enforced; SSRF rejection (incl. redirect-to-private rebinding once DNS-resolve guard lands); email validation; consent flag persisted; lead row created exactly once.

**V2.2:** crawl link-discovery + same-origin filter + dedup; page-cap and timeout honoured; robots-respect; multi-page duplicate-meta/broken-link aggregation; JSON-LD valid/invalid validation fixtures; PSI adapter with **injected fetch** + mocked PSI JSON (no live calls in CI); PSI→score mapping.

All engine tests stay **pure / fixture-based — no network in CI.** Mirror the existing `visibility-score.test.ts` style (inject data, assert pure transforms).

---

## 10. Exact file/module change plan

### V2.1a (first PR — additive, no schema)
- `src/lib/audit/types.ts` — add `evidence?: { snippet?: string; found?: string; count?: number; sample?: string[] }` to `CheckResult`; add urgency-band type if desired.
- `src/lib/audit/parse-html.ts` — capture and return the *actual matched text* (title string, first missing-alt image src sample, matched address line) alongside booleans.
- `src/lib/audit/checks.ts` — populate `evidence` per check; rewrite `recommendation` strings to money/urgency framing.
- `src/lib/audit/score.ts` — no logic change; optionally pass evidence through to recommendations.
- `src/components/audit/score-utils.ts` — add `scoreBand(score)` → `{label, tone}`.
- `src/components/audit/audit-score-ring.tsx`, `category-score-card.tsx` — render band label.
- `src/components/audit/recommendations-list.tsx`, `src/app/portal/audit/[id]/page.tsx` — render evidence under each finding.
- **New** `src/components/audit/audit-cta.tsx` — severity-aware CTA block; embed in `[id]/page.tsx` and `portal/audit/page.tsx`.
- **New** `src/__tests__/audit-engine.test.ts` (+ fixtures under `src/__tests__/fixtures/audit/`).

### V2.1b (public funnel)
- **New** `supabase/migrations/2026XXXX_add_audit_leads.sql` — `audit_leads` table (§8).
- **New** `src/lib/audit/leads-store.ts` — service-role CRUD for `audit_leads`.
- **New** `src/app/api/audit/public/route.ts` — unauth, Zod-validated, stricter public rate-limit, reuses `runAudit()`, persists lead, returns teaser + gated full report.
- `src/lib/rate-limit.ts` — add `publicAuditRateLimit` (tight per-IP).
- `src/lib/audit/fetch-site.ts` — harden `assertPublicHost()` with DNS resolution + post-redirect re-check.
- **New** `src/app/free-website-audit/page.tsx` + `src/components/audit/public-audit-widget.tsx`.
- Link from `src/app/page.tsx`, `src/components/app-footer.tsx`, SEO landing pages.

### V2.2 (depth)
- **New** `src/lib/audit/crawl.ts` (discovery, caps, dedup, robots-respect), `schema-validate.ts`, `pagespeed.ts`.
- `src/lib/audit/run-audit.ts` — orchestrate crawl + PSI; aggregate per-issue `affectedUrls`.
- `src/lib/audit/checks.ts` / `types.ts` — multi-page checks (duplicate meta, broken links, indexability), `affectedUrls`.
- **Optional** migration for `audit_pages` / `performance_score` / `share_token`.
- Report UI updates for affected-URL lists, PSI panel, PDF/share.

---

## 11. Highest-ROI first implementation task

**Ship V2.1a: "Make the audit report credible and conversion-ready."**

Why this first:
- **Pure additive, zero schema change, zero new attack surface** — evidence rides in existing `checks` jsonb; CTA/labels are UI.
- **Directly serves the stated goal** — turns the checklist into a sales asset for every audit users already run.
- **De-risks everything after it** — backfilling the missing engine tests in the same PR gives the safety net that crawl/PSI refactors will need.
- **Hours-to-days, not weeks** — fastest path from "honest checklist" to "report a business owner trusts and acts on."

Concretely, the first PR delivers: (1) evidence snippets on every check, (2) money/urgency recommendation copy, (3) score bands, (4) a severity-aware CTA block linking to `/demo` and `/free-trial`, (5) a golden-file + unit-test suite for the audit engine.

The public lead magnet (V2.1b) is the higher commercial *ceiling*, but it carries SSRF/abuse/consent risk and a migration — so it is the immediate **next** PR, not the first.

---

## 12. Recommended Codex / Cowork prompt for the first implementation pass

```
TASK: Website Audit V2.1a — make the audit report credible and conversion-ready.
MODE: Implement. Additive only. No schema/migration changes. Do NOT touch billing,
outreach, lead-finder, or the visibility/* engine logic. Keep AuditScopeNotice honest.

CONTEXT:
- Engine: src/lib/audit/{run-audit,fetch-site,parse-html,checks,score,store,types}.ts
- UI: src/app/portal/audit/page.tsx, src/app/portal/audit/[id]/page.tsx,
      src/components/audit/*
- The audit currently asserts findings with no evidence and the report has no CTA.

DELIVER (in this order, with tests passing at each step):

1. SAFETY NET FIRST. Add src/__tests__/audit-engine.test.ts with fixtures under
   src/__tests__/fixtures/audit/. Cover normalizeAuditUrl (incl. SSRF rejections),
   parseHtml (good page, JS-shell, missing title/meta/h1, alt ratios, JSON-LD,
   tel/mailto/booking), runChecks per category, buildScores/buildRecommendations
   ordering, and ONE golden-file fixture asserting stable scores. Pure, no network.

2. EVIDENCE. Add optional `evidence` to CheckResult in types.ts
   ({ snippet?, found?, count?, sample? }). Have parse-html.ts return the actual
   matched text (title string, sample missing-alt src, matched address line, JSON-LD
   @types). Populate evidence in checks.ts. Render it under each finding in
   [id]/page.tsx and recommendations-list.tsx.

3. COPY. Rewrite recommendation strings in checks.ts to money/urgency framing
   WITHOUT overclaiming (tie to lost customers / trust / AI-discoverability).

4. SCORE BANDS. Add scoreBand(score)->{label,tone} in
   src/components/audit/score-utils.ts ("Needs urgent attention" <50,
   "At risk" 50–74, "Healthy" 75+). Render in audit-score-ring + category cards.

5. CTA. New src/components/audit/audit-cta.tsx: if any high-severity finding ->
   primary "Book a demo" (/demo); else -> "Start free trial" (/free-trial); always a
   secondary "Re-run audit". Embed in both portal/audit/page.tsx and [id]/page.tsx.

CONSTRAINTS:
- npm test and npm run lint must pass. No new dependencies.
- No changes to website_audits/ai_visibility_scans schema. evidence lives in the
  existing checks jsonb.
- Keep run-audit.ts pure (no DB). Don't alter scoring weights or category math.

OUTPUT: a single PR with the tests, engine/UI changes, and a short CHANGELOG note.
```

---

### Appendix — facts verified against the repo (read-only)
- All four `/api/audit/*` routes call `requireUser()`; no unauthenticated audit path exists.
- No `book demo` / `upgrade` / `pricing` reference anywhere under `src/app/portal/audit` or `src/components/audit`.
- `providers.ts`: all four providers `coming_soon`, `REGISTERED_PROVIDERS` all `null` — no AI calls made.
- No Lighthouse/Playwright/Puppeteer/Cheerio/PSI/OpenAI/Anthropic deps in `package.json`.
- Only audit/visibility test present: `src/__tests__/visibility-score.test.ts`. The audit engine itself is untested.
- Migrations: `20260615_add_website_audits.sql`, `20260620_add_ai_visibility_scans.sql`. `website_audits.user_id` is `NOT NULL → auth.users`.
- `AuditScopeNotice` already discloses "single page, static HTML, no Lighthouse/PageSpeed."
```
