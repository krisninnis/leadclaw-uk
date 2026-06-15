# Phase 2 — AI Website Audit (V1)

A clinic enters a website URL; LeadClaw returns five category scores
(Website Health, SEO, Trust, Conversion, AI Readiness), an overall score, and a
prioritised list of fixes. V1 uses a **server-side fetch + lightweight HTML
parse** — no headless browser, no LLM ranking.

## Architecture

```
POST /api/audit/run ─┐
POST /api/audit/refresh ─┼─> runAudit(url)  ──> website_audits (Supabase)
                         │      │
GET  /api/audit/latest ──┤      ├─ normalizeAuditUrl()  (SSRF guard, https, normalise)
GET  /api/audit/history ─┘      ├─ fetchSite()          (8s timeout, capped body, LeadClaw UA)
                                ├─ fetchAux()            (robots.txt, sitemap.xml — parallel)
                                ├─ parseHtml()           (regex signal extraction)
                                ├─ runChecks()           (weighted check catalogue)
                                ├─ buildScores()         (category + overall, 0..100)
                                └─ buildRecommendations()(severity × miss → priority)

/portal/audit          dashboard: run form, latest scores, top fixes, history
/portal/audit/[id]     detail: rings, category cards, every check, all recs
```

The engine (`src/lib/audit/*`) is **pure and DB-free** except `store.ts`, so it
is unit-testable and reusable by a future background worker.

## Scoring framework

Each category holds a list of weighted checks. A check returns a `0..1` score
(partial credit allowed). Category score = weighted average × 100. Overall =
mean of the five categories (equal weight, tunable in `CATEGORY_WEIGHTS`).
Recommendations are generated from any check scoring < 1 and ranked by
`severity × 3 × 10 + miss × 5`.

Adding a check = append one entry to the relevant array in
`src/lib/audit/checks.ts`. No schema or scoring-maths change required.

## Storage

`website_audits` stores one row per run (newest = "latest"; older = history).
Scores are first-class `int` columns (fast sorting/aggregation); `checks`,
`recommendations`, and `meta` are `jsonb` so the framework can evolve without
migrations. RLS: service-role full access; authenticated users read **own** rows
only. Writes go exclusively through the service-role API.

## Production-safety notes (V1 crawler)

- 8s fetch timeout via `AbortController`; redirects followed by `fetch`.
- Response body capped at 2 MB (streamed + cancelled) to protect memory.
- Clear UA: `LeadClawAuditBot/1.0 (+https://leadclaw.uk/audit)`.
- SSRF guard rejects localhost / private IPv4 / unique-local IPv6 / `.local`.
- Per-user rate limit (6/min) with **fail-open** if Upstash is unavailable.
- Node runtime (`export const runtime = "nodejs"`).

## Known V1 limitations (documented on purpose)

- No JavaScript rendering — client-rendered SPAs expose fewer signals.
- Broken-link checking is not crawled (only homepage signals).
- Heuristic text matching can yield false negatives on unusual markup.

## Phase 3 — AI Visibility Scanner (NOT built)

The schema and engine are shaped to absorb this without rework:

1. **Async runs.** `website_audits.status` already supports `queued`/`running`.
   Move `runAudit` behind a queue (Upstash QStash / Vercel cron worker) and have
   `/api/audit/run` enqueue + return a row id; the UI polls `latest`.
2. **Deeper crawl.** Swap/augment `fetchSite` with a Playwright worker (the
   "hybrid" path) behind the same `CheckInput` contract. Add multi-page crawl
   for broken links and per-page SEO.
3. **AI Visibility.** Add a sibling table `ai_visibility_scans` (or a `meta.ai`
   block) plus providers under `src/lib/audit/ai/`:
   - ChatGPT visibility
   - Perplexity visibility
   - Google AI Overview visibility
   Surface as a sixth score; `CATEGORY_WEIGHTS` + `categoryScoreKey` extend
   cleanly. The current "AI Readiness" category is the on-page precursor and
   stays as-is.
4. **Scheduling.** Add a `vercel.json` cron to auto-refresh saved audits and
   trend the scores over time (history table already supports this).

## File map

Engine: `src/lib/audit/{types,fetch-site,parse-html,checks,score,run-audit,store}.ts`
API: `src/app/api/audit/{run,refresh,latest,history}/route.ts`
UI pages: `src/app/portal/audit/page.tsx`, `src/app/portal/audit/[id]/page.tsx`
UI components: `src/components/audit/*`
Migration: `supabase/migrations/20260615_add_website_audits.sql`
Modified: `src/app/portal/layout.tsx`, `src/components/portal-sidebar-nav.tsx`, `src/lib/rate-limit.ts`
