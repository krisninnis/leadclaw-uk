-- 20260622_add_outreach_queue.sql
-- Outreach Queue Actions (Skip / Mark Called / Do Not Contact)
-- Adds the outreach_queue table that tracks per-lead queue management actions.
-- This is queue-management only: no email sending is performed by these actions.
--
-- Reuses the existing public.email_suppressions table for Do Not Contact (no new
-- suppression table is created here).
--
-- RLS enabled: full service role access (for admin API routes).
-- Uses the existing public.set_updated_at() trigger function for updated_at.

begin;

create table if not exists public.outreach_queue (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'skipped', 'called', 'do_not_contact')),
  skipped_at timestamptz,
  called_at timestamptz,
  do_not_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

-- One queue row per lead.
create unique index if not exists outreach_queue_lead_id_key
  on public.outreach_queue (lead_id);

-- Helps the queue preview exclude actioned leads by status.
create index if not exists outreach_queue_status_idx
  on public.outreach_queue (status);

-- Enable Row Level Security
alter table public.outreach_queue enable row level security;

-- Configure Service Role Policy
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'outreach_queue'
      and policyname = 'outreach_queue_service_role_all'
  ) then
    create policy outreach_queue_service_role_all
      on public.outreach_queue
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

-- Setup updated_at maintenance trigger
drop trigger if exists set_outreach_queue_updated_at on public.outreach_queue;
create trigger set_outreach_queue_updated_at
before update on public.outreach_queue
for each row
execute function public.set_updated_at();

commit;
