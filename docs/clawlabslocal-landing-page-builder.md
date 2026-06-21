# ClawLabsLocal — Landing Page Builder (Architecture Plan)

**Status:** Planning only. No production code is to be implemented from this document yet.

**Scope guard:** This plan is strictly *additive*. It does **not** touch the scraper, PECR
classification, outreach, billing, auth, or existing Lead Finder work. It reuses existing
infrastructure (Supabase, admin auth, the audit/visibility engines, the design system) read-only.

---

## 1. Summary

A builder that lets **admins** create local SEO / AI-visibility landing pages such as
`/lp/aesthetic-clinic-nottingham`, `/lp/dentist-leicester`, `/lp/beauty-salon-coventry`. Phase 1 is
admin-only: structured-field forms (not a visual drag-and-drop editor), a draft → published
workflow, server-rendered public pages with full SEO metadata and JSON-LD schema, and a clean path
to later connect pages to Audit, AI Visibility, and Competitor Intelligence signals.

The single most important design constraint is **avoiding Google's "doorway page" penalty** (see
§11): programmatic local pages must carry genuine, locally-relevant value, not thin templated
duplicates. The schema and rollout below are built around that constraint.

---

## 2. Q1 — Same repo, or a separate ClawLabsLocal app?

**Recommendation: build it inside the existing LeadClaw repo**, as a self-contained module with a
clear boundary (`src/lib/landing/*`, `src/app/lp/*`, `src/app/admin/landing-pages/*`). Serve public
pages from the **same domain** (`https://www.leadclaw.uk/lp/...`).

| Factor | Same repo (recommended) | Separate app |
| --- | --- | --- |
| Reuse of audit/visibility engines, Supabase clients, `requireAdmin`, design system | Direct import, zero duplication | Must extract a shared package or duplicate |
| SEO authority | Consolidates link equity on the existing indexed domain | New domain starts from zero authority |
| Admin auth | Reuses `requireAdmin` (`ADMIN_EMAILS` / `profiles.role`) as-is | New auth surface to build & secure |
| Deploy / ops | One pipeline, one Supabase project | Second deploy, second env, more moving parts |
| Blast radius | Mitigated by module boundary + RLS + admin gate | Lower, but at high duplication cost |

**When to revisit a split:** only if ClawLabsLocal needs its own apex domain, an independent release
cadence, or a distinct billing entity. Until then, a separate app is premature. Keep the *brand*
("ClawLabsLocal") as a product surface; keep the *codebase* unified. The module boundary chosen here
makes a future extraction into a package straightforward if it's ever justified.

---

## 3. Q2 — Route structure

### Admin (gated, `requireAdmin`)

```
/admin/landing-pages              → list + filters (status, niche, city) + "New page"
/admin/landing-pages/new          → create form (template picker → structured fields)
/admin/landing-pages/[id]         → edit form (same fields) + publish/unpublish controls
/admin/landing-pages/[id]/preview → admin-only live preview of the *draft* (noindex, never public)
```

### Public

```
/lp/[slug]                        → DB-driven, server-rendered, ONLY status='published'
```

`/lp/[slug]` is a dynamic route (unlike the current `force-static` `/seo/[slug]`, which is built
from a hard-coded config). Recommended rendering: **`dynamic = "force-static"` + ISR**
(`export const revalidate = 3600`) with `generateStaticParams()` returning all published slugs, so
pages are statically cached but refresh on publish via on-demand revalidation
(`revalidatePath('/lp/' + slug)`) triggered by the publish API. A draft or unknown slug returns
`notFound()`.

### API (admin-gated CRUD)

```
GET    /api/admin/landing-pages          → list
POST   /api/admin/landing-pages          → create (draft)
GET    /api/admin/landing-pages/[id]     → fetch one
PATCH  /api/admin/landing-pages/[id]     → update draft content / metadata
POST   /api/admin/landing-pages/[id]/publish    → draft → published (+ revalidate)
POST   /api/admin/landing-pages/[id]/unpublish  → published → draft (+ revalidate)
DELETE /api/admin/landing-pages/[id]     → soft-delete (status='archived')
```

