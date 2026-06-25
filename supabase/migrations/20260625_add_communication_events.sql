-- 20260625_add_communication_events.sql
-- Communications Layer (Phase 1): a single, provider-agnostic event log for
-- every outbound/inbound communication (email, SMS, WhatsApp, voice, voicemail).
--
-- Conventions (matching existing migrations):
--   * additive only: create table / index IF NOT EXISTS, no drops, no data loss;
--   * RLS enabled with a service_role-only policy (webhooks + admin API use the
--     service role; tenant-scoped portal reads go through the admin client which
--     filters by clinic_id);
--   * updated_at maintained by the existing public.set_updated_at() trigger fn;
--   * clinics / leads / enquiries reused as-is (FKs are nullable + ON DELETE SET
--     NULL so the log survives row cleanup and internal alerts with no tenant).
--
-- Privacy: body_preview holds a SHORT, redacted preview only (see
-- src/lib/communications/events.ts buildBodyPreview). Full SMS/email bodies and
-- any sensitive medical detail are never written here.

begin;

create table if not exists public.communication_events (
  id uuid primary key default gen_random_uuid(),

  -- Tenancy / linkage (all nullable: internal founder alerts have no tenant).
  clinic_id uuid references public.clinics(id) on delete set null,
  workspace_id uuid,
  lead_id uuid references public.leads(id) on delete set null,
  enquiry_id uuid references public.enquiries(id) on delete set null,

  -- What happened.
  channel text not null
    check (channel in ('email', 'sms', 'whatsapp', 'voice', 'voicemail')),
  direction text not null
    check (direction in ('inbound', 'outbound')),
  provider text not null
    check (provider in (
      'resend', 'twilio', 'telnyx', 'vonage', 'plivo', 'whatsapp_cloud', 'mock'
    )),
  status text not null
    check (status in ('queued', 'sent', 'delivered', 'failed', 'received')),

  -- Delivery debugging fields (addresses stored masked by the app layer).
  from_address text,
  to_address text,
  subject text,
  body_preview text,
  provider_message_id text,
  error_message text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lookups: by tenant, by lead, by provider message id (status webhooks), recent.
create index if not exists communication_events_clinic_id_idx
  on public.communication_events (clinic_id);
create index if not exists communication_events_lead_id_idx
  on public.communication_events (lead_id);
create index if not exists communication_events_enquiry_id_idx
  on public.communication_events (enquiry_id);
create index if not exists communication_events_provider_msg_idx
  on public.communication_events (provider, provider_message_id);
create index if not exists communication_events_channel_created_idx
  on public.communication_events (channel, created_at desc);

alter table public.communication_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'communication_events'
      and policyname = 'communication_events_service_role_all'
  ) then
    create policy communication_events_service_role_all
      on public.communication_events
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

drop trigger if exists set_communication_events_updated_at on public.communication_events;
create trigger set_communication_events_updated_at
before update on public.communication_events
for each row
execute function public.set_updated_at();

commit;
