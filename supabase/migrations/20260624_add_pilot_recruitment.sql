-- 20260624_add_pilot_recruitment.sql
-- Pilot Recruitment module — additive metadata layer over existing leads.
--
-- Purpose: let the founder manage early missed-call-recovery PILOT customers by
-- annotating leads that ALREADY exist (produced by the automated scraper and the
-- /api/leads/import pipeline). This migration is a pure additive overlay:
--
--   * it creates ONE new table, lead_pilot_recruitment, keyed to public.leads by
--     lead_id (FK, unique). It does NOT alter public.leads, the scraper inserts,
--     the import route, deduplication, or scoring in any way;
--   * pilot fields live ONLY here, so scraper payloads never need pilot data and
--     lead inserts can never fail for a missing pilot field;
--   * conventions mirror existing migrations (see 20260624_add_missed_call_recovery):
--       - additive only: create ... if not exists, no drops, no data loss;
--       - RLS enabled, service_role-only policy (the admin API uses the service
--         role; there is no public access);
--       - updated_at maintained by the existing public.set_updated_at() trigger.

begin;

---------------------------------------------------------
-- lead_pilot_recruitment: pilot-tracking metadata for an existing lead
---------------------------------------------------------

create table if not exists public.lead_pilot_recruitment (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  pilot_status text not null default 'candidate'
    check (pilot_status in (
      'candidate',
      'contacted',
      'interested',
      'pilot',
      'customer',
      'not_fit',
      'no_response'
    )),
  pilot_notes text,
  follow_up_at timestamptz,
  last_contacted_at timestamptz,
  contacted_count integer not null default 0,
  interested_at timestamptz,
  pilot_started_at timestamptz,
  converted_customer_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One pilot record per lead (upsert target; keeps the overlay 1:1 with leads).
create unique index if not exists lead_pilot_recruitment_lead_id_key
  on public.lead_pilot_recruitment (lead_id);
create index if not exists lead_pilot_recruitment_status_idx
  on public.lead_pilot_recruitment (pilot_status);
create index if not exists lead_pilot_recruitment_follow_up_idx
  on public.lead_pilot_recruitment (follow_up_at)
  where follow_up_at is not null;

alter table public.lead_pilot_recruitment enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_pilot_recruitment'
      and policyname = 'lead_pilot_recruitment_service_role_all'
  ) then
    create policy lead_pilot_recruitment_service_role_all
      on public.lead_pilot_recruitment
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

drop trigger if exists set_lead_pilot_recruitment_updated_at
  on public.lead_pilot_recruitment;
create trigger set_lead_pilot_recruitment_updated_at
before update on public.lead_pilot_recruitment
for each row
execute function public.set_updated_at();

commit;
