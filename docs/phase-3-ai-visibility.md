# Phase 3 — AI Visibility (Foundation)

LeadClaw's next flagship feature shows clients how visible and "AI‑ready" their
website is — how easily AI systems (ChatGPT, Perplexity, Google AI Overviews,
Claude) can understand, trust, and recommend their business. This phase ships
the **foundation**: a database table, a scoring engine, a premium portal
dashboard, and future‑ready provider interfaces.

> **Scope guardrail.** This phase does **not** scrape ChatGPT, automate AI
> queries, or use any unofficial API. It derives a visibility score from
> *first‑party* data we already collect (the Phase 2 website audit) and defines
> the contracts that real provider integrations will implement later.

## What a user sees

Open **`/portal/visibility`** and (once a website audit exists) generate a
report. The dashboard shows:

- An **overall AI Visibility score** (0–100) in a radial gauge.
- Four **category scores**: Content, Authority, Citation, Schema.
- A **breakdown** of the factors behind each category (pass / partial / fail).
- **Prioritised recommendations** framed for AI visibility.
- A **trend** section (sparkline once ≥2 reports exist; placeholder otherwise).
- **Competitor** and **per‑engine provider** sections marked *Coming soon*.

The page already feels like a finished premium feature before any real provider
integration exists.

## Architecture

```
POST /api/visibility/run ──> runVisibilityScan(userId, url?)  ──> ai_visibility_scans (Supabase)
                                   │
                                   ├─ getLatestAudit()             (reuse Phase 2 website_audits row)
                                   ├─ calculateVisibilityScore()   (audit checks → 4 category scores + overall)
                                   ├─ generateVisibilityRecommendations()  (weak factors → prioritised actions)
                                   └─ buildScanFromAudit()         (pure transform → ScanResult)

/portal/visibility   dashboard: generate button, scores, breakdown, recs,
                     trend, competitor + provider "Coming soon", history
```

The engine in `src/lib/visibility/*` is **pure and DB‑free** except `store.ts`,
so `calculateVisibilityScore` / `buildScanFromAudit` are trivially unit‑testable
and reusable by a future async worker.

### Why reuse the audit?

The Phase 2 audit already crawls the homepage and records the exact signals AI
visibility depends on — structured data, FAQ/Review schema, LocalBusiness +
NAP, named expertise, crawlability (robots, sitemap, HTTPS, canonical, internal
links), and content depth. Rather than crawl again, the visibility engine is a
second, AI‑focused **lens** over those existing check results. No new crawler,
no duplicate network cost, and visibility stays consistent with the audit.

### Files

**Created**

```
supabase/migrations/20260620_add_ai_visibility_scans.sql   migration (3A)

src/lib/visibility/types.ts                 core types + ScanResult, scores, categories
src/lib/visibility/types-providers-ids.ts   provider id union (avoids import cycle)
src/lib/visibility/providers.ts             ProviderResult / VisibilityProvider interfaces + metadata registry (3D)
src/lib/visibility/factors.ts               declarative factor catalogue (maps audit check ids → factors)
src/lib/visibility/score.ts                 calculateVisibilityScore() (3C)
src/lib/visibility/recommendations.ts       generateVisibilityRecommendations() (3C)
src/lib/visibility/run-scan.ts              runVisibilityScan() + buildScanFromAudit() (3C)
src/lib/visibility/store.ts                 saveScan / getLatestScan / getScanById / getScanHistory

src/app/api/visibility/run/route.ts         POST endpoint

src/app/portal/visibility/page.tsx          dashboard (3B)
src/components/visibility/run-visibility-form.tsx
src/components/visibility/visibility-recommendations-list.tsx
src/components/visibility/visibility-category-breakdown.tsx
src/components/visibility/visibility-trend.tsx
src/components/visibility/provider-coverage.tsx
src/components/visibility/competitor-placeholder.tsx
src/components/visibility/visibility-history-list.tsx

src/__tests__/visibility-score.test.ts      unit tests for the scoring engine
docs/phase-3-ai-visibility.md               this document (3E)
```

**Modified**

```
src/app/portal/layout.tsx   added the "AI Visibility" sidebar link
src/lib/rate-limit.ts       added visibilityRateLimit (10/min/user)
```

Billing, the scraper, and outreach are untouched.

## Scoring model

Four categories, each an **equally‑weighted** contributor to the overall score
(tunable in `VISIBILITY_CATEGORY_WEIGHTS`):

