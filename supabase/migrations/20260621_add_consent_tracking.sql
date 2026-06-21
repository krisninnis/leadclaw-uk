-- Additive legal-acceptance + consent tracking.
--
-- SAFETY: this migration is ADDITIVE ONLY. Every statement uses
-- "add column if not exists" with no drops and no destructive alters, so it is
-- safe to run repeatedly and cannot lose data. It has NOT been applied to
-- production by this change set (apply separately after review).
--
-- UK GDPR roles (see LEGAL-COMPLIANCE-AUDIT.md):
--   * For the customer's own account/billing data, LeadClaw is the Controller,
--     so account-level legal acceptance lives on public.profiles.
--   * Enquiry (widget) data is Controller=Customer / Processor=LeadClaw and is
--     intentionally NOT stored in these consent columns.

-- ---------------------------------------------------------------------------
-- profiles: account-holder legal acceptance + marketing consent (Parts 1, 2, 4)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists accepted_terms_at timestamptz,
  add column if not exists accepted_privacy_at timestamptz,
  add column if not exists terms_version text,
  add column if not exists privacy_version text,
  -- Marketing consent is kept SEPARATE from legal acceptance (Part 2):
  -- optional, defaults to false (unticked), and is changeable later in settings.
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists marketing_consent_updated_at timestamptz,
  -- Customer privacy acknowledgement captured on the install flow (Part 4).
  add column if not exists website_privacy_ack_at timestamptz,
  add column if not exists website_privacy_ack_version text,
  -- Optional consent provenance.
  add column if not exists consent_user_agent text,
  add column if not exists consent_ip text;

-- ---------------------------------------------------------------------------
-- applications: the signup/intake table ALREADY tracks legal acceptance
-- (terms_version, terms_accepted_at, privacy_accepted_at, agreement_ip). To
-- avoid duplicating those, we only add the separate marketing-consent flag.
-- ---------------------------------------------------------------------------
alter table public.applications
  add column if not exists marketing_consent boolean not null default false;
