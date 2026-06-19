-- Website Audit V2.1b — isolated public audit lead capture.
-- The browser never talks to this table directly: the public route writes via
-- the server-only service-role client after a successful audit run.

begin;

create extension if not exists pgcrypto;

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

alter table public.audit_leads enable row level security;

-- Supabase no longer guarantees automatic Data API grants for new tables.
-- Only the service role can reach this PII-bearing table.
revoke all on table public.audit_leads from anon, authenticated;
grant select, insert, update, delete on table public.audit_leads to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_leads'
      and policyname = 'audit_leads_service_role_all'
  ) then
    create policy audit_leads_service_role_all
      on public.audit_leads
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

create index if not exists idx_audit_leads_created_at
  on public.audit_leads (created_at desc);

create index if not exists idx_audit_leads_email_created_at
  on public.audit_leads (lower(email), created_at desc);

commit;
