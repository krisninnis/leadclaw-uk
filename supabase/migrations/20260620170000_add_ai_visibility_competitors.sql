-- 20260620170000_add_ai_visibility_competitors.sql
-- AI Readiness — Competitor Benchmarking V1
--
-- Adds two additive tables so a user can benchmark their AI Readiness against a
-- small set (2–5) of manually entered competitor website URLs:
--
--   ai_visibility_competitors       — the competitor sites the user tracks.
--   ai_visibility_competitor_scans  — one AI-readiness scan per competitor
--                                     audit run (overall + 4 category scores in
--                                     a `scores` jsonb, plus recommendations).
--
-- A competitor scan is derived from a fresh website audit of the competitor URL
-- using the SAME readiness scoring as the user's own report. The competitor
-- audit is NOT persisted to website_audits (that table is the user's own audit
-- history), so source_audit_id stays null in V1 — the column exists so a future
-- phase can link a persisted audit without a schema change.
--
-- Conventions mirrored from supabase/migrations/20260620_add_ai_visibility_scans.sql:
--   * pgcrypto for gen_random_uuid()
--   * RLS enabled; service_role full access + owner read access
--   * set_updated_at() trigger for updated_at maintenance
--   * indexes for the dashboard "latest" and "list" queries
--
-- Scope guard (STRICT): ADDITIVE ONLY. No DROP, no destructive ALTER, no data
-- migration. IF NOT EXISTS / idempotent guards throughout so this is safe to
-- re-run. Does NOT touch any existing table, Billing, Stripe, Outreach, Lead
-- Finder, Telephony, or the existing ai_visibility_scans table.

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
-- ai_visibility_competitors
-- The competitor sites a user is benchmarking against. One row per
-- (user_id, website_url); the app normalises the URL before insert.
-- -------------------------------------------------------------------
create table if not exists public.ai_visibility_competitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Normalised competitor URL (https origin, no trailing slash), matching the
  -- value the readiness scan was derived from.
  website_url text not null,

  -- Optional friendly name shown in the UI (defaults to the host at the app
  -- layer when omitted).
  label text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_visibility_competitors enable row level security;

-- One competitor URL per user (prevents duplicate entries / double-counting).
create unique index if not exists ux_ai_visibility_competitors_user_url
  on public.ai_visibility_competitors (user_id, website_url);

-- "All my competitors, newest first."
create index if not exists idx_ai_visibility_competitors_user_created_at
  on public.ai_visibility_competitors (user_id, created_at desc);

-- Service role (server / admin client) has full access.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_visibility_competitors'
      and policyname = 'ai_visibility_competitors_service_role_all'
  ) then
    create policy ai_visibility_competitors_service_role_all
      on public.ai_visibility_competitors
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

-- Authenticated users may read their own competitors (writes go through the
-- service-role API so we do not expose a client insert/update/delete path).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_visibility_competitors'
      and policyname = 'ai_visibility_competitors_read_own'
  ) then
    create policy ai_visibility_competitors_read_own
      on public.ai_visibility_competitors
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

drop trigger if exists set_ai_visibility_competitors_updated_at on public.ai_visibility_competitors;
create trigger set_ai_visibility_competitors_updated_at
before update on public.ai_visibility_competitors
for each row
execute function public.set_updated_at();

-- -------------------------------------------------------------------
-- ai_visibility_competitor_scans
-- One row per competitor audit run. The newest row per competitor_id is the
-- "latest" scan rendered in the benchmark table.
-- -------------------------------------------------------------------
create table if not exists public.ai_visibility_competitor_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  competitor_id uuid not null
    references public.ai_visibility_competitors(id) on delete cascade,

  -- Nullable: competitor audits are not persisted to website_audits in V1, so
  -- this stays null. Reserved for a future phase that links a persisted audit.
  source_audit_id uuid,

  -- Normalised competitor URL the scan was run against.
  website_url text not null,

  -- Lifecycle of the scan. "queued"/"running" reserved for a future async
  -- worker; this phase writes "completed" or "failed" synchronously. A failed
  -- scan (site unreachable) is kept so the UI can show "couldn't check".
  status text not null default 'completed'
    check (status in ('queued', 'running', 'completed', 'failed')),
  error text,

  -- The readiness scores for this competitor: overall visibility_score plus the
  -- four category scores (content, authority, citation, schema), all 0..100.
  -- Stored as jsonb (not columns) so this mirrors the ScanResult shape and can
  -- evolve without a schema change.
  scores jsonb not null default '{}'::jsonb,

  -- Prioritised, human-readable recommendations derived from weak factors.
  recommendations jsonb not null default '[]'::jsonb,

  -- Run metadata (engineVersion, breakdown, scannedAt, audit status code, ...).
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

alter table public.ai_visibility_competitor_scans enable row level security;

-- "Latest scan for this competitor" (benchmark table) and per-competitor trend.
create index if not exists idx_ai_vis_competitor_scans_competitor_created_at
  on public.ai_visibility_competitor_scans (competitor_id, created_at desc);

-- "All scans for this user, newest first."
create index if not exists idx_ai_vis_competitor_scans_user_created_at
  on public.ai_visibility_competitor_scans (user_id, created_at desc);

-- Service role (server / admin client) has full access.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_visibility_competitor_scans'
      and policyname = 'ai_visibility_competitor_scans_service_role_all'
  ) then
    create policy ai_visibility_competitor_scans_service_role_all
      on public.ai_visibility_competitor_scans
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

-- Authenticated users may read their own competitor scans.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_visibility_competitor_scans'
      and policyname = 'ai_visibility_competitor_scans_read_own'
  ) then
    create policy ai_visibility_competitor_scans_read_own
      on public.ai_visibility_competitor_scans
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

commit;
