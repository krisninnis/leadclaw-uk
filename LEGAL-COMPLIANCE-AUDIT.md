# LeadClaw — Legal & Compliance Audit

**Date:** 2026-06-21
**Scope:** UK GDPR / PECR review of LeadClaw's enquiry-capture platform, with a
focus on the Data Processing Agreement (Part 0), liability terms (Part 6), and
data retention (Part 7).
**Status of this document:** Findings and recommendations only. It does **not**
constitute legal advice and does **not** draft binding legal text. Final DPA,
terms, privacy-policy, and liability wording must be reviewed/provided by a
qualified UK solicitor or a reputable UK SaaS terms service before being relied
upon.

> Implementation that accompanies this audit (onboarding/consent capture, widget
> notice, AI disclaimer, marketing consent) is summarised in the **Appendix**.
> Billing, website audits, outreach, AI visibility, and the lead finder were
> explicitly out of scope and were not modified.

---

## Executive summary

| Area | Finding | Severity |
|---|---|---|
| Customer-facing DPA exists | Yes, at `/legal/dpa` | — |
| DPA surfaced + accepted (timestamp/version) | **No** acceptance tracking; only weakly surfaced | High |
| Sub-processors named in DPA | **No** named list (generic categories only) | High |
| Each sub-processor's own DPA executed by LeadClaw | **Not determinable from repo — must confirm** | High |
| Enquiry text sent to a third-party LLM | **No** — there is currently **no LLM anywhere** in the product | Informational (but see marketing/forward-risk note) |
| Liability / warranty terms | Present and reasonable; one explicit gap (per-enquiry capture) | Medium |
| Data retention / erasure | **No** retention policy; account deletion **orphans** enquirer data | High |
| Legal contact address | `support@leadclaw.ai` used across DPA/terms/privacy — wrong domain (`.uk`) | Low |

---

## Part 0 — Data Processing Agreement (CRITICAL)

### 0.1 Controller / Processor role map (mixed model)

UK GDPR roles here are genuinely mixed, and the documentation must reflect that:

- **Enquiry data captured via the widget** (enquirer name, phone, email, message,
  service intent, and any health-context detail a clinic's patient types in):
  the **customer is the Data Controller** and **LeadClaw is the Data Processor**.
  An **Article 28 DPA** between LeadClaw and the customer is required — this is
  the `/legal/dpa` document.
- **The customer's own account / billing data** (account holder name, email,
  business details, Stripe billing metadata): **LeadClaw is the Controller**.
  Governed by `/legal/privacy` and `/legal/terms`.
- **Cold-outreach scraped prospect data** (the lead-finder / scraper pipeline):
  **LeadClaw is the Controller** of scraped prospect data — this is where the
  existing LIA / PECR work applies. It must **not** be mislabelled as
  processor-only.

The current `/legal/dpa` correctly frames the enquiry relationship
(Processor = LeadClaw, Controller = customer) but does not acknowledge the
other two roles anywhere customer-facing. The privacy policy correctly claims
controller status for website/account data. The scraped-prospect controller
role is only handled internally (LIA/PECR) and is invisible to customers — note
it for completeness, no customer-facing change required.

### 0.2 DPA status — the five required questions

1. **Does a customer-facing DPA exist at `/legal/dpa`?** **Yes.** A static page
   (`src/app/legal/dpa/page.tsx`, "Last updated 22 February 2026") with the
   standard Article 28 clause set (roles, subject matter, processor obligations,
   sub-processors, international transfers, audit, return/deletion, liability).
2. **Is it accessible to customers?** **Yes**, technically — it is a public route
   with no auth gate. But discoverability is weak (footer-level only); it is not
   presented at any decision point.