| Category    | Question it answers                                              | Example factors (audit check id)                                            |
| ----------- | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Content** | Can an AI summarise what you offer?                             | content depth (`knowledge_content`), services (`treatment_pages`), FAQ (`faq_content`), structure (`structured_headings`), title (`title_tag`) |
| **Authority** | Does the AI have reasons to trust/recommend you (E‑E‑A‑T)?    | named expertise (`author_info`), reputation (`review_content`), about/team (`about`), verifiable contact (`contact_info`) |
| **Citation** | Can AI systems crawl, reach, and cite your pages?              | sitemap, robots.txt, internal links, canonical, HTTPS (`https`), response speed |
| **Schema**  | Is your business machine‑readable as structured facts?          | JSON‑LD (`structured_data`), LocalBusiness+NAP (`local_seo`), FAQPage (`faq_content`), Review/AggregateRating (`review_content`) |

Each **factor** reads one audit check's `0..1` score (partial credit allowed).
Factors whose source check is absent — e.g. from an older audit engine — are
**skipped, not scored zero**, so we never penalise for engine drift.

```
category score   = round( Σ(factor.score × factor.weight) / Σ(factor.weight) × 100 )
visibility score = round( Σ(category.score × category.weight) / Σ(category.weight) )
recommendation priority = severityWeight × 10 + miss × 5   (high=3, medium=2, low=1)
```

This mirrors the Phase 2 audit's framework exactly, so the two features behave
and read consistently. The spec's examples fall out directly: no FAQ schema, no
LocalBusiness schema, and no review schema lower the **Schema** score; missing
author information lowers the **Authority** score.

Adding a factor = append one entry to `VISIBILITY_FACTORS` in
`src/lib/visibility/factors.ts`. No schema or scoring‑maths change required.

## Storage

`ai_visibility_scans` follows the `website_audits` conventions:

- `pgcrypto` UUID primary key, `user_id → auth.users(id) on delete cascade`.
- **RLS** on: `service_role` full access; authenticated users `select` their own
  rows only. All writes go through the service‑role admin client (`store.ts`).
- `set_updated_at()` trigger; indexes on `(user_id, website_url, created_at desc)`
  and `(user_id, created_at desc)` for the *latest* and *history* queries.
- Scores are `int` columns with `0..100` check constraints.
- `recommendations` and `meta` are `jsonb`. The full per‑category factor
  **breakdown** lives in `meta.breakdown`, and future per‑provider results will
  live in `meta.providers` — both evolve without a schema change.

## Future provider integrations (3D — interfaces only)

`src/lib/visibility/providers.ts` declares the contracts a real integration will
satisfy, with **no implementation**:

- `ProviderResult` — `{ providerId, query, mentioned, rank, citationUrl, snippet, raw?, checkedAt }`
- `VisibilityProvider` — `{ id, label, description, isAvailable(), query(input) }`
- `ScanResult` (in `types.ts`) — already carries `meta.providers: ProviderResult[]`, empty for now.
- `VISIBILITY_PROVIDERS` — metadata registry (ChatGPT, Perplexity, Google AI
  Overviews, Claude), each `status: "coming_soon"`, driving the dashboard's
  "AI engines we track" grid.
- `REGISTERED_PROVIDERS` / `getAvailableProviders()` — a registry the engine and
  UI already iterate over; concrete providers slot in later with no code change.

When a provider ships, it implements `VisibilityProvider`, registers itself,
flips its registry `status`, and `runVisibilityScan` blends its `ProviderResult`
into the score and stores it in `meta.providers`. The UI card updates
automatically. **Whether any provider may be queried — and by what official,
permitted mechanism — is a deliberate decision for that later phase; nothing
here scrapes or automates ChatGPT.**

## Migration strategy

1. Apply `supabase/migrations/20260620_add_ai_visibility_scans.sql` (Supabase
   CLI `supabase db push`, or paste into the SQL editor). The file is
   idempotent (`create table if not exists`, guarded policy creation,
   `create or replace` trigger fn).
2. No data backfill is required — scans are generated on demand from existing
   `website_audits` rows.
3. The migration is **additive and isolated**: a new table, new policies, new
   indexes. It does not alter `website_audits` or any other table, so it is safe
   to roll forward independently and trivial to roll back (`drop table
   public.ai_visibility_scans;`).
4. `engine_version` is tracked inside `meta.engineVersion` (currently `v1`).
   Re‑scoring under a new engine simply produces new rows; history is preserved.

## Testing & build validation

```
npx tsc --noEmit          # type-check
npx eslint src/lib/visibility src/app/portal/visibility src/app/api/visibility \
           src/components/visibility
npx jest visibility-score # unit tests for the scoring engine
npm run build             # production build
```

**Manual smoke test**

1. Run the migration against your Supabase project.
2. Sign in to `/portal`, run a website audit at `/portal/audit`.
3. Open `/portal/visibility`, click **Generate visibility report**.
4. Confirm: overall + four category scores render, breakdown lists factors with
   pass/partial/fail icons, recommendations are AI‑framed, and a row appears in
   the History section. Generate again to see the trend sparkline.
5. Verify RLS: a second user cannot read the first user's scans.
