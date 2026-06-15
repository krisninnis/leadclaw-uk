-- 20260615_add_website_audits.sql
-- Phase 2 — AI Website Audit (V1)
-- Adds the website_audits table that stores a full audit run for a URL,
-- the five category scores, an overall score, and structured recommendations.
--
-- Conventions mirrored from existing migrations:
--   * pgcrypto for gen_random_uuid()
--   * RLS enabled; service_role full access + owner read access
--   * set_updated_at() trigger for updated_at maintenance
--   * indexes for the dashboard "latest" and "history" queries

begin;

create extension if not exists pgcrypto;

-- -------------------------------------------------------------------
-- Shared updated_at trigger function (idempotent — also defined by
-- earlier migrations; redefining is safe and keeps this file standalone)
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
-- website_audits
-- One row per audit run. The newest row per (user_id, website_url) is
-- the "latest" audit; older rows form the history timeline.
-- -------------------------------------------------------------------
create table if not exists public.website_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Normalised audited URL (https origin, no trailing slash) + the raw
  -- value the user typed, kept for display.
  website_url text not null,
  input_url text,
  final_url text,

  -- Lifecycle of the run. "queued"/"running" reserved for the future
  -- async worker; V1 writes "completed" or "failed" synchronously.
  status text not null default 'completed'
    check (status in ('queued', 'running', 'completed', 'failed')),
  error text,

  -- Scores, all 0..100.
  overall_score int not null default 0
    check (overall_score between 0 and 100),
  health_score int not null default 0
    check (health_score between 0 and 100),
  seo_score int not null default 0
    check (seo_score between 0 and 100),
  trust_score int not null default 0
    check (trust_score between 0 and 100),
  conversion_score int not null default 0
    check (conversion_score between 0 and 100),
  ai_readiness_score int not null default 0
    check (ai_readiness_score between 0 and 100),

  -- Per-check results, grouped by category. Shape is owned by the app
  -- (see src/lib/audit/types.ts) so the scoring framework can evolve
  -- without a schema change.
  checks jsonb not null default '{}'::jsonb,

  -- Prioritised, human-readable recommendations derived from failed checks.
  recommendations jsonb not null default '[]'::jsonb,

  -- Lightweight crawl metadata (status code, response ms, bytes, engine).
  meta jsonb not null default '{}'::jsonb,

  -- Schema version of the scoring framework that produced this row.
  engine_version text not null default 'v1',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.website_audits enable row level security;

-- Service role (server / admin client) has full access.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'website_audits'
      and policyname = 'website_audits_service_role_all'
  ) then
    create policy website_audits_service_role_all
      on public.website_audits
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

-- Authenticated users may read their own audits (writes go through the
-- service-role API so we do not expose a client insert/update path).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'website_audits'
      and policyname = 'website_audits_read_own'
  ) then
    create policy website_audits_read_own
      on public.website_audits
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

-- "Latest audit for this user + url" and history timeline.
create index if not exists idx_website_audits_user_url_created_at
  on public.website_audits (user_id, website_url, created_at desc);

-- "All my audits, newest first" (history page).
create index if not exists idx_website_audits_user_created_at
  on public.website_audits (user_id, created_at desc);

drop trigger if exists set_website_audits_updated_at on public.website_audits;
create trigger set_website_audits_updated_at
before update on public.website_audits
for each row
execute function public.set_updated_at();

commit;
