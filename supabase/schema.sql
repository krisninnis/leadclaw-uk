-- Run in Supabase SQL editor
create extension if not exists pgcrypto;

-- Shared updated_at trigger function. Defined here (the baseline) so it exists
-- before any migration that attaches an updated_at trigger. Several migrations
-- redefine it idempotently; that is safe.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  -- Nullability reflects production: only contact_name, email, agreed and
  -- status are NOT NULL. contact_name NOT NULL is enforced by the intake route.
  clinic_name text,
  contact_name text not null,
  email text not null,
  phone text,
  city text,
  website text,
  services text,
  lead_volume text,
  notes text,
  agreed boolean not null default false,
  terms_version text,
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  waiver_accepted_at timestamptz,
  agreement_ip text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  -- Billing linkage (production cols 19-20).
  plan text,
  stripe_customer_id text
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client',
  clinic_name text,
  created_at timestamptz not null default now(),
  -- Contact detail columns (production cols 5-9).
  name text,
  phone text,
  email text,
  city text,
  services text
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
  updated_at timestamptz not null default now(),
  -- Lead-intelligence / normalisation / PECR / outreach field set
  -- (production cols 14-33). last_contacted_at is timestamp WITHOUT tz in prod.
  website_norm text,
  company_name_norm text,
  city_norm text,
  name_norm text,
  google_rating numeric,
  review_count integer,
  has_live_chat boolean,
  has_contact_form boolean,
  lead_score integer,
  outreach_subject text,
  outreach_message text,
  outreach_angle text,
  follow_up_stage integer default 0,
  last_contacted_at timestamp without time zone,
  pecr_classification text,
  pecr_reason text,
  company_number text,
  pecr_classified_at timestamptz,
  lead_quality_score integer,
  lead_quality_reason text
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

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Ownership + subscription state (production cols 3-5).
  owner_user_id uuid,
  subscription_status text not null default 'trial',
  plan text not null default 'trial',
  created_at timestamptz not null default now(),
  -- NOTE: updated_at is repo-only (not present in the production snapshot);
  -- retained for the existing update trigger contract.
  updated_at timestamptz not null default now()
);

create table if not exists public.onboarding_sites (
  id uuid primary key default gen_random_uuid(),
  onboarding_client_id uuid not null references public.onboarding_clients(id) on delete cascade,
  clinic_id uuid references public.clinics(id) on delete set null,
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
  created_at timestamptz not null default now(),
  -- Last-seen telemetry (production cols 6-7).
  last_seen_at timestamptz,
  last_seen_domain text
);

create table if not exists public.enquiries (
    id uuid primary key default gen_random_uuid(),
    clinic_id uuid not null references public.clinics(id) on delete cascade,
    -- conversation_id references the legacy conversations table in production;
    -- kept here as a plain nullable uuid (no FK) to avoid depending on a legacy
    -- structure.
    conversation_id uuid,
    name text,
    email text,
    phone text,
    service text,
    preferred_time text,
    status text not null default 'new',
    notes text,
    created_at timestamptz not null default now(),
    -- Auto-reply + follow-up lifecycle (production cols 12-14).
    auto_reply_sent_at timestamptz,
    follow_up_sent_at timestamptz,
    follow_up_eligible boolean default true
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
alter table public.clinics enable row level security;
alter table public.onboarding_sites enable row level security;
alter table public.widget_tokens enable row level security;
alter table public.enquiries enable row level security;
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

drop policy if exists "deny_clinics" on public.clinics;
create policy "deny_clinics"
  on public.clinics for all to authenticated
  using (false) with check (false);

drop policy if exists "deny_onboarding_sites" on public.onboarding_sites;
create policy "deny_onboarding_sites"
  on public.onboarding_sites for all to authenticated
  using (false) with check (false);

drop policy if exists "deny_widget_tokens" on public.widget_tokens;
create policy "deny_widget_tokens"
  on public.widget_tokens for all to authenticated
  using (false) with check (false);

drop policy if exists "deny_enquiries" on public.enquiries;
create policy "deny_enquiries"
  on public.enquiries for all to authenticated
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

-- Early access signups
create table if not exists public.early_access_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  requested_plan text not null default 'growth',
  source text not null default 'pricing',
  created_at timestamptz not null default now()
);

create index if not exists early_access_signups_email_idx
  on public.early_access_signups (email);

alter table public.early_access_signups enable row level security;

drop policy if exists "service_role_only_early_access" on public.early_access_signups;
create policy "service_role_only_early_access"
  on public.early_access_signups for all to authenticated
  using (false) with check (false);

