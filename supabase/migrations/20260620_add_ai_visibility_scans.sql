-- 20260620_add_ai_visibility_scans.sql
-- Phase 3 — AI Visibility (Foundation)
-- Adds the ai_visibility_scans table that stores a single AI-visibility scan:
-- the overall visibility score, the four category scores (content, authority,
-- citation, schema), structured recommendations, and run metadata.
--
-- A scan is *derived* from the user's most recent website_audits row (see
-- src/lib/visibility/*). No external AI provider is queried in this phase —
-- provider results (ChatGPT, Perplexity, Google AI Overviews, Claude) will be
-- layered into meta.providers later without a schema change.
--
-- Conventions mirrored from supabase/migrations/20260615_add_website_audits.sql:
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
-- ai_visibility_scans
-- One row per visibility scan. The newest row per (user_id, website_url) is
-- the "latest" scan; older rows form the history / trend timeline.
-- -------------------------------------------------------------------
create table if not exists public.ai_visibility_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Normalised website URL (https origin, no trailing slash). Matches the
  -- website_audits.website_url value the scan was derived from.
  website_url text not null,

  -- Lifecycle of the scan. "queued"/"running" reserved for the future async
  -- worker; this phase writes "completed" or "failed" synchronously.
  status text not null default 'completed'
    check (status in ('queued', 'running', 'completed', 'failed')),
  error text,

  -- Scores, all 0..100.
  visibility_score int not null default 0
    check (visibility_score between 0 and 100),
  content_score int not null default 0
    check (content_score between 0 and 100),
  authority_score int not null default 0
    check (authority_score between 0 and 100),
  citation_score int not null default 0
    check (citation_score between 0 and 100),
  schema_score int not null default 0
    check (schema_score between 0 and 100),

  -- Prioritised, human-readable recommendations derived from weak factors.
  recommendations jsonb not null default '[]'::jsonb,

  -- Flexible run metadata. Owned by the app (see src/lib/visibility/types.ts)
  -- so the scoring framework — and future provider results — can evolve
  -- without a schema change. Typically holds:
  --   { engineVersion, sourceAuditId, auditedAt, factors, providers }
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_visibility_scans enable row level security;

-- Service role (server / admin client) has full access.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_visibility_scans'
      and policyname = 'ai_visibility_scans_service_role_all'
  ) then
    create policy ai_visibility_scans_service_role_all
      on public.ai_visibility_scans
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

-- Authenticated users may read their own scans (writes go through the
-- service-role API so we do not expose a client insert/update path).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_visibility_scans'
      and policyname = 'ai_visibility_scans_read_own'
  ) then
    create policy ai_visibility_scans_read_own
      on public.ai_visibility_scans
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

-- "Latest scan for this user + url" and per-url trend timeline.
create index if not exists idx_ai_visibility_scans_user_url_created_at
  on public.ai_visibility_scans (user_id, website_url, created_at desc);

-- "All my scans, newest first" (history page).
create index if not exists idx_ai_visibility_scans_user_created_at
  on public.ai_visibility_scans (user_id, created_at desc);

drop trigger if exists set_ai_visibility_scans_updated_at on public.ai_visibility_scans;
create trigger set_ai_visibility_scans_updated_at
before update on public.ai_visibility_scans
for each row
execute function public.set_updated_at();

commit;
