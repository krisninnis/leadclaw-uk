-- 20260624_add_seo_content_status.sql
-- SEO Content Engine — additive status overlay for the content queue.
--
-- The content backlog, scoring, clusters, and recommendations live in code
-- (src/lib/seo/content-engine.ts) as curated data — NOT in the database, and NOT
-- generated programmatically. The only mutable state is a lightweight workflow
-- status per opportunity (planned / in_progress / published), tracked here.
--
-- Strictly additive. Touches nothing else: no changes to Lead Finder, the
-- scraper, outreach, billing, auth, or any existing table. Conventions mirror the
-- other migrations (IF NOT EXISTS, RLS service-role-only, set_updated_at trigger).

begin;

create table if not exists public.seo_content_status (
  id uuid primary key default gen_random_uuid(),
  -- Opportunity slug from CONTENT_BACKLOG (the engine's stable key). Free text so
  -- the code stays the source of truth for which opportunities exist.
  opportunity_slug text not null,
  status text not null default 'planned'
    check (status in ('backlog', 'planned', 'in_progress', 'published')),
  notes text,
  published_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One status row per opportunity (upsert target).
create unique index if not exists seo_content_status_slug_key
  on public.seo_content_status (opportunity_slug);
create index if not exists seo_content_status_status_idx
  on public.seo_content_status (status);

alter table public.seo_content_status enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'seo_content_status'
      and policyname = 'seo_content_status_service_role_all'
  ) then
    create policy seo_content_status_service_role_all
      on public.seo_content_status
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

drop trigger if exists set_seo_content_status_updated_at on public.seo_content_status;
create trigger set_seo_content_status_updated_at
before update on public.seo_content_status
for each row
execute function public.set_updated_at();

commit;
