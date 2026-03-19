-- LeadClaw production hardening
-- Purpose:
-- 1. Ensure repo schema matches application usage
-- 2. Add missing operational tables referenced by app code
-- 3. Add indexes for common dashboard / admin / outreach queries
-- 4. Keep RLS posture explicit and safe

begin;

create extension if not exists pgcrypto;

-- -------------------------------------------------------------------
-- agent_commands
-- Referenced by src/app/api/agent/command/route.ts
-- -------------------------------------------------------------------
create table if not exists public.agent_commands (
  id uuid primary key default gen_random_uuid(),
  command text not null,
  repo text not null default 'leadclaw-uk',
  status text not null default 'received',
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_commands_status_check
    check (status in ('received', 'queued', 'running', 'completed', 'failed'))
);

alter table public.agent_commands enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'agent_commands'
      and policyname = 'agent_commands_service_role_all'
  ) then
    create policy agent_commands_service_role_all
      on public.agent_commands
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

create index if not exists idx_agent_commands_status_created_at
  on public.agent_commands (status, created_at desc);

create index if not exists idx_agent_commands_repo_created_at
  on public.agent_commands (repo, created_at desc);

drop trigger if exists set_agent_commands_updated_at on public.agent_commands;
create trigger set_agent_commands_updated_at
before update on public.agent_commands
for each row
execute function public.set_updated_at();

-- -------------------------------------------------------------------
-- billing_notifications
-- Used by billing / trial reminder jobs
-- -------------------------------------------------------------------
create table if not exists public.billing_notifications (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  email text not null,
  stage text not null,
  status text not null default 'pending',
  error text,
  created_at timestamptz not null default now(),
  constraint billing_notifications_stage_check
    check (stage in ('trial_ending_3d', 'trial_ending_1d', 'trial_ended')),
  constraint billing_notifications_status_check
    check (status in ('pending', 'sent', 'failed'))
);

alter table public.billing_notifications enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'billing_notifications'
      and policyname = 'billing_notifications_service_role_all'
  ) then
    create policy billing_notifications_service_role_all
      on public.billing_notifications
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

create unique index if not exists ux_billing_notifications_subscription_stage
  on public.billing_notifications (subscription_id, stage);

create index if not exists idx_billing_notifications_status_created_at
  on public.billing_notifications (status, created_at desc);

-- -------------------------------------------------------------------
-- Performance indexes for common product queries
-- -------------------------------------------------------------------

-- leads: admin lists, outreach queue views, recent leads, score sorting
create index if not exists idx_leads_status_score_created_at
  on public.leads (status, score desc, created_at desc);

create index if not exists idx_leads_created_at
  on public.leads (created_at desc);

create index if not exists idx_leads_clinic_id_created_at
  on public.leads (clinic_id, created_at desc);

-- outreach_events: dashboard metrics and lead timelines
create index if not exists idx_outreach_events_channel_type_created_at
  on public.outreach_events (channel, event_type, created_at desc);

create index if not exists idx_outreach_events_lead_id_created_at
  on public.outreach_events (lead_id, created_at desc);

-- enquiries: clinic portal and widget/admin views
create index if not exists idx_enquiries_clinic_created_at
  on public.enquiries (clinic_id, created_at desc);

-- subscriptions: portal/billing checks and cron jobs
create index if not exists idx_subscriptions_user_updated_at
  on public.subscriptions (user_id, updated_at desc);

commit;