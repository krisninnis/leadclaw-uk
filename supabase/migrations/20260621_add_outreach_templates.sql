-- 20260621_add_outreach_templates.sql
-- Phase 1A — Outreach Queue (Templates)
-- Adds the outreach_templates table that stores customizable templates for outbound emails.
--
-- RLS enabled: full service role access (for admin API routes).
-- Sets up updated_at trigger using the existing public.set_updated_at() trigger function.

begin;

create table if not exists public.outreach_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  subject_template text not null,
  body_template text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.outreach_templates enable row level security;

-- Configure Service Role Policy
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'outreach_templates'
      and policyname = 'outreach_templates_service_role_all'
  ) then
    create policy outreach_templates_service_role_all
      on public.outreach_templates
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

-- Seed default corporate pitch template
insert into public.outreach_templates (name, subject_template, body_template)
values (
  'Default Corporate Pitch',
  'Quick idea for {{company_name}}',
  'Hi,\n\nI was looking at {{company_name}} and noticed a few areas that may be costing you enquiries and bookings.\n\nMany {{niche}} businesses lose potential patients/customers because enquiries arrive outside opening hours, calls go unanswered, or website visitors leave before making contact.\n\nWe''ve built a system that answers enquiries instantly, captures lead details, and helps businesses convert more of the traffic they''re already paying for.\n\nI put together a quick audit for your business and would be happy to share the findings if useful.\n\nWould you be open to a brief look?\n\nThanks,\n\nKris\nLeadClaw'
) on conflict (name) do nothing;

-- Setup updated_at maintenance trigger
drop trigger if exists set_outreach_templates_updated_at on public.outreach_templates;
create trigger set_outreach_templates_updated_at
before update on public.outreach_templates
for each row
execute function public.set_updated_at();

commit;
