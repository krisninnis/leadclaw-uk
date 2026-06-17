-- 20260619_seed_landing_templates.sql
-- ClawLabsLocal — Landing Page Builder (Phase B)
-- Seeds the starter template catalogue into landing_page_templates and archives
-- the generic Phase A placeholders so the picker shows only real niches.
--
-- IMPORTANT: this table is the selectable *catalogue* (key, name, description,
-- schema_types). The actual content patterns and deterministic draft generation
-- live in code at src/lib/landing/templates.ts (keyed by `key`) — there is no
-- AI and no external dependency. default_content is intentionally left empty;
-- drafts are generated client-side from the code templates and remain fully
-- editable until an admin publishes them.
--
-- Scope guard: strictly additive seed data on an existing table. Touches no
-- scraper / PECR / outreach / billing / auth / Lead Finder objects.

begin;

-- Retire the generic Phase A placeholders (kept for history, hidden from the
-- picker which only lists status='active').
update public.landing_page_templates
   set status = 'archived', updated_at = now()
 where key in ('local-clinic', 'local-trade');

-- Upsert the seven starter templates. Re-runnable: on conflict we refresh the
-- catalogue metadata and re-activate the row.
insert into public.landing_page_templates (key, name, description, schema_types, status)
values
  ('aesthetic-clinic', 'Aesthetic Clinic (local)', 'Local landing page for an aesthetic clinic in a specific city.', array['LocalBusiness','Service','FAQPage'], 'active'),
  ('dentist',          'Dentist (local)',          'Local landing page for a dental practice in a specific city.',  array['LocalBusiness','Service','FAQPage'], 'active'),
  ('physiotherapist',  'Physiotherapist (local)',  'Local landing page for a physiotherapy clinic in a specific city.', array['LocalBusiness','Service','FAQPage'], 'active'),
  ('chiropractor',     'Chiropractor (local)',     'Local landing page for a chiropractic clinic in a specific city.', array['LocalBusiness','Service','FAQPage'], 'active'),
  ('electrician',      'Electrician (local)',      'Local landing page for an electrician in a specific city.',     array['LocalBusiness','Service','FAQPage'], 'active'),
  ('plumber',          'Plumber (local)',          'Local landing page for a plumber in a specific city.',          array['LocalBusiness','Service','FAQPage'], 'active'),
  ('roofer',           'Roofer (local)',           'Local landing page for a roofer in a specific city.',           array['LocalBusiness','Service','FAQPage'], 'active')
on conflict (key) do update
   set name = excluded.name,
       description = excluded.description,
       schema_types = excluded.schema_types,
       status = 'active',
       updated_at = now();

commit;
