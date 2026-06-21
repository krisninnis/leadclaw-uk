# Phase 4 — AI Competitor Intelligence

**Status:** Planning / architecture only. No code in this document is to be implemented yet.

**Scope guard:** Phase 4 is strictly *additive*. It does **not** modify outreach, the scraper,
PECR classification, lead scoring, the visibility engine, billing, Stripe, auth, or any existing
portal functionality. Every existing module is consumed read-only and reused as-is.

---

## 1. Goal

Let a portal user enter **their website** and **a competitor's website** and receive a
head-to-head report:

- Website score comparison (overall)
- SEO comparison
- Trust comparison
- Conversion comparison
- AI visibility comparison
- Review comparison
- Gap analysis (what the competitor does that you don't, and vice-versa)
- Recommended actions, re-prioritised by competitive gap

The headline insight: *"Here is exactly where your competitor is beating you, and the fixes
that close the gap fastest."*

---

## 2. Design principle — reuse, don't rebuild

LeadClaw already has two declarative scoring engines that Phase 4 stands directly on top of:

| Engine | Module | Produces | Stored in |
| --- | --- | --- | --- |
| Phase 2 Website Audit | `src/lib/audit/*` | `AuditResult` — overall + health/seo/trust/conversion/ai_readiness (0..100) + per-check breakdown + recommendations | `website_audits` |
| Phase 3 AI Visibility | `src/lib/visibility/*` | `ScanResult` — visibility + content/authority/citation/schema (0..100) + factor breakdown + recommendations | `ai_visibility_scans` |

Two facts make competitor intelligence cheap to build:

1. **The audit engine already crawls any URL.** `runAudit(inputUrl)` (`src/lib/audit/run-audit.ts`)
   normalises and SSRF-guards an arbitrary URL, fetches it, and returns a fully scored
   `AuditResult`. Running it against a competitor's homepage is the *same* operation we already
   run against the user's own site — no new crawler.
2. **Visibility is a pure transform over an audit.** `buildScanFromAudit(auditRow)`
   (`src/lib/visibility/run-scan.ts`) derives the four AI-visibility scores from an audit's
   `checks` payload with **no network call**. So once we have a competitor audit row, we get the
   competitor's AI-visibility scores for free.

Therefore the **comparison engine is a pure function of two `AuditResult`/`ScanResult` pairs.**
No external API, no paid service, no second crawler stack.

> **Reviews without a paid API.** There is no Google/Trustpilot reviews API in the codebase and
> the task forbids paid APIs. The "Review comparison" is therefore derived from the *on-page
> review signals the audit already captures*: the `reviews` trust check, the `review_content`
> ai_readiness check, and the `review_schema` visibility factor (Review / AggregateRating
> JSON-LD). This measures *how well each site surfaces its reputation to humans and AI* — which is
> the lever the user can actually act on — rather than an absolute star count. (Future provider
> data can enrich this; see §10.)

---

## 3. Architecture

### 3.1 Component diagram

```
                         ┌─────────────────────────────────────────────┐
                         │  POST /api/competitors/run                   │
                         │  body: { yourUrl?, competitorUrl }           │
                         └───────────────┬─────────────────────────────┘
                                         │ requireUser + competitorRateLimit
                                         ▼
                    ┌──────────────────────────────────────────────────┐
                    │  src/lib/competitors/run-comparison.ts            │
                    │  runCompetitorComparison(userId, yourUrl, compUrl)│
                    └───────┬───────────────────────────────┬──────────┘
            "your side"     │                               │   "competitor side"
                            ▼                               ▼
        ┌───────────────────────────────┐   ┌───────────────────────────────────┐
        │ resolveAuditForUrl(your)       │   │ resolveAuditForUrl(competitor)     │
        │  reuse latest website_audits   │   │  runAudit(competitorUrl)  ◄─ reuse  │
        │  OR runAudit(yourUrl)          │   │  + saveAudit(userId, ...)           │
        └──────────────┬─────────────────┘   └──────────────┬──────────────────────┘
                       ▼                                     ▼
        ┌───────────────────────────────┐   ┌───────────────────────────────────┐
        │ buildScanFromAudit(your)  ◄────┼───┼─► buildScanFromAudit(competitor)   │
        │ (reuse Phase 3, pure)          │   │  (reuse Phase 3, pure)              │
        └──────────────┬─────────────────┘   └──────────────┬──────────────────────┘
                       └──────────────┬──────────────────────┘
                                      ▼
                    ┌──────────────────────────────────────────────────┐
                    │  src/lib/competitors/compare.ts  (PURE, no DB)    │
                    │  compareSites(yourPair, competitorPair)           │
                    │   → 6 dimension comparisons                        │
                    │   → gap analysis (check/factor-level diffs)        │
                    │   → re-prioritised recommended actions             │
                    │   → competitive index + summary                    │
                    └───────────────┬──────────────────────────────────┘
                                    ▼
                    ┌──────────────────────────────────────────────────┐
                    │  src/lib/competitors/store.ts                     │
                    │  saveComparison(userId, result)                   │
                    │    → competitor_comparisons                        │
                    └───────────────┬──────────────────────────────────┘
                                    ▼
                         JSON response → /portal/competitors UI
```

### 3.2 Data-flow diagram

```
 user URL ─┐                              ┌─ website_audits (your latest, reused if fresh)
           ├─ normalizeAuditUrl (SSRF) ──►│
 comp URL ─┘                              └─ website_audits (competitor, newly crawled & saved)
                                                     │
                                       checks jsonb  │  checks jsonb
                                                     ▼
                            calculateVisibilityScore (pure, Phase 3)
                                                     │
                                  ┌──────────────────┴───────────────────┐
                                  ▼                                       ▼
                        your {audit, scan}                    competitor {audit, scan}
                                  └──────────────────┬───────────────────┘
                                                     ▼
                                       compareSites()  (pure, Phase 4)
                                                     ▼
                                       competitor_comparisons row (jsonb breakdown)
```

### 3.3 Module layout (new files only)

```
src/lib/competitors/
  types.ts            # COMPARISON_DIMENSIONS, result/row types, engine version
  compare.ts          # PURE comparison engine (unit-tested, no DB / no network)
  run-comparison.ts   # orchestrator: resolve/refresh audits, derive scans, compare, errors
  store.ts            # persistence for competitor_comparisons (admin client, mirrors audit/store.ts)

src/app/api/competitors/
  run/route.ts        # POST  — run a comparison
  latest/route.ts     # GET   — newest comparison (optionally ?competitor=)
  history/route.ts    # GET   — comparison history
  [id]/route.ts       # GET   — one comparison by id

src/app/portal/competitors/
  page.tsx            # input form + latest head-to-head + history
  [id]/page.tsx       # full comparison report

src/components/competitors/
  run-comparison-form.tsx
  head-to-head-scores.tsx        # dual rings / diverging bars (your vs competitor)
  dimension-comparison-card.tsx  # one of the six dimensions
  gap-analysis-list.tsx
  competitive-actions-list.tsx
  comparison-history-list.tsx

supabase/migrations/
  2026XXXX_add_competitor_comparisons.sql
```

---

## 4. Data model

### 4.1 New table — `competitor_comparisons`

Follows the exact conventions of `20260615_add_website_audits.sql` and
`20260620_add_ai_visibility_scans.sql`: `pgcrypto` UUID PK, `user_id` FK to `auth.users` with
`on delete cascade`, `status` check constraint, integer scores `between 0 and 100`, `jsonb`
columns owned by the app, `engine_version`, `created_at`/`updated_at` with the shared
`set_updated_at()` trigger, RLS (service-role full access + owner read-own), and
`(user_id, …, created_at desc)` indexes for "latest" and "history".

```sql
-- 2026XXXX_add_competitor_comparisons.sql  (Phase 4 — AI Competitor Intelligence)
begin;
create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

create table if not exists public.competitor_comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Normalised https origins (matches website_audits.website_url).
  your_website_url       text not null,
  competitor_website_url text not null,

  -- Provenance: the audit/scan rows each side was computed from. These are all
  -- rows the SAME user owns (a user's audit OF a competitor is still their row),
  -- so existing RLS already protects them. Nullable so a comparison can persist
  -- even if a side's audit failed to save.
  your_audit_id        uuid references public.website_audits(id) on delete set null,
  competitor_audit_id  uuid references public.website_audits(id) on delete set null,
  your_scan_id         uuid references public.ai_visibility_scans(id) on delete set null,
  competitor_scan_id   uuid references public.ai_visibility_scans(id) on delete set null,

  status text not null default 'completed'
    check (status in ('queued','running','completed','failed')),
  error text,

  -- Your-minus-competitor deltas per dimension, -100..100 (signed).
  overall_delta    int not null default 0 check (overall_delta between -100 and 100),
  seo_delta        int not null default 0 check (seo_delta between -100 and 100),
  trust_delta      int not null default 0 check (trust_delta between -100 and 100),
  conversion_delta int not null default 0 check (conversion_delta between -100 and 100),
  visibility_delta int not null default 0 check (visibility_delta between -100 and 100),
  review_delta     int not null default 0 check (review_delta between -100 and 100),

  -- Single headline number, 0..100: how you stack up overall (50 = even). Lets
  -- the history/list views sort & trend without unpacking jsonb.
  competitive_index int not null default 50
    check (competitive_index between 0 and 100),

  -- App-owned payloads (shape in src/lib/competitors/types.ts), so the scoring
  -- framework can evolve with no schema change — same pattern as audit.checks.
  dimensions      jsonb not null default '[]'::jsonb,  -- DimensionComparison[]
  gaps            jsonb not null default '[]'::jsonb,  -- GapItem[]
  recommendations jsonb not null default '[]'::jsonb,  -- CompetitiveAction[]
  meta            jsonb not null default '{}'::jsonb,  -- engine versions, scores snapshot, notes

  engine_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.competitor_comparisons enable row level security;
-- (service_role_all policy + read_own policy via the same do$$/pg_policies guards
--  used in the audit & visibility migrations)

create index if not exists idx_competitor_comparisons_user_pair_created_at
  on public.competitor_comparisons (user_id, competitor_website_url, created_at desc);
create index if not exists idx_competitor_comparisons_user_created_at
  on public.competitor_comparisons (user_id, created_at desc);

drop trigger if exists set_competitor_comparisons_updated_at on public.competitor_comparisons;
create trigger set_competitor_comparisons_updated_at
before update on public.competitor_comparisons
for each row execute function public.set_updated_at();
commit;
```

**No schema changes to `website_audits` or `ai_visibility_scans`.** A competitor crawl is simply a
`website_audits` row owned by the requesting user whose `website_url` is the competitor's origin.
This means the audit history page may surface competitor URLs the user has compared; if that is
undesirable we filter the audit history by a future `meta.source` tag (see §10) — a metadata-only,
non-breaking change.

### 4.2 TypeScript types (`src/lib/competitors/types.ts`)

Mirrors the declarative style of `audit/types.ts` and `visibility/types.ts`.

```ts
export const COMPETITOR_ENGINE_VERSION = "v1";

export type ComparisonDimension =
  | "overall" | "seo" | "trust" | "conversion" | "visibility" | "review";

export const COMPARISON_DIMENSIONS: ComparisonDimension[] = [
  "overall", "seo", "trust", "conversion", "visibility", "review",
];

export const DIMENSION_LABELS: Record<ComparisonDimension, string> = {
  overall: "Website score", seo: "SEO", trust: "Trust",
  conversion: "Conversion", visibility: "AI visibility", review: "Reviews",
};

export type Verdict = "ahead" | "behind" | "even";

// Snapshot of the two scores that fed one dimension.
export type DimensionComparison = {
  dimension: ComparisonDimension;
  label: string;
  yourScore: number;        // 0..100
  competitorScore: number;  // 0..100
  delta: number;            // yourScore - competitorScore, -100..100
  verdict: Verdict;         // |delta| <= EVEN_BAND => "even"
  summary: string;          // human sentence
};

// A single concrete difference, derived from audit checks / visibility factors.
export type GapItem = {
  id: string;                       // source check/factor id
  dimension: ComparisonDimension;
  label: string;
  yourScore: number;                // 0..1 (from the underlying check)
  competitorScore: number;          // 0..1
  direction: "you_behind" | "you_ahead" | "even";
  severity: "high" | "medium" | "low";
  detail: string;                   // "They expose FAQ schema; you don't."
};

// A recommendation re-prioritised by competitive gap (built from the user's own
// audit + visibility recommendations; we never invent fixes the engines can't back).
export type CompetitiveAction = {
  id: string;
  dimension: ComparisonDimension;
  title: string;
  detail: string;
  basePriority: number;       // from the source recommendation
  competitiveMultiplier: number;
  priority: number;           // basePriority * competitiveMultiplier, sorted desc
  closesGapWith: boolean;     // true when the competitor passes this and you don't
};

export type CompetitiveScores = {
  competitive_index: number;
  overall_delta: number; seo_delta: number; trust_delta: number;
  conversion_delta: number; visibility_delta: number; review_delta: number;
};

export type CompetitorComparisonResult = {
  yourWebsiteUrl: string;
  competitorWebsiteUrl: string;
  status: "completed" | "failed";
  error: string | null;
  scores: CompetitiveScores;
  dimensions: DimensionComparison[];
  gaps: GapItem[];
  recommendations: CompetitiveAction[];
  meta: {
    engineVersion: string;
    yourAuditId: string | null;       competitorAuditId: string | null;
    yourScanId: string | null;        competitorScanId: string | null;
    yourScores: Record<string, number>;        // snapshot for the report
    competitorScores: Record<string, number>;
    comparedAt: string;
    notes?: string[];
  };
};

// Row shape returned to the UI (subset of the DB row) — mirrors WebsiteAuditRow.
export type CompetitorComparisonRow = {
  id: string; user_id: string;
  your_website_url: string; competitor_website_url: string;
  your_audit_id: string | null; competitor_audit_id: string | null;
  your_scan_id: string | null;  competitor_scan_id: string | null;
  status: string; error: string | null;
  competitive_index: number;
  overall_delta: number; seo_delta: number; trust_delta: number;
  conversion_delta: number; visibility_delta: number; review_delta: number;
  dimensions: DimensionComparison[];
  gaps: GapItem[];
  recommendations: CompetitiveAction[];
  meta: CompetitorComparisonResult["meta"];
  engine_version: string; created_at: string; updated_at: string;
};
```

---

## 5. Scoring methodology

### 5.1 Where each dimension's two numbers come from

| Dimension | Your score | Competitor score | Source field |
| --- | --- | --- | --- |
| Website score (overall) | `audit.overall_score` | same | `website_audits.overall_score` |
| SEO | `audit.seo_score` | same | `website_audits.seo_score` |
| Trust | `audit.trust_score` | same | `website_audits.trust_score` |
| Conversion | `audit.conversion_score` | same | `website_audits.conversion_score` |
| AI visibility | `scan.visibility_score` | same | `ai_visibility_scans.visibility_score` |
| Reviews | composite (below) | same | audit checks + visibility factor |

**Review sub-score (0..100), computed in `compare.ts` from data already present:**

```
review = round(100 * weightedAvg(
  trust.reviews            (weight 2),   // on-page reviews/testimonials referenced
  ai_readiness.review_content (weight 1),// review text or Review schema
  schema.review_schema     (weight 1)    // Review / AggregateRating JSON-LD (visibility factor)
))
```

All three signals are 0..1 and already produced per audit; the review dimension is a pure
re-aggregation — no new crawl, no paid API. (`ai_readiness` is an audit category; `schema` is a
visibility category — both already attached to each side's `{audit, scan}` pair.)

### 5.2 Dimension delta & verdict

```
delta   = clamp(yourScore - competitorScore, -100, 100)
verdict = |delta| <= EVEN_BAND ? "even" : (delta > 0 ? "ahead" : "behind")   // EVEN_BAND = 5
```

### 5.3 Competitive index (single headline, 0..100)

A weighted blend of the six deltas, recentred so 50 = "dead even", >50 = you lead. Weights are a
single declarative table (like `CATEGORY_WEIGHTS`) so they can be tuned without touching maths:

```
DIMENSION_WEIGHTS = { overall: 0, seo: 1, trust: 1, conversion: 1, visibility: 1.5, review: 1 }
// overall has weight 0 because it is the audit's own roll-up of the others —
// counting it again would double-weight SEO/trust/conversion.

index = round( 50 + 0.5 * weightedAvg(delta_d for d in dimensions, DIMENSION_WEIGHTS) )
```

(Visibility is weighted slightly higher because AI discoverability is the product's north star.)

### 5.4 Gap analysis (check / factor level)

Both sides expose identical check ids (the audit catalogue in `checks.ts`) and factor ids
(`factors.ts`). For each shared id we compare the two 0..1 scores:

```
for id in union(yourChecks, competitorChecks):
  d = yourScore[id] - competitorScore[id]
  if  d <= -0.34  → GapItem(direction = "you_behind")   # competitor clearly better
  elif d >= 0.34  → GapItem(direction = "you_ahead")     # you clearly better
  else            → skip (treated as even, not noise)
GapItems sort by (direction = you_behind first) then severity then |d|.
```

This yields concrete, explainable rows: *"FAQPage schema — they expose it (1.0), you don't (0.0)."*

### 5.5 Recommended actions (competitive re-prioritisation)

We do **not** invent fixes. We take the user's own audit + visibility recommendations (already
generated by `buildRecommendations` / `generateVisibilityRecommendations`) and re-rank them by a
competitive multiplier:

```
competitiveMultiplier =
  2.0  if the matching check/factor is a "you_behind" gap (competitor passes, you fail)
  1.25 if competitor is ahead but the gap is moderate
  1.0  otherwise
priority = basePriority * competitiveMultiplier   // sort desc
closesGapWith = (gap.direction == "you_behind")
```

So the action list naturally floats *"the things your competitor already does that you don't"* to
the top — the core promise of the feature — while staying grounded in fixes the existing engines
can justify.

### 5.6 Purity & testability

`compare.ts` is a pure function `compareSites(yourPair, competitorPair) → CompetitorComparisonResult`
with no DB or network, exactly like `calculateVisibilityScore`. Unit tests (mirroring
`src/__tests__/visibility-score.test.ts`) cover: you-ahead, you-behind, even, missing-dimension
(competitor audit failed), review aggregation, index recentring, and gap thresholds.

---

## 6. API route structure

All routes: `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `requireUser()` gate, Zod body
parsing, and the `{ ok: true, ... }` / `{ ok: false, error }` envelope used by `audit/run` and
`visibility/run`.

| Method & path | Body / query | Success | Errors |
| --- | --- | --- | --- |
| `POST /api/competitors/run` | `{ yourUrl?: string; competitorUrl: string }` | `{ ok, comparison }` | `invalid_request` 400, `invalid_url` 400, `no_audit` 409 (your side has no audit and no `yourUrl`), `rate_limited` 429, `comparison_failed` 500 |
| `GET /api/competitors/latest` | `?competitor=` (optional) | `{ ok, comparison }` | auth 401 |
| `GET /api/competitors/history` | `?limit=` (optional) | `{ ok, comparisons }` | auth 401 |
| `GET /api/competitors/[id]` | path id | `{ ok, comparison }` | `not_found` 404 |

**New rate limiter** in `src/lib/rate-limit.ts` (additive — does not touch existing limiters):

```ts
// Competitor comparisons — 4 per minute per user. A run can trigger a fresh
// competitor crawl (and optionally a fresh self-crawl), so it is heavier than a
// visibility scan and gets a tighter allowance than auditRateLimit (6/min).
export const competitorRateLimit = new Ratelimit({
  redis, limiter: Ratelimit.slidingWindow(4, "1 m"),
  analytics: true, prefix: "leadclaw:competitor",
});
```

**Orchestrator behaviour (`run-comparison.ts`):**

- `yourUrl` omitted → reuse the user's latest `website_audits` row (`getLatestAudit`); if none →
  `NoAuditError` → 409 `no_audit` ("Run an audit on your own site first").
- `yourUrl` provided → reuse a recent self-audit if `created_at` is within a freshness window
  (e.g. 24h) else `runAudit` + `saveAudit`.
- Competitor side → always resolve via the freshness window too (avoids re-crawling a competitor
  you compared minutes ago), otherwise `runAudit(competitorUrl)` + `saveAudit`.
- Both sides → `buildScanFromAudit` + `saveScan` (reuse latest scan when the source audit id
  matches).
- `compareSites(...)` → `saveComparison(...)` → return row.
- Reuses `normalizeAuditUrl` for the competitor URL so the **same SSRF guard** (`assertPublicHost`)
  protects this user-supplied external input. See §9.

---

## 7. Portal UI

Route: **`/portal/competitors`** (server component, `dynamic = "force-dynamic"`, `redirect` to
`/login?next=/portal/competitors` when unauthenticated) — identical shell to `portal/audit/page.tsx`.

Nav registration (additive): one entry in the `links` array in `src/app/portal/layout.tsx`
(`{ href: "/portal/competitors", label: "Competitors", icon: "🥊" }`) and one icon in the
`iconMap` of `portal-sidebar-nav.tsx` (e.g. `competitors: <Swords size={18} />`). The existing
"Coming soon" `competitor-placeholder.tsx` on the visibility page is replaced by a link to the new
page (its three preview bullets become the real feature).

All sections use the `card-premium` surface, `Badge`, `SectionHeading`, `StatCard`, and
`button-secondary` primitives already used by the audit/visibility pages.

### 7.1 Wireframe — `/portal/competitors` (overview)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ [Badge: Competitor intelligence]                                            │
│ H1  Compare yourself to a competitor                                        │
│ p   Enter your site and a rival's — see who AI assistants favour and why.   │
│ ┌─────────────────────── card-premium ─────────────────────────────────┐   │
│ │ Your website   [ yourclinic.co.uk      ] (prefilled from latest audit)│   │
│ │ Competitor     [ rivalclinic.co.uk     ]   [ Compare → ]              │   │
│ └───────────────────────────────────────────────────────────────────────┘ │
├───────────────────────────────────────────────────────────────────────────┤
│ ── Latest head-to-head (card-premium) ─────────────────────────────────── │
│   ┌───────────────┐                              ┌───────────────┐          │
│   │  ◍  72        │   Competitive index            │  ◍  64        │          │
│   │  You          │        58 / 100  ▸ slight lead │  Competitor   │          │
│   └───────────────┘                              └───────────────┘          │
│   Diverging bars, one per dimension (you ◀ | ▶ them):                       │
│     Website   ███▌ +8      SEO ██ +5     Trust ▌-2(even)                     │
│     Conversion ████ +11    AI visibility ██████ +18   Reviews ██▌-7          │
├───────────────────────────────────────────────────────────────────────────┤
│ ── Six dimension cards (grid sm:2 / xl:3) ─────────────────────────────────│
│   [ Website 72 vs 64  ▲ ahead ]  [ SEO 80 vs 75 ▲ ] [ Trust 66 vs 68 ≈ ]    │
│   [ Conversion 70/59 ▲ ]  [ AI visibility 61/43 ▲ ] [ Reviews 40/47 ▼ ]     │
├───────────────────────────────────────────────────────────────────────────┤
│ ── Where they beat you (gap analysis, top 5) ───────── [ View full report ]│
│   • FAQPage schema — they expose it, you don't            (AI visibility)   │
│   • Review/AggregateRating markup — present vs missing    (Reviews)         │
│   • Online booking link — present vs missing              (Conversion)      │
├───────────────────────────────────────────────────────────────────────────┤
│ ── Recommended actions (re-prioritised, top 5) ────────────────────────────│
│   1. Add FAQ + FAQPage schema   ⟶ closes a gap your competitor already won  │
│   2. Publish reviews with AggregateRating markup                            │
├───────────────────────────────────────────────────────────────────────────┤
│ ── History (comparison-history-list) ──────────────────────────────────────│
│   rivalclinic.co.uk   index 58   2026-06-16        [ open ]                 │
└───────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Wireframe — `/portal/competitors/[id]` (full report)

```
┌──────────────── card-premium (header) ────────────────────────────────────┐
│ you  vs  competitor   ·   compared 2026-06-16   ·   index 58/100           │
└────────────────────────────────────────────────────────────────────────────┘
┌──────────────── card-premium per dimension (×6) ──────────────────────────┐
│ AI VISIBILITY            You 61 ▕▔▔▔▔▔▔▖   Competitor 43 ▕▔▔▔▖              │
│   factor table: content/authority/citation/schema, your 0..1 vs their 0..1 │
│   (reuses the visibility-category-breakdown layout, doubled into 2 columns) │
└────────────────────────────────────────────────────────────────────────────┘
┌──────────────── Gap analysis (full) ──────────────────────────────────────┐
│  you_behind first (red), then you_ahead (green), severity-sorted            │
└────────────────────────────────────────────────────────────────────────────┘
┌──────────────── Recommended actions (full, competitive ordering) ─────────┐
│  reuse RecommendationsList styling; badge "Closes competitor gap"          │
└────────────────────────────────────────────────────────────────────────────┘
```

New presentational components reuse existing ones where possible: `head-to-head-scores` wraps two
`AuditScoreRing`s; `dimension-comparison-card` extends `CategoryScoreCard`;
`competitive-actions-list` extends `RecommendationsList`; `comparison-history-list` mirrors
`audit-history-list`.

---

## 8. What is reused vs new

| Concern | Reused (unchanged) | New (additive) |
| --- | --- | --- |
| Crawl + audit scoring | `audit/run-audit`, `fetch-site`, `parse-html`, `checks`, `score`, `audit/store` | — |
| AI-visibility scoring | `visibility/run-scan` (`buildScanFromAudit`), `score`, `factors`, `recommendations`, `visibility/store` | — |
| Auth / rate limit | `api-auth.requireUser`, `rate-limit.checkRateLimit` | `competitorRateLimit` (new limiter constant) |
| DB conventions | `set_updated_at`, RLS pattern, admin client | `competitor_comparisons` table + migration |
| Comparison logic | — | `competitors/compare.ts`, `run-comparison.ts`, `store.ts`, `types.ts` |
| API | route envelope + patterns | `/api/competitors/{run,latest,history,[id]}` |
| UI | `card-premium`, `Badge`, `SectionHeading`, `StatCard`, score ring/category/recs components | `/portal/competitors` pages + `components/competitors/*` |

No file in outreach, scraper, PECR, lead scoring, the visibility engine, billing, Stripe, auth, or
existing portal pages is modified. The only edits to *existing* files are strictly additive list
entries: one nav link (`portal/layout.tsx`), one icon (`portal-sidebar-nav.tsx`), and one limiter
constant (`rate-limit.ts`).

---

## 9. Security & cost considerations

- **SSRF.** The competitor URL is user-supplied external input. It is normalised and guarded by the
  existing `normalizeAuditUrl` / `assertPublicHost` (blocks localhost, `.internal`/`.local`,
  private/loopback/link-local IPv4 & IPv6). Phase 4 inherits the same posture; we do **not** weaken
  it. The existing guard is an MVP hostname/literal check (no DNS resolution) — Phase 4 is a good
  moment to add the resolver allowlist already flagged as future work in `fetch-site.ts`.
- **Abuse / cost.** Each comparison can trigger up to two outbound crawls, so the new
  `competitorRateLimit` is tighter (4/min) and the orchestrator reuses recent audits within a
  freshness window instead of re-crawling.
- **No paid APIs.** Everything is derived from first-party crawl data already gathered by the audit
  engine. Review comparison uses on-page review/schema signals, not a reviews API.
- **Data ownership.** Competitor audits are the requesting user's own `website_audits` rows;
  existing RLS (`read_own`) already scopes them. No cross-tenant exposure.
- **Fail-soft.** If the competitor crawl fails, the audit engine still returns a low-but-scored
  result (its documented behaviour), so a comparison always renders with an explanatory banner
  rather than erroring — matching the audit page's `status === "failed"` treatment.

---

## 10. Rollout phases

| Phase | Deliverable | Notes |
| --- | --- | --- |
| **4A — Foundation** | `competitor_comparisons` migration; `types.ts`; pure `compare.ts` + unit tests | No API/UI yet. Pure engine is independently testable (mirrors Phase 3's foundation-first approach). |
| **4B — Orchestration & API** | `run-comparison.ts`, `store.ts`, `/api/competitors/{run,latest,history,[id]}`, `competitorRateLimit` | Reuses audit + visibility engines end-to-end. API tests mirror `outreach-run`/`audit` test style. |
| **4C — Portal UI** | `/portal/competitors` overview + `[id]` report, `components/competitors/*`, nav link, replace `competitor-placeholder` | Ship behind the existing portal; uses `card-premium`. |
| **4D — Enhancements** | Multi-competitor watch-list; competitive trend over time (reuse the per-pair `created_at desc` index); tag self vs competitor audits via `website_audits.meta.source`; **slot real AI-provider visibility** into the comparison once `ScanResult.meta.providers` is populated (Phase 3D) — no schema change required | Each item is additive and optional. |

### Future provider integration (no rework)

When real AI providers (ChatGPT, Perplexity, Google AI Overviews, Claude) ship under
`ScanResult.meta.providers` (already modelled in `visibility/types.ts`), the AI-visibility and
review dimensions can incorporate *actual* "does the assistant recommend you vs them" data by
reading both sides' `meta.providers`. Because `compare.ts` consumes the `{audit, scan}` pairs and
the scan already carries `providers`, this is a scoring-table change inside `compare.ts` — no
schema, route, or UI restructuring.

---

## 11. Open questions for product

1. **Self-audit freshness window** — reuse any audit from the last 24h, or always offer a "refresh
   my site" toggle on the form?
2. **Should compared competitor URLs appear in the user's own audit history?** If not, gate the
   audit history query on a `meta.source = "self"` tag (metadata-only, non-breaking).
3. **Even-band width** (`EVEN_BAND`, default ±5) and **dimension weights** — product to confirm the
   defaults in §5.2–5.3.
4. **Number of competitors** per comparison in v1 (this design assumes one; 4D adds a watch-list).
