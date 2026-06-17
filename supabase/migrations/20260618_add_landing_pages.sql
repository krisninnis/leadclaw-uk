-- 20260618_add_landing_pages.sql
-- ClawLabsLocal — Landing Page Builder (Phase A)
-- Adds three tables that power the admin-only local landing page builder:
--   * landing_page_templates — reusable content scaffolds + JSON-LD profile
--   * landing_pages           — one row per page; the public route reads only
--                               status='published'
--   * landing_page_events     — first-party, PII-free engagement events
--
-- Conventions mirrored from supabase/migrations/20260615_add_website_audits.sql
-- and 20260620_add_ai_visibility_scans.sql:
--   * pgcrypto for gen_random_uuid()
--   * shared set_updated_at() trigger (idempotent redefinition)
--   * RLS enabled; service_role full access via a pg_policies guard
--   * purposeful indexes for the admin list + public lookup + sitemap
--
-- Scope guard: strictly additive. Touches no scraper / PECR / outreach /
-- billing / auth / Lead Finder objects.

begin;

create extension if not exists pgcrypto;

-- -------------------------------------------------------------------
-- Shared updated_at trigger function (idempotent — also defined by
-- earlier migrations; redefining is safe and keeps this file standalone).
-- -------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -------------------------------------------------------------------
-- landing_page_templates
-- Reusable content scaffolds (e.g. 'local-clinic', 'local-trade').
-- A template provides a default content skeleton + the JSON-LD profile to emit.
-- -------------------------------------------------------------------
create table if not exists public.landing_page_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,                 -- 'local-clinic', 'local-trade'
  name text not null,
  description text,
  -- Default content skeleton (same shape as landing_pages.content) merged into
  -- a new page on creation. App-owned shape; see src/lib/landing/types.ts.
  default_content jsonb not null default '{}'::jsonb,
  -- Which schema.org types this template emits.
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

  -- URL slug, unique. Validated app-side (lowercase, [a-z0-9-], no
  -- leading/trailing dash). See src/lib/landing/slug.ts.
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

  -- SEO metadata. Kept as columns (not buried in jsonb) because they are
  -- queried/validated and surfaced in the admin list.
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
  -- Phase A; populated in Phase D without a schema change.
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
  -- Coarse, privacy-preserving context only (no PII): referrer host, device
  -- class, utm fields. No IP, no cookies in Phase A.
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- RLS ---------------------------------------------------------------
alter table public.landing_pages           enable row level security;
alter table public.landing_page_templates  enable row level security;
alter table public.landing_page_events      enable row level security;

-- Service role (server / admin client) has full access on all three tables.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'landing_pages'
      and policyname = 'landing_pages_service_role_all'
  ) then
    create policy landing_pages_service_role_all
      on public.landing_pages
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'landing_page_templates'
      and policyname = 'landing_page_templates_service_role_all'
  ) then
    create policy landing_page_templates_service_role_all
      on public.landing_page_templates
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'landing_page_events'
      and policyname = 'landing_page_events_service_role_all'
  ) then
    create policy landing_page_events_service_role_all
      on public.landing_page_events
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

-- Public read is limited to *published* landing pages (drafts and archived
-- rows stay invisible to anon/authenticated). The public loader additionally
-- selects only the safe column set server-side; this policy guards row
-- visibility. Templates and events have NO public read policy.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'landing_pages'
      and policyname = 'landing_pages_read_published'
  ) then
    create policy landing_pages_read_published
      on public.landing_pages
      for select
      to anon, authenticated
      using (status = 'published');
  end if;
end $$;

-- Indexes -----------------------------------------------------------
create unique index if not exists idx_landing_pages_slug
  on public.landing_pages (slug);
create index if not exists idx_landing_pages_status_published_at
  on public.landing_pages (status, published_at desc);
create index if not exists idx_landing_pages_niche_city
  on public.landing_pages (niche, city);
create index if not exists idx_landing_pages_updated_at
  on public.landing_pages (updated_at desc);
create index if not exists idx_landing_page_events_page_type_created
  on public.landing_page_events (landing_page_id, event_type, created_at desc);

-- Triggers ----------------------------------------------------------
drop trigger if exists set_landing_pages_updated_at on public.landing_pages;
create trigger set_landing_pages_updated_at
before update on public.landing_pages
for each row execute function public.set_updated_at();

drop trigger if exists set_landing_page_templates_updated_at on public.landing_page_templates;
create trigger set_landing_page_templates_updated_at
before update on public.landing_page_templates
for each row execute function public.set_updated_at();

-- Seed templates ----------------------------------------------------
-- Two starting scaffolds. default_content matches src/lib/landing/types.ts
-- (LandingContent). Idempotent via the unique `key`.
insert into public.landing_page_templates (key, name, description, default_content, schema_types)
values
  (
    'local-clinic',
    'Local clinic',
    'Local SEO page for a clinic niche in a specific city (aesthetic, dental, beauty, etc.).',
    '{
      "h1": "",
      "subheading": "",
      "pains": [],
      "benefits": [],
      "features": [],
      "useCases": [],
      "faq": [],
      "relatedLinks": []
    }'::jsonb,
    array['LocalBusiness','Service','FAQPage']
  ),
  (
    'local-trade',
    'Local trade',
    'Local SEO page for a trade / local-service niche in a specific city (plumber, electrician, etc.).',
    '{
      "h1": "",
      "subheading": "",
      "pains": [],
      "benefits": [],
      "features": [],
      "useCases": [],
      "faq": [],
      "relatedLinks": []
    }'::jsonb,
    array['LocalBusiness','Service','FAQPage']
  )
on conflict (key) do nothing;

comment on table public.landing_pages is
  'ClawLabsLocal landing pages. Admin-only writes via service role; public reads published rows only.';
comment on table public.landing_page_templates is
  'ClawLabsLocal reusable content scaffolds. No public read; service role only.';
comment on table public.landing_page_events is
  'ClawLabsLocal first-party, PII-free engagement events. Service role only.';

commit;