3. **Is it surfaced during onboarding (not just buried in a footer)?**
   **Previously no.** This audit's implementation now surfaces a DPA reference
   link in the signup/onboarding consent block (see Appendix), which partially
   remediates this. The DPA is still **not separately *accepted*** (see #4).
4. **Is acceptance tracked (timestamp + version)?** **No.** There is no
   acceptance mechanism for the DPA specifically. (Terms and Privacy acceptance
   *is* now tracked by this implementation, but the DPA is a distinct artifact
   and a customer's agreement to it is not separately recorded.)
5. **Are sub-processors identified and listed?** **No.** DPA §6 only says
   "sub-processors required for service delivery (e.g., hosting, database,
   payments, communications providers)". There is **no named sub-processor list**,
   no locations, no change-notification/objection process.

### 0.3 Sub-processor review

The DPA's promises (§5–§7) are only true if LeadClaw has actually bound each
sub-processor to equivalent Article 28 terms and has a valid international
transfer mechanism in place. The following inventory was derived from
`.env.example`, `package.json`, and `vercel.json`. **"DPA executed?" cannot be
verified from the repository** — these must be confirmed against each provider's
admin console / signed agreements.

| Sub-processor | Personal data it processes | Where (residency) | Transfer mechanism needed | Provider DPA executed by LeadClaw? |
|---|---|---|---|---|
| **Supabase** (Postgres DB + Auth) | Account data + **all enquiry data** (names, phones, emails, messages, health-context), profiles, appointments | **Depends on project region — NOT in repo; MUST verify.** Recommend an EU/UK region (e.g. London `eu-west-2` / Frankfurt) | If non-UK/EEA: UK IDTA or EU SCCs + UK addendum | **Confirm** (Supabase offers a DPA + SCCs) |
| **Vercel** (hosting / serverless functions) | Request data in transit, IP addresses, logs; any payload passing through routes | **`vercel.json` pins no `regions` → functions run in Vercel's default region (`iad1`, US East) unless changed** | US transfer → UK IDTA/SCCs **and** recommend pinning functions to `lhr1` (London) | **Confirm** (Vercel offers a DPA + SCCs) |
| **Resend** (transactional email) | Enquirer **name, email, message/intent** (clinic notification + auto-reply), recipient email | US-based processing | UK IDTA / SCCs + UK addendum | **Confirm** (Resend offers a DPA) |
| **Stripe** (payments) | Account-holder billing metadata, email, customer/subscription IDs (no full card data stored by LeadClaw) | US + global | Stripe DPA + SCCs / UK addendum | **Confirm** (Stripe publishes a DPA) |
| **AI provider(s)** | **None — see 0.4** | n/a | n/a | **No AI sub-processor exists today** |

**Additional sub-processors found that are *not* in the brief's list but DO
process personal data** (should be added to the DPA's sub-processor schedule):

| Sub-processor | Data | Note |
|---|---|---|
| **Upstash Redis** (`@upstash/ratelimit`) | **IP addresses** (rate-limiting key) — IP is personal data under UK GDPR | Verify region; bind via DPA |
| **Sentry** (`@sentry/nextjs`) | Error/diagnostic payloads that can incidentally contain PII | US; bind via DPA; scrub PII |
| **PostHog** (`NEXT_PUBLIC_POSTHOG_KEY`) | Product analytics, device/usage, IP | Confirm EU vs US cloud; cookie consent |
| **Google Analytics** (`NEXT_PUBLIC_GA_MEASUREMENT_ID`) | Analytics, IP, cookies | US transfer + PECR cookie-consent obligations |

### 0.4 AI data-path check (critical)

**Tracing an enquiry end-to-end:**

1. Visitor submits the widget form → `POST /api/widget/submit`.
2. The enquiry is validated and **stored in Supabase** (`enquiries` table:
   `name`, `email`, `phone`, `service` = intent/message, `preferred_time` =
   message).
3. A notification email (to the clinic) and an auto-reply (to the enquirer) are
   sent via **Resend**. **Both emails are static templates** — they are *not*
   AI-generated.
4. For Growth/Pro plans, the enquiry is forwarded to an internal
   `/api/retention/ingest` endpoint for follow-up scheduling.

**Key finding:** **No enquiry text is sent to any third-party LLM, because there
is no LLM in the product at all.** There are no AI-provider SDKs in
`package.json` (no OpenAI/Anthropic/etc.), no AI API keys in `.env.example`, and
the only "AI" code path — the AI-visibility feature — explicitly states it makes
no external AI calls (`src/lib/visibility/providers.ts`, `src/lib/audit/checks.ts`:
"AI READINESS (signals only — no LLM ranking yet)"). The onboarding website
"analyse" step uses regex/HTML parsing, not an LLM. The "AI receptionist" widget
is, in its current implementation, a **static intake form**.

**Consequences:**

- The specific risk the brief flags — health-adjacent enquiry text reaching an
  LLM that trains on inputs — **does not currently materialise**. Good.
- However, the product is **marketed** as an "AI receptionist" / "AI-assisted".
  That is a **marketing-accuracy** concern worth a separate review, and a
  **forward-looking compliance trigger**: the moment any LLM is introduced into
  the enquiry path, **before go-live** LeadClaw must (a) add the AI provider to
  the DPA sub-processor schedule, (b) confirm its region + transfer mechanism,
  (c) confirm the provider's terms **disable training on inputs**, and
  (d) update the privacy policy and the customer privacy acknowledgement to
  disclose AI processing — especially for clinics handling health-context data.

### 0.5 Part 0 gaps & recommendations (report only — do not draft the DPA here)

1. **Add a named sub-processor schedule** to the DPA (the tables in 0.3),
   including data categories, processing location, and transfer mechanism, plus
   a sub-processor **change-notification and objection** process.
2. **Execute and file each provider's Article 28 DPA** (Supabase, Vercel,
   Resend, Stripe, Upstash, Sentry, PostHog, Google). Keep copies; the
   customer-facing DPA's promises depend on these.
3. **Confirm data residency and transfer mechanism** for each provider; in
   particular **verify the Supabase project region** and **pin Vercel functions
   to a UK/EU region**. Where US processing occurs, ensure a UK IDTA (or EU SCCs
   + UK addendum) is in place.
4. **Track DPA acceptance** (timestamp + version) the same way Terms/Privacy are
   now tracked, or explicitly incorporate the DPA by reference into the Terms
   that the customer accepts.
5. **Fix the contact domain** — `support@leadclaw.ai` appears in the DPA, Terms,
   and Privacy Policy; it should be the `leadclaw.uk` domain.
6. **Add an AI-readiness gate**: do not route enquiry text to any LLM until the
   sub-processor/transfer/training/disclosure steps in 0.4 are complete.

---

## Part 6 — Liability protection review (`/legal/terms`) — report only

Audit of `src/app/legal/terms/page.tsx` against the four required protections:

| Protection | Present? | Where / note |
|---|---|---|
| Limitation of liability | **Yes** | §11 — aggregate liability capped at fees paid in the preceding 12 months; excludes indirect/consequential loss, loss of profit, loss of data. Reasonable for B2B SaaS. |
| No guarantee of uninterrupted service | **Yes** | §10 — "we do not guarantee uninterrupted service". |
| No guarantee every enquiry is captured | **Partial** | §10 disclaims "specific lead volume"; this audit's Part 5 change added explicit AI-capture language to §10 ("automated capture … may contain errors or miss an enquiry … must not be relied on as the sole capture mechanism for anything safety-critical"). Recommend a solicitor formalise an explicit clause: *no guarantee that every enquiry will be captured, processed, or delivered.* |
| Customer responsibility for business decisions | **Yes** | §6 (customer responsibilities). Recommend adding that the customer must not rely solely on the Service for safety-critical/urgent matters. |

**Recommendations (do not write final legal text in-house):**

1. Add an explicit "no guarantee of capture/delivery of any individual enquiry"
   clause and an availability/SLA-disclaimer that pairs with §10.
2. Strengthen §6 with a "not for safety-critical / emergency use" statement,
   consistent with the AI disclaimer now shown in legal/settings/help.
3. Ensure the limitation of liability survives and cross-references the DPA's
   liability clause (DPA §10 already defers to the main terms).
4. **Have a qualified UK solicitor or a reputable UK SaaS terms service review
   and provide the final liability wording before it is relied upon.**

---

## Part 7 — Data retention review — report only

### What personal data is stored, and where

All data is stored in **Supabase Postgres** (region to be confirmed — see 0.3).
Relevant tables:

| Data category | Table(s) | Personal data fields |
|---|---|---|
| Website enquiries (widget submissions) | `enquiries` | name, email, phone, service/intent, preferred_time/message, timestamps |
| Support messages | `client_messages` | message content (user-scoped) |
| Appointments | `appointments` | patient_name, patient_email, patient_phone, service, notes |
| Retention/follow-up (Growth/Pro) | `retention_clients`, `retention_tasks`, `retention_events` | client_name, email, phone, service, objection |
| Account / billing | `profiles`, `applications`, `subscriptions`, `clinics`, `onboarding_clients`, `onboarding_sites` | account-holder name/email/phone/business; Stripe IDs |

### Current retention behaviour

- **No retention policy or TTL exists.** No scheduled purge job deletes old
  enquiries, messages, appointments, or retention records. The cron jobs in
  `vercel.json` are operational (reminders/billing/follow-up) — none performs
  data minimisation/erasure. Data is retained indefinitely by default.
- The privacy policy (§7) states data is kept "only as long as necessary" but no
  technical control enforces this.

### Deletion capability & erasure-request fulfilment

- **Per-enquiry / per-data-subject deletion: not available** in the product.
  Enquiry rows are admin/service-role only (RLS denies authenticated client
  access), so a customer cannot view or delete an individual enquirer's data
  through the app, and there is no enquirer-facing erasure route.
- **Account deletion (`/api/account/delete`) is incomplete for erasure
  purposes.** It cancels Stripe subscriptions and deletes `subscriptions`,
  `profiles`, `applications`, and the auth user — but it does **not** delete
  `enquiries`, `appointments`, `clinics`, `onboarding_clients` /
  `onboarding_sites` / `widget_tokens`, or `retention_clients` /
  `retention_tasks` / `retention_events`. `clinics.owner_user_id` has no FK
  cascade, so enquiry/appointment/retention data is **orphaned and persists**
  after the account is deleted.

**Conclusion:** A data-subject erasure request **could not be fully fulfilled
today** through product tooling; it would require manual database operations.

### Recommendations (no retention implementation in this pass)

1. Define and document retention periods per data category (e.g. enquiries,
   messages, appointments) and implement a scheduled minimisation/purge job.
2. Build an **erasure capability**: per-enquiry delete for customers, and an
   enquirer-/data-subject-driven erasure path; ensure account deletion cascades
   to all tables holding personal data (enquiries, appointments, clinics,
   onboarding_*, widget_tokens, retention_*).
3. Add a "delete my data" admin tool keyed by email/clinic to fulfil DSARs
   within statutory timeframes.
4. Reconcile actual retention behaviour with the promise in privacy policy §7.

---

## Appendix — Implementation delivered alongside this audit

Implemented per the brief (Parts 1–5), additive and non-destructive:

- **Parts 1 & 2 — Terms/Privacy acceptance + marketing consent:** mandatory
  Terms + Privacy checkboxes (continue is gated until both are ticked) on
  **signup** (`src/app/signup/page.tsx`) and at **onboarding completion**
  (`src/components/onboarding-wizard.tsx`); a **separate optional** marketing
  consent checkbox (unticked by default, never required), changeable later in
  **settings** (`src/components/account-marketing-consent.tsx`). Acceptance
  (timestamps + versions, plus user-agent/IP) is stored via the account consent
  API and an additive migration.
- **Part 3 — Widget privacy notice:** small notice beneath the widget submit
  button — "By submitting this enquiry you agree that the business may contact
  you regarding your request." (`src/app/api/widget/bootstrap.js/route.ts`). No
  change to the submission flow.
- **Part 4 — Customer privacy acknowledgement:** informational, non-blocking
  acknowledgement on the install flow
  (`src/components/install-privacy-acknowledgement.tsx`).
- **Part 5 — AI disclaimer:** placed in **legal** (`/legal/terms` §10),
  **settings**, and **help/support** via a shared `AiDisclaimer` component — not
  in the primary capture UX.
- **Schema:** `supabase/migrations/20260621_add_consent_tracking.sql` — additive
  `IF NOT EXISTS` columns on `profiles` (legal acceptance, marketing consent,
  website-privacy ack, consent provenance) and a `marketing_consent` flag on
  `applications` (reconciled with the existing terms/privacy columns there).
  **Not applied to production by this change set.**

### Validation status

- **My changed files:** scoped TypeScript typecheck **passes** with zero errors;
  every written file verified with **0 NUL bytes** and the expected closing tail;
  relevant tests pass (`widget-bootstrap-ping`, `widget-ping`,
  `portal-test-enquiry`).
- **Full production build / full-repo typecheck: cannot complete** — the working
  tree contains **pre-existing file corruption unrelated to this task**
  (e.g. `src/app/portal/billing/page.tsx` = 462 NUL bytes;
  `src/app/lp/[slug]/page.tsx` = 8 NUL bytes; `src/app/layout.tsx`,
  `src/app/api/trial/start/intake/route.ts`, and others truncated). These are
  outside this task's scope and were not modified. Because a clean production
  build cannot complete, **no commit was made** (see the main response for the
  exact files to stage once the pre-existing corruption is repaired).
