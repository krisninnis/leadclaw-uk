-- 20260623_add_outreach_activity.sql
-- Outreach Activity History (audit trail)
-- Records queue/admin actions taken against a lead so we can see what happened
-- before adding manual email sending later. This is logging/audit only: no
-- emails are sent by anything in this migration.
--
-- Allowed actions (enforced via CHECK):
--   previewed, skipped, called, do_not_contact, email_sent, email_failed,
--   replied, note
-- Only skipped / called / do_not_contact are actively written today.
--
-- RLS enabled: full service role access (for admin API routes).

begin;

create table if not exists public.outreach_activity (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  action text not null
    check (action in (
      'previewed',
      'skipped',
      'called',
      'do_not_contact',
      'email_sent',
      'email_failed',
      'replied',
      'note'
    )),
  user_id uuid,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Useful indexes for filtering and ordering.
create index if not exists outreach_activity_lead_id_idx
  on public.outreach_activity (lead_id);
create index if not exists outreach_activity_action_idx
  on public.outreach_activity (action);
create index if not exists outreach_activity_created_at_idx
  on public.outreach_activity (created_at desc);

-- Enable Row Level Security
alter table public.outreach_activity enable row level security;

-- Configure Service Role Policy
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'outreach_activity'
      and policyname = 'outreach_activity_service_role_all'
  ) then
    create policy outreach_activity_service_role_all
      on public.outreach_activity
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

commit;