All API routes: `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `requireAdmin()` gate, Zod body
parsing, `{ ok: true, ... }` / `{ ok: false, error }` envelope — matching the existing audit /
visibility / lead routes. A new `landingAdminRateLimit` is added to `src/lib/rate-limit.ts`
(additive constant only).

---

## 4. Q3 — Database schema

Three tables, following the conventions in `20260615_add_website_audits.sql` /
`20260620_add_ai_visibility_scans.sql`: `pgcrypto` UUID PK, FK to `auth.users`, status check
constraints, app-owned `jsonb` content, `created_at`/`updated_at` + shared `set_updated_at()`
trigger, RLS, and purposeful indexes.

> **Content model rationale.** The existing `SeoPage` type (`src/lib/seo-pages.ts`) is the proven
> shape for these pages (`h1`, `subheading`, `pains[]`, `benefits[]`, `features[]`, `useCases[]`,
> `faq[]`, `relatedLinks[]`). The builder stores that same structure as `content jsonb` so the
> public renderer can reuse the existing `SeoLandingPage` component family with minimal change.

```sql
-- 2026XXXX_add_landing_pages.sql  (ClawLabsLocal — Landing Page Builder, Phase A)
begin;
create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

-- -------------------------------------------------------------------
-- landing_page_templates
-- Reusable content scaffolds (e.g. "local-clinic", "local-trade").
-- A template provides default sections + the JSON-LD profile to emit.
-- -------------------------------------------------------------------
create table if not exists public.landing_page_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,                 -- 'local-clinic', 'local-trade'
  name text not null,
  description text,
  -- Default content skeleton (same shape as landing_pages.content) merged into
  -- a new page on creation. App-owned shape; see src/lib/landing/types.ts.
  default_content jsonb not null default '{}'::jsonb,
  -- Which schema.org types this template emits: ['LocalBusiness','Service','FAQPage'].
  schema_types text[] not null default array['LocalBusiness','Service','FAQPage'],
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------------------
-- landing_pages
-- One row per landing page. The public route reads only status='published'.
-- -------------------------------------------------------------------
create table if not exists public.landing_pages (
  id uuid primary key default gen_random_uuid(),

  -- URL slug, unique. Validated app-side (lowercase, [a-z0-9-], no leading/trailing dash).
  slug text not null unique,

  template_id uuid references public.landing_page_templates(id) on delete set null,

  -- Authorship / audit trail (admin user ids).
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,

  status text not null default 'draft'
    check (status in ('draft','published','archived')),

  -- Local targeting — the levers that make each page genuinely distinct.
  niche text,                 -- 'aesthetic-clinic', 'dentist', 'beauty-salon'
  city text,                  -- 'Nottingham'
  region text,                -- 'East Midlands' (optional)
  country text not null default 'GB',

  -- SEO metadata (see §6). Kept as columns (not buried in jsonb) because they
  -- are queried/validated and surfaced in the admin list.
  seo_title text,             -- <title> / og:title
  seo_description text,       -- meta description / og:description
  canonical_path text,        -- defaults to '/lp/' || slug
  og_image_path text,
  noindex boolean not null default false,   -- force noindex even when published

  -- Full page body in the SeoPage-compatible shape (h1, sections, faq[], etc.).
  -- App-owned (src/lib/landing/types.ts) so the renderer & scoring can evolve
  -- with no schema change — same pattern as website_audits.checks.
  content jsonb not null default '{}'::jsonb,

  -- Structured data inputs the JSON-LD builder reads (address, phone, geo,
  -- services[], rating). Optional; absent fields are omitted from the schema.
  business_schema jsonb not null default '{}'::jsonb,

  -- Provenance / future links (audit, visibility, competitor signals). Empty in
  -- Phase A; populated in Phase D without a schema change. e.g.
  --   { sourceAuditId, visibilityFactorIds:[], competitorComparisonId }
  meta jsonb not null default '{}'::jsonb,

  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------------------
-- landing_page_events
-- Lightweight first-party analytics (views, CTA clicks, enquiries). No third-
-- party tracker; powers "is this page actually working?" in Phase D.
-- -------------------------------------------------------------------
create table if not exists public.landing_page_events (
  id uuid primary key default gen_random_uuid(),
  landing_page_id uuid not null references public.landing_pages(id) on delete cascade,
  -- 'view' | 'cta_click' | 'enquiry' | 'scroll_50' (extensible, validated app-side).
  event_type text not null,
  -- Coarse, privacy-preserving context only (no PII): referrer host, device class,
  -- utm fields. No IP, no cookies in Phase A.
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- RLS ---------------------------------------------------------------
alter table public.landing_pages           enable row level security;
alter table public.landing_page_templates  enable row level security;
alter table public.landing_page_events      enable row level security;

-- Service role (admin client / server) has full access on all three
-- (create the *_service_role_all policies via the same do$$/pg_policies guard
--  used in the audit & visibility migrations).

-- PUBLIC READ is limited to *published, non-archived* landing pages, and only
-- the columns the public renderer needs (enforced by selecting explicit columns
-- server-side; RLS guards the row visibility):
--   create policy landing_pages_read_published on public.landing_pages
--     for select to anon, authenticated using (status = 'published');
-- Templates: no public read. Events: insert-only via service role (the public
-- page posts events through an admin-keyed server action / API, never directly).

-- Indexes -----------------------------------------------------------
create unique index if not exists idx_landing_pages_slug on public.landing_pages (slug);
create index if not exists idx_landing_pages_status_published_at
  on public.landing_pages (status, published_at desc);
create index if not exists idx_landing_pages_niche_city
  on public.landing_pages (niche, city);
create index if not exists idx_landing_page_events_page_type_created
  on public.landing_page_events (landing_page_id, event_type, created_at desc);

drop trigger if exists set_landing_pages_updated_at on public.landing_pages;
create trigger set_landing_pages_updated_at before update on public.landing_pages
for each row execute function public.set_updated_at();
drop trigger if exists set_landing_page_templates_updated_at on public.landing_page_templates;
create trigger set_landing_page_templates_updated_at before update on public.landing_page_templates
for each row execute function public.set_updated_at();
commit;
```

### TypeScript types (`src/lib/landing/types.ts`, sketch)

```ts
export const LANDING_ENGINE_VERSION = "v1";

export type LandingStatus = "draft" | "published" | "archived";

// Body content — deliberately compatible with the existing SeoPage shape so the
// public renderer reuses the proven SeoLandingPage component.
export type LandingContent = {
  h1: string;
  subheading: string;
  pains: string[];
  benefits: string[];
  features: string[];
  useCases: string[];
  faq: { question: string; answer: string }[];
  relatedLinks: { href: string; label: string }[];
};

export type LandingBusinessSchema = {
  businessName?: string;
  address?: { street?: string; locality?: string; region?: string; postalCode?: string; country?: string };
  phone?: string;
  geo?: { lat: number; lng: number };
  services?: string[];
  rating?: { value: number; count: number };  // only if genuinely sourced
};

export type LandingPageRow = {
  id: string; slug: string; template_id: string | null;
  status: LandingStatus;
  niche: string | null; city: string | null; region: string | null; country: string;
  seo_title: string | null; seo_description: string | null;
  canonical_path: string | null; og_image_path: string | null; noindex: boolean;
  content: LandingContent;
  business_schema: LandingBusinessSchema;
  meta: { sourceAuditId?: string; visibilityFactorIds?: string[]; competitorComparisonId?: string; notes?: string[] };
  published_at: string | null; created_at: string; updated_at: string;
};
```

---

## 5. Q4 — Draft / published workflow

```
            create (draft)
                 │
                 ▼
            ┌─────────┐   PATCH (edit content/metadata)   ┌─────────┐
            │  draft  │◄──────────────────────────────────│  draft  │
            └────┬────┘                                    └─────────┘
   publish ▲     │ publish                ▲ unpublish
           │     ▼                        │
        ┌──┴──────────┐  on-demand        │
        │  published  │  revalidatePath ──┘
        └──────┬──────┘
               │ archive (soft delete)
               ▼
          ┌──────────┐
          │ archived │   (never served, retained for history/restore)
          └──────────┘
```

- **`draft`** — visible only in admin and via `/admin/landing-pages/[id]/preview`. `notFound()` on
  the public route. Always `noindex` regardless of the `noindex` flag.
- **`published`** — served at `/lp/[slug]`; included in the sitemap; indexable unless `noindex=true`.
  Publishing sets `published_at` and triggers `revalidatePath('/lp/'+slug)` + sitemap refresh.
- **`archived`** — soft-deleted; slug is freed for reuse only after an explicit admin action (to
  avoid breaking inbound links accidentally). Returns `notFound()` (or 410 Gone — see §11).
- **Validation gate before publish:** required fields present (`seo_title`, `seo_description`, `h1`,
  ≥1 service, ≥3 FAQ items, a city), slug unique and well-formed, and a **thin-content check**
  (minimum word count + uniqueness heuristic) to resist doorway-page penalties.

Phase A keeps a *single* working copy (the row is the draft; publish promotes it). A separate
published-snapshot/versioning table is **explicitly out of scope for Phase A** (see §12) — add it
only if non-destructive rollback becomes a real need.

---

## 6. Q5 — SEO metadata design

`/lp/[slug]` exports `generateMetadata()` that reads the row from the DB and mirrors the existing
`/seo/[slug]` metadata shape (title, description, `alternates.canonical`, `robots`, `openGraph`,
`twitter`):

```ts
export async function generateMetadata({ params }): Promise<Metadata> {
  const page = await getPublishedLandingPage((await params).slug);
  if (!page) return {};                                  // 404 handled in the page
  const url = `https://www.leadclaw.uk${page.canonical_path ?? '/lp/' + page.slug}`;
  const index = page.status === 'published' && !page.noindex;
  return {
    title: page.seo_title,
    description: page.seo_description,
    alternates: { canonical: page.canonical_path ?? `/lp/${page.slug}` },
    robots: { index, follow: index },                    // drafts & noindex → noindex,nofollow
    openGraph: { type: 'website', url, siteName: 'LeadClaw', title: page.seo_title,
                 description: page.seo_description, images: [{ url: page.og_image_path ?? DEFAULT_OG, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title: page.seo_title, description: page.seo_description },
  };
}
```

**Sitemap.** `src/app/sitemap.ts` currently returns a static array. Add a DB-driven block that maps
published, non-`noindex` landing pages to entries (`/lp/<slug>`, `monthly`, priority ~0.7). This is
a small additive edit to an existing file — acceptable under the scope guard since it touches
neither scraper/PECR/outreach/billing/auth/Lead-Finder.

---

## 7. Q6 — LocalBusiness / Service / FAQ schema design

JSON-LD is emitted exactly as the existing `SeoLandingPage` does it: `<script type="application/ld+json"
dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}>`. A `src/lib/landing/schema.ts` builder
turns the row's `business_schema` + `content` into a schema graph, omitting any block whose inputs
are missing (never emit empty or fabricated data — critical for trust and to avoid structured-data
spam flags).

```jsonc
// LocalBusiness — only when business_schema.address (or geo) is present
{ "@context": "https://schema.org", "@type": "LocalBusiness",
  "name": "<businessName | 'Aesthetic clinics in Nottingham'>",
  "areaServed": { "@type": "City", "name": "Nottingham" },
  "address": { "@type": "PostalAddress", "addressLocality": "Nottingham",
               "addressRegion": "East Midlands", "addressCountry": "GB" },
  "telephone": "<phone?>", "url": "https://www.leadclaw.uk/lp/aesthetic-clinic-nottingham" }

// Service — one per content.services[], or a single summary Service
{ "@context": "https://schema.org", "@type": "Service",
  "serviceType": "Aesthetic clinic enquiry handling",
  "areaServed": "Nottingham", "provider": { "@type": "Organization", "name": "LeadClaw" } }

// FAQPage — from content.faq[] (>= 3 items enforced at publish)
{ "@context": "https://schema.org", "@type": "FAQPage",
  "mainEntity": [ { "@type": "Question", "name": "...",
    "acceptedAnswer": { "@type": "Answer", "text": "..." } } ] }

// AggregateRating — ONLY if business_schema.rating is genuinely sourced; never synthesised.
```

> **Why this matters for the product:** these are the exact signals the AI Visibility engine's
> `schema` category rewards (`structured_data`, `localbusiness_schema`, `faq_schema`,
> `review_schema` in `src/lib/visibility/factors.ts`). Pages we build here are *designed to pass our
> own visibility checks* — which is the bridge to §8.

---

## 8. Q7 — How this connects later (Audit / AI Visibility / Competitor Intelligence)

These are **Phase D** connections; they are designed-for now, not built now. The link is natural
because all three engines already speak in the same check/factor vocabulary the page builder fills.

| Source signal | Connection to the landing page builder |
| --- | --- |
| **Website Audit recommendations** (`website_audits.recommendations`) | A failed `local_seo`, `faq_content`, or `structured_data` check on a customer/competitor site becomes a *page brief*: "build/improve a local page covering X with FAQ + LocalBusiness schema." The audit's `meta` can seed `landing_pages.meta.sourceAuditId`. |
| **AI Visibility recommendations** (`ai_visibility_scans.recommendations`, factors in `factors.ts`) | The visibility factors (`faq_schema`, `localbusiness_schema`, `service_content`, `content_depth`) map **1:1** to landing-page fields. A weak factor → a pre-filled section in the builder. Closing the factor is measurable on the next scan, enabling "did this page improve visibility?" tracking. |
| **Competitor Intelligence** (Phase 4 `competitor_comparisons`) | A `you_behind` gap (e.g. competitor has FAQ schema, local pages, service depth) becomes a prioritised queue of pages to create. `landing_pages.meta.competitorComparisonId` records provenance, so a future report can show "we built these N pages to close gaps vs competitor X." |

**Improvement tracking (Phase D):** because every page records its targeting and its source
signal in `meta`, and because `landing_page_events` captures first-party engagement, Phase D can
correlate *page published → visibility factor improved / enquiries captured* without new
infrastructure beyond a read-model/report.

---

## 9. Q8 — Minimal MVP UI (Phase A)

All admin screens use the existing `card-premium` surface, `Badge`, `SectionHeading`, `StatCard`,
and `button-secondary` primitives, and live under the admin shell (gated by `requireAdmin`). The
builder is **structured fields, not a visual editor.**

### 9.1 List — `/admin/landing-pages`

```
┌───────────────────────────────────────────────────────────────────────────┐
│ [Badge: ClawLabsLocal]   Landing pages                 [ + New page ]       │
│ Filters: [status ▾] [niche ▾] [city ▾]   search [____________]             │
├───────────────────────────────────────────────────────────────────────────┤
│ Slug                                  Niche / City        Status     Updated│
│ aesthetic-clinic-nottingham           Aesthetic·Notts     ● Published 2d    │
│ dentist-leicester                     Dentist·Leicester   ○ Draft     1h    │
│ beauty-salon-coventry                 Beauty·Coventry     ◐ Draft     5d    │
│   row actions: [ Edit ] [ Preview ] [ Publish/Unpublish ] [ Open ↗ ]        │
└───────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Create / Edit — `/admin/landing-pages/new` and `/[id]`

```
┌──────────────── card-premium ─────────────────────────────────────────────┐
│ Template: ( Local clinic ▾ )   ← prefills sections from default_content     │
│ ── Targeting ───────────────────────────────────────────────────────────── │
│   Niche [ aesthetic-clinic ]  City [ Nottingham ]  Region [ East Midlands ] │
│   Slug  [ aesthetic-clinic-nottingham ]   (auto from niche+city, editable)  │
│ ── SEO ──────────────────────────────────────────────────────────────────  │
│   SEO title [____________________]  (length meter)                          │
│   Meta description [_____________________________________] (length meter)   │
│   Canonical [/lp/aesthetic-clinic-nottingham]  [ ] noindex                  │
│ ── Content (SeoPage shape) ───────────────────────────────────────────────  │
│   H1 [______]  Subheading [______]                                          │
│   Pains[+] Benefits[+] Features[+] Use cases[+]  (repeatable text rows)     │
│   FAQ[+]  (question / answer pairs, min 3 to publish)                        │
│ ── Local business schema (optional) ──────────────────────────────────────  │
│   Business name / address / phone / services[+] / rating(value,count)       │
│ ───────────────────────────────────────────────────────────────────────── │
│ [ Save draft ]   [ Preview ]   [ Publish ]   ▸ validation summary panel     │
└────────────────────────────────────────────────────────────────────────────┘
```

### 9.3 Preview — `/admin/landing-pages/[id]/preview`

Admin-only render of the draft through the real public template (so what you preview is what
publishes), with a persistent "DRAFT — not public, noindex" banner. Never accessible to anon users.

### 9.4 Publish / Unpublish

Buttons on the list and edit screens hit the publish/unpublish API, which flips status, sets/clears
`published_at`, and revalidates the public path + sitemap. A confirm step on publish surfaces the
validation gate results.

---

## 10. Q9 — Security

- **Admin-only builder.** Every `/admin/landing-pages/*` page and `/api/admin/landing-pages/*` route
  is gated by `requireAdmin()` (existing helper: `ADMIN_EMAILS` allowlist **or**
  `profiles.role = 'admin'`). No customer access in Phase A.
- **Public sees published only.** RLS on `landing_pages` grants anon/authenticated `select` only
  where `status = 'published'`; the public loader selects an explicit safe column set. Drafts and
  archived rows are invisible to the public route and return `notFound()`.
- **Writes go through the service role**, never a client insert/update path (mirrors the audit /
  visibility stores). Templates are not publicly readable.
- **Events** are written server-side (the public page posts through a server action / lightweight
  endpoint), capturing **no PII** — coarse referrer/device/utm only; no cookies, no IP storage in
  Phase A.
- **Input safety.** Slugs validated against `^[a-z0-9]+(?:-[a-z0-9]+)*$`; content is rendered as
  text (no raw HTML injection from fields); JSON-LD is `JSON.stringify`-encoded so field values
  cannot break out of the script context.
- **Rate limiting.** New `landingAdminRateLimit` (admin CRUD) and a small public-event limiter,
  both via the existing `checkRateLimit` fail-open wrapper.

---

## 11. Risks & edge cases

1. **Doorway / thin-content penalty (highest risk).** Programmatic `/lp/<niche>-<city>` pages are
   exactly the pattern Google's doorway-page policy targets. Mitigations baked into the design:
   a publish-time minimum-word-count + uniqueness check; required locally-specific content (real
   city context, distinct FAQ per page, genuine services); no auto-generated near-duplicate spinning
   in Phase A; and a cap on how many near-identical pages can be published before a human review
   step. **Phase B AI generation must amplify uniqueness, not mass-produce duplicates.**
2. **Fabricated structured data.** Emitting `AggregateRating`/`LocalBusiness` for a business that
   isn't really there is a trust and policy risk. Rule: omit any schema block whose inputs aren't
   genuinely provided; never synthesise ratings or addresses.
3. **Slug collisions & churn.** Unique constraint + auto-suggested slugs; archived slugs are not
   silently reused. Consider returning **410 Gone** (not 404) for deliberately retired published
   slugs so search engines de-index cleanly.
4. **Stale cache after edits.** ISR + on-demand `revalidatePath` on publish/unpublish; without it,
   a published edit could serve stale HTML. Sitemap must refresh in the same flow.
5. **Local relevance accuracy.** Wrong region/city pairings ("dentist-leicester" describing the
   wrong area) erode trust; targeting fields are explicit and previewed before publish.
6. **Index bloat / cannibalisation.** Too many overlapping local pages can compete with each other
   and with `/seo/*` pages. Keep canonical paths clean and monitor in Phase D.
7. **Migration corruption / large-file edits.** (Operational note for whoever implements this:) the
   working tree has shown file-truncation issues on large writes — author migrations and big
   components in modest chunks and verify on disk.
8. **Admin auth dependency.** The whole builder's security rests on `requireAdmin`; any regression
   there exposes the CRUD surface. Add explicit tests for the admin gate on these routes.

---

## 12. What NOT to build yet

- **No AI content generation** (that is Phase B) — Phase A is manual structured entry only.
- **No customer/portal-facing builder** (Phase C) — admin-only first.
- **No visual drag-and-drop / WYSIWYG editor** — structured fields + templates are sufficient and
  far safer for SEO consistency.
- **No page versioning / snapshot history table** — single working copy + publish promotion in
  Phase A; add versioning only if non-destructive rollback becomes a real requirement.
- **No A/B testing, personalisation, or multivariate variants.**
- **No custom domains / multi-tenant hosting** for these pages — single domain under `/lp`.
- **No third-party analytics or tracking pixels** — first-party `landing_page_events` only.
- **No separate ClawLabsLocal codebase/app** until a concrete domain/deploy/billing reason exists.
- **No automated mass page generation** from scraper/lead data — explicitly out of scope and a
  doorway-penalty hazard; any future automation goes through human review.

---

## 13. Rollout plan

| Phase | Scope | Deliverables | Exit criteria |
| --- | --- | --- | --- |
| **A — Admin manual builder** | This document | Migrations (`landing_pages`, `landing_page_templates`, `landing_page_events`); `src/lib/landing/{types,store,schema,slug,validate}.ts`; admin CRUD API + `requireAdmin`; admin list/create/edit/preview UI; public `/lp/[slug]` with metadata + JSON-LD + ISR; sitemap entries; 1–2 seed templates | An admin can create, preview, publish, and unpublish a local page that renders with correct metadata + schema and passes the thin-content gate |
| **B — AI-assisted content** | Generation help | Server-side draft generation that *pre-fills* fields (uniqueness-first, human-edit-required), grounded in niche/city + audit/visibility vocabulary; never auto-publishes | Admin can generate a distinct, locally-relevant draft and edit before publish |
| **C — Customer portal version** | Self-serve | Portal surface for customers to request/edit their own page(s) within guardrails; per-customer RLS; quota/limits; approval workflow | A customer can manage their own page without admin access to others' pages |
| **D — Connect to improvement tracking** | Closed loop | Wire Audit / AI Visibility / Competitor Intelligence signals into a "pages to build" queue; correlate published pages with visibility-factor improvement + `landing_page_events` engagement; reporting | A report shows pages built from gaps and their measured visibility/engagement impact |

---

## 14. Module layout (new files only — for the eventual Phase A build)

```
supabase/migrations/2026XXXX_add_landing_pages.sql
src/lib/landing/
  types.ts        # LandingContent, LandingPageRow, status, engine version
  store.ts        # admin-client CRUD + getPublishedLandingPage (mirrors audit/store.ts)
  schema.ts       # JSON-LD graph builder (LocalBusiness / Service / FAQPage)
  slug.ts         # slug generation + validation
  validate.ts     # publish-gate (required fields, thin-content + uniqueness checks)
src/app/admin/landing-pages/
  page.tsx                 # list
  new/page.tsx             # create
  [id]/page.tsx            # edit
  [id]/preview/page.tsx    # admin-only draft preview
src/app/api/admin/landing-pages/
  route.ts                 # GET list / POST create
  [id]/route.ts            # GET / PATCH / DELETE
  [id]/publish/route.ts    # POST
  [id]/unpublish/route.ts  # POST
src/app/lp/[slug]/page.tsx # public renderer (generateMetadata + JSON-LD + ISR)
src/components/landing/*   # admin form + repeatable-field inputs; reuse SeoLandingPage for public
```

Only additive edits to existing files: `src/app/sitemap.ts` (DB-driven `/lp` block), the admin nav
(a "Landing pages" link), and `src/lib/rate-limit.ts` (two new limiter constants). Nothing in
scraper, PECR, outreach, billing, auth, or Lead Finder is modified.
