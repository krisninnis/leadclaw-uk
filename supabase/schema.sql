-- Run in Supabase SQL editor
create extension if not exists pgcrypto;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  clinic_name text not null,
  contact_name text not null,
  email text not null,
  phone text not null,
  city text not null,
  website text,
  services text not null,
  lead_volume text,
  notes text,
  agreed boolean not null default false,
  terms_version text,
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  waiver_accepted_at timestamptz,
  agreement_ip text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client',
  clinic_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.client_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sender text not null check (sender in ('client','agent')),
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.system_events (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'info',
  category text not null,
  message text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan text,
  status text,
  trial_end timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  niche text not null,
  company_name text not null,
  website text,
  contact_email text,
  contact_phone text,
  city text,
  source text not null,
  score int not null default 0,
  status text not null default 'new',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outreach_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  channel text not null,
  event_type text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  source text not null default 'website',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.newsletter_issues (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  content_markdown text not null,
  status text not null default 'draft',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  reason text not null default 'unsubscribe',
  created_at timestamptz not null default now()
);

create table if not exists public.retention_clients (
  id uuid primary key default gen_random_uuid(),
  external_key text not null unique,
  client_name text,
  email text,
  phone text,
  service text,
  clinic_name text,
  objection text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.retention_tasks (
  id uuid primary key default gen_random_uuid(),
  retention_client_id uuid not null references public.retention_clients(id) on delete cascade,
  behavior text not null,
  due_at timestamptz not null,
  status text not null default 'queued',
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.retention_events (
  id uuid primary key default gen_random_uuid(),
  retention_task_id uuid references public.retention_tasks(id) on delete set null,
  retention_client_id uuid not null references public.retention_clients(id) on delete cascade,
  behavior text not null,
  channel text not null,
  status text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding_clients (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  business_name text,
  contact_email text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.onboarding_sites (
  id uuid primary key default gen_random_uuid(),
  onboarding_client_id uuid not null references public.onboarding_clients(id) on delete cascade,
  domain text not null,
  platform text not null,
  settings jsonb,
  status text not null default 'pending_install',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.widget_tokens (
  id uuid primary key default gen_random_uuid(),
  onboarding_site_id uuid not null references public.onboarding_sites(id) on delete cascade,
  token text not null unique,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  onboarding_site_id uuid not null references public.onboarding_sites(id) on delete cascade,
  task_type text not null,
  sequence int not null default 1,
  status text not null default 'queued',
  error text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding_reports (
  id uuid primary key default gen_random_uuid(),
  onboarding_site_id uuid not null references public.onboarding_sites(id) on delete cascade,
  report_type text not null,
  content jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_notifications (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  email text not null,
  stage text not null,
  status text not null default 'queued',
  error text,
  created_at timestamptz not null default now(),
  unique (subscription_id, stage)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'client')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.applications enable row level security;
alter table public.profiles enable row level security;
alter table public.client_messages enable row level security;
alter table public.system_events enable row level security;
alter table public.subscriptions enable row level security;
alter table public.leads enable row level security;
alter table public.outreach_events enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_issues enable row level security;
alter table public.email_suppressions enable row level security;
alter table public.retention_clients enable row level security;
alter table public.retention_tasks enable row level security;
alter table public.retention_events enable row level security;
alter table public.onboarding_clients enable row level security;
alter table public.onboarding_sites enable row level security;
alter table public.widget_tokens enable row level security;
alter table public.onboarding_tasks enable row level security;
alter table public.onboarding_reports enable row level security;
alter table public.billing_notifications enable row level security;

-- Public can submit applications only through anon key (insert-only)
drop policy if exists "public_insert_applications" on public.applications;
create policy "public_insert_applications"
  on public.applications
  for insert
  to anon, authenticated
  with check (true);

-- Admin-only reads (service role bypasses RLS anyway)
drop policy if exists "no_direct_read_applications" on public.applications;
create policy "no_direct_read_applications"
  on public.applications
  for select
  to authenticated
  using (false);

-- Profiles: user can read/update own profile
drop policy if exists "read_own_profile" on public.profiles;
create policy "read_own_profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "update_own_profile" on public.profiles;
create policy "update_own_profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Messages: clients can read/write only own thread
drop policy if exists "read_own_messages" on public.client_messages;
create policy "read_own_messages"
  on public.client_messages
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "insert_own_messages" on public.client_messages;
create policy "insert_own_messages"
  on public.client_messages
  for insert
  to authenticated
  with check (auth.uid() = user_id and sender = 'client');

-- System events are admin/service-role only
drop policy if exists "deny_system_events" on public.system_events;
create policy "deny_system_events"
  on public.system_events
  for all
  to authenticated
  using (false)
  with check (false);

-- Subscriptions: users can read only their own
drop policy if exists "read_own_subscriptions" on public.subscriptions;
create policy "read_own_subscriptions"
  on public.subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

-- no direct writes from client role
drop policy if exists "deny_write_subscriptions" on public.subscriptions;
create policy "deny_write_subscriptions"
  on public.subscriptions
  for all
  to authenticated
  using (false)
  with check (false);

-- leads/events are admin/service-role only for now
drop policy if exists "deny_leads" on public.leads;
create policy "deny_leads"
  on public.leads for all to authenticated
  using (false) with check (false);

drop policy if exists "deny_outreach_events" on public.outreach_events;
create policy "deny_outreach_events"
  on public.outreach_events for all to authenticated
  using (false) with check (false);

drop policy if exists "public_insert_newsletter_subscribers" on public.newsletter_subscribers;
create policy "public_insert_newsletter_subscribers"
  on public.newsletter_subscribers for insert to anon, authenticated
  with check (true);

drop policy if exists "deny_newsletter_subscribers_read" on public.newsletter_subscribers;
create policy "deny_newsletter_subscribers_read"
  on public.newsletter_subscribers for select to authenticated
  using (false);

drop policy if exists "deny_newsletter_issues" on public.newsletter_issues;
create policy "deny_newsletter_issues"
  on public.newsletter_issues for all to authenticated
  using (false) with check (false);

drop policy if exists "deny_email_suppressions" on public.email_suppressions;
create policy "deny_email_suppressions"
  on public.email_suppressions for all to authenticated
  using (false) with check (false);

drop policy if exists "deny_retention_clients" on public.retention_clients;
create policy "deny_retention_clients"
  on public.retention_clients for all to authenticated
  using (false) with check (false);

drop policy if exists "deny_retention_tasks" on public.retention_tasks;
create policy "deny_retention_tasks"
  on public.retention_tasks for all to authenticated
  using (false) with check (false);

drop policy if exists "deny_retention_events" on public.retention_events;
create policy "deny_retention_events"
  on public.retention_events for all to authenticated
  using (false) with check (false);

drop policy if exists "deny_onboarding_clients" on public.onboarding_clients;
create policy "deny_onboarding_clients"
  on public.onboarding_clients for all to authenticated
  using (false) with check (false);

drop policy if exists "deny_onboarding_sites" on public.onboarding_sites;
create policy "deny_onboarding_sites"
  on public.onboarding_sites for all to authenticated
  using (false) with check (false);

drop policy if exists "deny_widget_tokens" on public.widget_tokens;
create policy "deny_widget_tokens"
  on public.widget_tokens for all to authenticated
  using (false) with check (false);

drop policy if exists "deny_onboarding_tasks" on public.onboarding_tasks;
create policy "deny_onboarding_tasks"
  on public.onboarding_tasks for all to authenticated
  using (false) with check (false);

drop policy if exists "deny_onboarding_reports" on public.onboarding_reports;
create policy "deny_onboarding_reports"
  on public.onboarding_reports for all to authenticated
  using (false) with check (false);

drop policy if exists "deny_billing_notifications" on public.billing_notifications;
create policy "deny_billing_notifications"
  on public.billing_notifications for all to authenticated
  using (false) with check (false);
