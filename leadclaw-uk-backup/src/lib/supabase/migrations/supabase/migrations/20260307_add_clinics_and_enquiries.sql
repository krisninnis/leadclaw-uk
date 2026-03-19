-- 20260307_add_clinics_and_enquiries.sql
-- Align repository schema with working lead pipeline used by:
-- /api/widget/submit
-- /portal/page.tsx

create extension if not exists pgcrypto;

---------------------------------------------------------
-- Clinics
---------------------------------------------------------

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clinics enable row level security;

drop policy if exists "deny_clinics" on public.clinics;
create policy "deny_clinics"
on public.clinics
for all
to authenticated
using (false)
with check (false);

---------------------------------------------------------
-- Add clinic_id to onboarding_sites
---------------------------------------------------------

alter table public.onboarding_sites
  add column if not exists clinic_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'onboarding_sites_clinic_id_fkey'
  ) then
    alter table public.onboarding_sites
      add constraint onboarding_sites_clinic_id_fkey
      foreign key (clinic_id)
      references public.clinics(id)
      on delete set null;
  end if;
end $$;

create index if not exists onboarding_sites_clinic_id_idx
  on public.onboarding_sites (clinic_id);

---------------------------------------------------------
-- Enquiries (captured leads from widget)
---------------------------------------------------------

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create index if not exists enquiries_clinic_id_idx
  on public.enquiries (clinic_id);

create index if not exists enquiries_clinic_id_id_desc_idx
  on public.enquiries (clinic_id, id desc);

alter table public.enquiries enable row level security;

drop policy if exists "deny_enquiries" on public.enquiries;
create policy "deny_enquiries"
on public.enquiries
for all
to authenticated
using (false)
with check (false);