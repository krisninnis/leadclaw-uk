-- 20260620101703_reconcile_production_schema_additive.sql
-- Production <-> repository schema reconciliation (ADDITIVE ONLY)
--
-- Purpose
--   Close the drift between live production Supabase and the canonical
--   repository SQL (supabase/schema.sql + supabase/migrations/*) so a fresh
--   clone is significantly closer to reproducing the real production schema
--   before any telephony / missed-call-recovery work begins.
--
-- Evidence
--   Every object below is taken directly from the authoritative production
--   snapshot in PRODUCTION-COLUMNS.csv (Generated 2026-06-20). Nothing here is
--   invented: types, defaults and nullability mirror that snapshot.
--
-- Scope guard (STRICT)
--   * Additive only. No DROP, no destructive ALTER, no data migration.
--   * IF NOT EXISTS / idempotent guards throughout so this is safe to re-run.
--   * Does NOT touch production, Lead Finder, Outreach, Billing, Stripe,
--     Website Audit, or any telephony feature.
--   * Legacy tables (classification_cache, conversations, messages, visitors,
--     subscribers) and operational backups (leads_backup_20260320,
--     outreach_events_backup_20260320) are intentionally NOT recreated here.
--   * ai_visibility_scans is intentionally NOT recreated here: it is already
--     created by 20260620_add_ai_visibility_scans.sql. (It is present in repo
--     code + migrations but absent from production; applying that existing
--     migration to production is a separate, out-of-scope operation.)

begin;

create extension if not exists pgcrypto;

-- Shared updated_at trigger function (idempotent redefinition — also defined by
-- later migrations; defining it here keeps this file standalone).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===================================================================
-- 1. Missing ACTIVE columns on existing tables
--    (present in production, absent from canonical repo SQL)
-- ===================================================================

-- applications: billing linkage added in production (cols 19-20)
alter table public.applications
  add column if not exists plan text,
  add column if not exists stripe_customer_id text;

-- clinics: ownership + subscription state added in production (cols 3-5)
alter table public.clinics
  add column if not exists owner_user_id uuid,
  add column if not exists subscription_status text not null default 'trial',
  add column if not exists plan text not null default 'trial';

-- widget_tokens: last-seen telemetry added in production (cols 6-7)
alter table public.widget_tokens
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_seen_domain text;

-- profiles: contact detail columns added in production (cols 5-9)
alter table public.profiles
  add column if not exists name text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists city text,
  add column if not exists services text;

-- enquiries: conversation link + follow-up lifecycle added in production
alter table public.enquiries
  add column if not exists conversation_id uuid,
  add column if not exists auto_reply_sent_at timestamptz,
  add column if not exists follow_up_sent_at timestamptz,
  add column if not exists follow_up_eligible boolean default true;

-- leads: the production lead-intelligence / PECR / outreach field set.
-- Types and defaults mirror PRODUCTION-COLUMNS.csv exactly. Note
-- last_contacted_at is "timestamp without time zone" in production.
alter table public.leads
  add column if not exists website_norm text,
  add column if not exists company_name_norm text,
  add column if not exists city_norm text,
  add column if not exists name_norm text,
  add column if not exists google_rating numeric,
  add column if not exists review_count integer,
  add column if not exists has_live_chat boolean,
  add column if not exists has_contact_form boolean,
  add column if not exists lead_score integer,
  add column if not exists outreach_subject text,
  add column if not exists outreach_message text,
  add column if not exists outreach_angle text,
  add column if not exists follow_up_stage integer default 0,
  add column if not exists last_contacted_at timestamp without time zone,
  add column if not exists pecr_classification text,
  add column if not exists pecr_reason text,
  add column if not exists company_number text,
  add column if not exists pecr_classified_at timestamptz,
  add column if not exists lead_quality_score integer,
  add column if not exists lead_quality_reason text;

-- agent_commands: updated_at is part of the repo trigger contract
-- (set_agent_commands_updated_at in 20260314_prod_hardening.sql). The
-- production table predates that column; add defensively so the column and
-- its trigger are always consistent on a fresh clone.
alter table public.agent_commands
  add column if not exists updated_at timestamptz not null default now();

-- ===================================================================
-- 2. Missing ACTIVE tables
--    (present + actively used in production and runtime code, absent
--     from canonical repo SQL). Shapes mirror PRODUCTION-COLUMNS.csv.
--    Used by:
--      appointments    -> src/app/api/appointments/*
--      clinic_settings -> src/app/api/clinic-settings/route.ts,
--                         src/app/api/appointments/review/run/route.ts
--      outreach_log    -> src/app/api/outreach/run/route.ts
-- ===================================================================

-- appointments ------------------------------------------------------
-- clinic_id is kept as a plain uuid (no FK) because (a) the production
-- snapshot evidences only the column, and (b) public.clinics is created in
-- schema.sql rather than a migration, so a migrations-only apply must not
-- assume it exists yet.
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

alter table public.appointments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'appointments'
      and policyname = 'appointments_service_role_all'
  ) then
    create policy appointments_service_role_all
      on public.appointments
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

create index if not exists idx_appointments_clinic_appointment_at
  on public.appointments (clinic_id, appointment_at);
create index if not exists idx_appointments_appointment_at
  on public.appointments (appointment_at);

drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

-- clinic_settings ---------------------------------------------------
-- One settings row per clinic; clinic_id is the primary key in production.
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

alter table public.clinic_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'clinic_settings'
      and policyname = 'clinic_settings_service_role_all'
  ) then
    create policy clinic_settings_service_role_all
      on public.clinic_settings
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

drop trigger if exists set_clinic_settings_updated_at on public.clinic_settings;
create trigger set_clinic_settings_updated_at
before update on public.clinic_settings
for each row execute function public.set_updated_at();

-- outreach_log ------------------------------------------------------
-- Append-only send log used by the outreach runner. No updated_at in
-- production, so no updated_at trigger here.
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

alter table public.outreach_log enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'outreach_log'
      and policyname = 'outreach_log_service_role_all'
  ) then
    create policy outreach_log_service_role_all
      on public.outreach_log
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

create index if not exists idx_outreach_log_email
  on public.outreach_log (lower(email));
create index if not exists idx_outreach_log_company_number
  on public.outreach_log (company_number);
create index if not exists idx_outreach_log_sent_at
  on public.outreach_log (sent_at desc);

commit;