-- Migration: add notification preferences to onboarding_clients
alter table public.onboarding_clients add column if not exists notify_whatsapp text;
alter table public.onboarding_clients add column if not exists notify_sms text;
alter table public.onboarding_clients add column if not exists notify_channels text[] not null default array['email'];

-- ===================================================================
-- Production reconciliation (2026-06-20)
-- Active production tables that were missing from this baseline. Shapes mirror
-- PRODUCTION-COLUMNS.csv exactly. Also created additively by
-- supabase/migrations/20260620101703_reconcile_production_schema_additive.sql.
-- ===================================================================

-- appointments: clinic appointment book + reminder / review lifecycle.
-- Used by src/app/api/appointments/*.
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  patient_name text not null,
  patient_email text,
  patient_phone text,
  service text,
  appointment_at timestamptz not null,
  reminder_48h_sent_at timestamptz,
  reminder_2h_sent_at timestamptz,
  review_request_sent_at timestamptz,
  reminder_eligible boolean default true,
  review_eligible boolean default true,
  status text default 'scheduled',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- clinic_settings: one row per clinic (clinic_id is the primary key).
-- Used by src/app/api/clinic-settings/route.ts and the review runner.
create table if not exists public.clinic_settings (
  clinic_id uuid primary key,
  receptionist_prompt text not null default
    'You are an AI receptionist for a UK beauty clinic. Be friendly, concise, and helpful.
Your goal: collect name + contact + service + preferred time. If unsure, ask one question at a time.',
  business_hours text default 'Mon-Fri 09:00-18:00',
  services_json jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  google_review_url text,
  review_requests_enabled boolean default true,
  reminders_enabled boolean default true
);

-- outreach_log: append-only send log used by src/app/api/outreach/run/route.ts.
create table if not exists public.outreach_log (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  business_name text,
  subject text,
  sent_at timestamptz default now(),
  email_number integer default 1,
  status text default 'sent',
  classification text,
  company_number text,
  google_place_id text
);

-- ai_visibility_scans: derived AI-visibility scan per (user_id, website_url).
-- Full definition (RLS, indexes, trigger) lives in
-- supabase/migrations/20260620_add_ai_visibility_scans.sql. Repeated here so the
-- baseline reflects the target state. NOTE: present in repo code + migrations
-- but ABSENT from the current production snapshot (drift resolved by applying
-- that migration to production — out of scope for this additive pass).
create table if not exists public.ai_visibility_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  website_url text not null,
  status text not null default 'completed'
    check (status in ('queued', 'running', 'completed', 'failed')),
  error text,
  visibility_score int not null default 0 check (visibility_score between 0 and 100),
  content_score int not null default 0 check (content_score between 0 and 100),
  authority_score int not null default 0 check (authority_score between 0 and 100),
  citation_score int not null default 0 check (citation_score between 0 and 100),
  schema_score int not null default 0 check (schema_score between 0 and 100),
  recommendations jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.appointments        enable row level security;
alter table public.clinic_settings      enable row level security;
alter table public.outreach_log         enable row level security;
alter table public.ai_visibility_scans  enable row level security;

drop policy if exists "deny_appointments" on public.appointments;
create policy "deny_appointments"
  on public.appointments for all to authenticated
  using (false) with check (false);

drop policy if exists "deny_clinic_settings" on public.clinic_settings;
create policy "deny_clinic_settings"
  on public.clinic_settings for all to authenticated
  using (false) with check (false);

drop policy if exists "deny_outreach_log" on public.outreach_log;
create policy "deny_outreach_log"
  on public.outreach_log for all to authenticated
  using (false) with check (false);

-- ===================================================================
-- LEGACY structures (documentation only — DO NOT use / DO NOT extend)
-- These tables still exist in production from earlier product iterations
-- (chat-widget era). They are intentionally NOT (re)created in this baseline.
-- Recorded here so the drift is explicit:
--   * classification_cache  (superseded by inline PECR classification on leads)
--   * conversations         (legacy chat widget)
--   * messages              (legacy chat widget)
--   * visitors              (legacy chat widget)
--   * subscribers           (superseded by newsletter_subscribers)
--
-- EXCLUDED operational backups (snapshots, never part of the target schema):
--   * leads_backup_20260320
--   * outreach_events_backup_20260320
--
-- Additional ACTIVE tables are defined in supabase/migrations/* rather than in
-- this file and remain the source of truth there:
--   agent_commands, billing_notifications, website_audits, lead_finder_configs,
--   lead_finder_runs, landing_page_templates, landing_pages, landing_page_events,
--   audit_leads, outreach_templates, outreach_queue, outreach_activity.
-- ===================================================================
