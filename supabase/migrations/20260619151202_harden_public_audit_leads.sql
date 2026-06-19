-- Website Audit V2.1b security + lead-quality hardening.
-- Keep the public audit isolated from website_audits and outreach while
-- preserving enough report context for lawful, useful follow-up.

begin;

alter table public.audit_leads
  add column if not exists category_scores jsonb not null default '{}'::jsonb,
  add column if not exists top_recommendations jsonb not null default '[]'::jsonb,
  add column if not exists report_context jsonb not null default '{}'::jsonb,
  add column if not exists consent boolean not null default false,
  add column if not exists consent_text text,
  add column if not exists consent_version text,
  add column if not exists consent_captured_at timestamptz;

-- The application has always normalised email before writing. Make that
-- invariant explicit before adding the deduplication key.
update public.audit_leads
set email = lower(btrim(email));

-- Keep the newest, strongest consent artifact if historical duplicates exist.
with ranked as (
  select
    id,
    row_number() over (
      partition by email, website_url
      order by
        consent desc,
        consent_captured_at desc nulls last,
        created_at desc,
        id desc
    ) as duplicate_rank
  from public.audit_leads
)
delete from public.audit_leads as lead
using ranked
where lead.id = ranked.id
  and ranked.duplicate_rank > 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'audit_leads_email_normalized'
      and conrelid = 'public.audit_leads'::regclass
  ) then
    alter table public.audit_leads
      add constraint audit_leads_email_normalized
      check (email = lower(btrim(email)));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'audit_leads_consent_artifact_complete'
      and conrelid = 'public.audit_leads'::regclass
  ) then
    alter table public.audit_leads
      add constraint audit_leads_consent_artifact_complete
      check (
        not consent
        or (
          consent_text is not null
          and consent_version is not null
          and consent_captured_at is not null
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'audit_leads_email_website_unique'
      and conrelid = 'public.audit_leads'::regclass
  ) then
    alter table public.audit_leads
      add constraint audit_leads_email_website_unique
      unique (email, website_url);
  end if;
end $$;

commit;
