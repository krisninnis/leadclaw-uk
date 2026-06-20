-- Website Audit — production persistence reconciliation.
--
-- Production previously logged: "Could not find table 'public.audit_leads' in
-- the schema cache". Root cause: audit_leads (and its hardening columns + the
-- (email, website_url) unique key the upsert relies on) is defined only in
-- migrations, and either the migrations had not been applied or PostgREST's
-- schema cache had not been reloaded after they were. Because the public audit
-- route is fail-closed (it refuses to release a report when lead capture
-- fails), that drift silently blocked EVERY public audit.
--
-- This migration is fully idempotent: it re-asserts the complete audit_leads
-- shape (safe no-op where already correct, self-healing where partial) and then
-- reloads the PostgREST schema cache so the Data API sees the table immediately.

begin;

create extension if not exists pgcrypto;

-- Base table (matches 20260619143634_add_audit_leads.sql).
create table if not exists public.audit_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 320),
  website_url text not null check (char_length(website_url) between 3 and 2048),
  audit_score integer not null check (audit_score between 0 and 100),
  audit_summary text not null,
  source text not null default 'free_audit'
    check (char_length(source) between 1 and 80)
);

-- Hardening columns (matches 20260619151202_harden_public_audit_leads.sql).
alter table public.audit_leads
  add column if not exists category_scores jsonb not null default '{}'::jsonb,
  add column if not exists top_recommendations jsonb not null default '[]'::jsonb,
  add column if not exists report_context jsonb not null default '{}'::jsonb,
  add column if not exists consent boolean not null default false,
  add column if not exists consent_text text,
  add column if not exists consent_version text,
  add column if not exists consent_captured_at timestamptz;

-- Access control: service-role only (PII-bearing).
alter table public.audit_leads enable row level security;
revoke all on table public.audit_leads from anon, authenticated;
grant select, insert, update, delete on table public.audit_leads to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_leads'
      and policyname = 'audit_leads_service_role_all'
  ) then
    create policy audit_leads_service_role_all
      on public.audit_leads for all to service_role
      using (true) with check (true);
  end if;

  -- (email, website_url) unique key — REQUIRED by the upsert onConflict in
  -- src/lib/audit/leads-store.ts. Without it, every public audit 503s.
  if not exists (
    select 1 from pg_constraint
    where conname = 'audit_leads_email_website_unique'
      and conrelid = 'public.audit_leads'::regclass
  ) then
    -- Collapse any historical duplicates before adding the key.
    with ranked as (
      select id, row_number() over (
        partition by email, website_url
        order by consent desc, consent_captured_at desc nulls last,
                 created_at desc, id desc
      ) as rn
      from public.audit_leads
    )
    delete from public.audit_leads as lead
    using ranked where lead.id = ranked.id and ranked.rn > 1;

    alter table public.audit_leads
      add constraint audit_leads_email_website_unique unique (email, website_url);
  end if;
end $$;

create index if not exists idx_audit_leads_created_at
  on public.audit_leads (created_at desc);
create index if not exists idx_audit_leads_email_created_at
  on public.audit_leads (lower(email), created_at desc);

commit;

-- Force PostgREST to pick up the table immediately (fixes the "schema cache"
-- error without waiting for the periodic auto-reload). Safe to run repeatedly.
notify pgrst, 'reload schema';
