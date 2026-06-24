-- 20260624_add_missed_call_recovery.sql
-- Phase 1 infrastructure for Missed Call Recovery.
--
-- Adds five additive tables for the flow:
--   missed call -> SMS text-back -> SMS reply -> enquiry created -> owner notified.
--
-- Conventions (matching existing migrations):
--   * additive only: create table / index / column IF NOT EXISTS, no drops of
--     existing objects, no data loss;
--   * RLS enabled with a service_role-only policy (webhooks + admin API use the
--     service role; tenant-scoped portal reads go through the admin client which
--     filters by clinic_id);
--   * updated_at maintained by the existing public.set_updated_at() trigger fn;
--   * enquiries / clinics tables are reused as-is (no changes here).

begin;

---------------------------------------------------------
-- phone_numbers: LeadClaw telephony numbers owned by a clinic
---------------------------------------------------------

create table if not exists public.phone_numbers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  provider text not null default 'twilio',
  provider_number_id text,
  e164_number text not null,
  label text,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'pending', 'released')),
  capabilities jsonb not null default '{"sms": true, "voice": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One active record per number (lookup key in resolveClinicByPhoneNumber).
create unique index if not exists phone_numbers_e164_key
  on public.phone_numbers (e164_number);
create index if not exists phone_numbers_clinic_id_idx
  on public.phone_numbers (clinic_id);
create index if not exists phone_numbers_provider_number_idx
  on public.phone_numbers (provider, provider_number_id);

alter table public.phone_numbers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'phone_numbers'
      and policyname = 'phone_numbers_service_role_all'
  ) then
    create policy phone_numbers_service_role_all
      on public.phone_numbers
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

drop trigger if exists set_phone_numbers_updated_at on public.phone_numbers;
create trigger set_phone_numbers_updated_at
before update on public.phone_numbers
for each row
execute function public.set_updated_at();

---------------------------------------------------------
-- missed_calls: one row per inbound (forwarded) call event
---------------------------------------------------------

create table if not exists public.missed_calls (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  phone_number_id uuid references public.phone_numbers(id) on delete set null,
  provider text,
  provider_call_id text,
  from_e164 text,
  to_e164 text,
  status text not null default 'missed'
    check (status in ('missed', 'requiring_review', 'recovered', 'ignored')),
  occurred_at timestamptz not null default now(),
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists missed_calls_clinic_id_idx
  on public.missed_calls (clinic_id);
create index if not exists missed_calls_from_e164_idx
  on public.missed_calls (from_e164);
create index if not exists missed_calls_provider_call_idx
  on public.missed_calls (provider, provider_call_id);
create index if not exists missed_calls_created_at_idx
  on public.missed_calls (created_at desc);

alter table public.missed_calls enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'missed_calls'
      and policyname = 'missed_calls_service_role_all'
  ) then
    create policy missed_calls_service_role_all
      on public.missed_calls
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

---------------------------------------------------------
-- sms_conversations: a text thread with one customer number
---------------------------------------------------------

create table if not exists public.sms_conversations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  missed_call_id uuid references public.missed_calls(id) on delete set null,
  phone_number_id uuid references public.phone_numbers(id) on delete set null,
  customer_e164 text not null,
  status text not null default 'open'
    check (status in ('open', 'awaiting_reply', 'replied', 'opted_out', 'closed')),
  last_message_at timestamptz,
  enquiry_id uuid references public.enquiries(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sms_conversations_clinic_id_idx
  on public.sms_conversations (clinic_id);
create index if not exists sms_conversations_customer_idx
  on public.sms_conversations (clinic_id, customer_e164);
create index if not exists sms_conversations_enquiry_idx
  on public.sms_conversations (enquiry_id);
create index if not exists sms_conversations_last_message_idx
  on public.sms_conversations (last_message_at desc);

alter table public.sms_conversations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sms_conversations'
      and policyname = 'sms_conversations_service_role_all'
  ) then
    create policy sms_conversations_service_role_all
      on public.sms_conversations
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

drop trigger if exists set_sms_conversations_updated_at on public.sms_conversations;
create trigger set_sms_conversations_updated_at
before update on public.sms_conversations
for each row
execute function public.set_updated_at();

---------------------------------------------------------
-- sms_messages: individual inbound/outbound SMS
---------------------------------------------------------

create table if not exists public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  conversation_id uuid not null references public.sms_conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_e164 text,
  to_e164 text,
  body text,
  provider text,
  provider_message_id text,
  delivery_status text,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sms_messages_clinic_id_idx
  on public.sms_messages (clinic_id);
create index if not exists sms_messages_conversation_idx
  on public.sms_messages (conversation_id, created_at);
create index if not exists sms_messages_provider_message_idx
  on public.sms_messages (provider_message_id);
create index if not exists sms_messages_created_at_idx
  on public.sms_messages (created_at desc);

alter table public.sms_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sms_messages'
      and policyname = 'sms_messages_service_role_all'
  ) then
    create policy sms_messages_service_role_all
      on public.sms_messages
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

---------------------------------------------------------
-- telephony_usage: per-clinic per-period usage counters
---------------------------------------------------------

create table if not exists public.telephony_usage (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  sms_outbound_count integer not null default 0,
  sms_inbound_count integer not null default 0,
  missed_call_count integer not null default 0,
  estimated_cost_pence integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One usage row per clinic per period (upsert target).
create unique index if not exists telephony_usage_clinic_period_key
  on public.telephony_usage (clinic_id, period_start);
create index if not exists telephony_usage_clinic_id_idx
  on public.telephony_usage (clinic_id);

alter table public.telephony_usage enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'telephony_usage'
      and policyname = 'telephony_usage_service_role_all'
  ) then
    create policy telephony_usage_service_role_all
      on public.telephony_usage
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

drop trigger if exists set_telephony_usage_updated_at on public.telephony_usage;
create trigger set_telephony_usage_updated_at
before update on public.telephony_usage
for each row
execute function public.set_updated_at();

commit;
