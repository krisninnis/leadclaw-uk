# Missed Call Recovery — Technical & Commercial Strategy

**Author:** CTO (planning exercise)
**Date:** 24 June 2026
**Status:** Discovery & planning only — no code, migrations, or commits produced.
**Scope:** Architecture, feasibility, market, and implementation plan for extending LeadClaw from website-enquiry capture into missed-call / voicemail / SMS lead recovery.

---

## Executive Summary

LeadClaw already captures website enquiries through a token-authenticated widget that writes to an `enquiries` table and fires a founder/owner email alert via Resend. The marketing surface is **already selling the destination** — there are live SEO pages for `missed-call-recovery-uk` and ~35 `ai-receptionist-for-{trade}-uk` pages — but the underlying product is still a web form. This is the single most important strategic fact: **we are selling missed-call recovery and an "AI receptionist" but the product does not yet do either.** Closing that gap is the opportunity.

The recommendation is to ship **Option A — Missed Call → Automatic SMS Text-Back** first. It is the lowest-complexity, fastest-to-revenue, highest-fit path because it reuses the existing lead pipeline, notification system, portal, and billing almost wholesale. The only genuinely new surface is a telephony webhook and a small amount of conversation state. Voicemail transcription (Option B) is a fast follow-on, and the AI voice receptionist (Option C) is the premium endgame that justifies the marketing we are already running.

Recommended telephony provider: **Twilio for the MVP** (best UK documentation, reliability, and breadth), with **Telnyx evaluated as a cost-optimisation in Phase 2** once volume makes the ~40–60% lower messaging/voice rates material.

---

## PART 1 — Market Analysis

### The category

"Missed call recovery" sits at the intersection of three adjacent markets: business texting / reputation (Podium, Textline, Leadferno), virtual reception (Smith.ai), and AI voice agents (Retell, Synthflow, Bland). The wedge feature — **automatic SMS text-back on a missed call** — is now considered table stakes by the texting platforms and is cheap to deliver. The defensible value is in *what happens after the text*: lead capture, routing, notification, and conversion tracking. That is exactly where LeadClaw already has assets.

Industry benchmarks repeatedly cited by vendors: a text-back within ~60 seconds recovers roughly **30–45%** of otherwise-lost callers, and businesses combining web chat with missed-call text-back report ~20%+ uplift in total lead capture. These are vendor figures and should be treated as directional, not guaranteed — but the direction is strongly positive and matches the intuition behind LeadClaw's "tradesperson under a sink" use case.

### Competitor matrix

| Competitor | Core functionality | Pricing (2026, indicative) | Strengths | Weaknesses | Opportunity for LeadClaw |
|---|---|---|---|---|---|
| **Podium** | All-in-one: webchat, missed-call text-back, reviews, payments, AI concierge | Core ~$399/mo, Pro ~$599/mo, Enterprise $999+; annual contracts; add-ons push most single sites to $500–800/mo | Brand, breadth, AI add-ons, polished | Very expensive for UK trades/clinics; US-centric; annual lock-in; overkill for a one-van plumber | Undercut massively on price; UK-native; trade-specific onboarding |
| **Textline** | Business SMS / shared inbox, routing, automations, HIPAA focus | 3 tiers, roughly $60–120/user/mo | Strong team inbox, compliance posture | Per-seat pricing punishes small teams; inbox not lead-CRM; US focus | LeadClaw sells outcomes (leads), not seats |
| **Leadferno** | Business texting "Leadbox" widget + SMS | Single plan ~$50/user/mo, billed annually | Simple, SMB-friendly, web-to-text | Per-user; US-oriented; thin reporting; not a full pipeline | LeadClaw bundles capture + recovery + portal under one site price |
| **Smith.ai** | Human + AI virtual receptionists, call answering, intake | AI receptionist from ~$97.50/mo; human plans from ~$292–300/mo (30 calls), scaling past $1,000–1,900 at volume | Real humans, high-touch intake, US legal/SMB trust | Expensive at volume; per-call overage; US phone footprint | LeadClaw is software-margin, not labour-margin; far cheaper per recovered lead |
| **Retell AI** | Developer platform for AI voice agents | Headline ~$0.07/min; realistic all-in $0.13–0.31/min with TTS+LLM+telephony | Low latency, flexible, good quality | Build-it-yourself; not a product for a plumber; cost stacks | Use as an *engine* behind LeadClaw's Option C, not a competitor to resell against |
| **Synthflow** | No-code AI voice agent builder | Headline ~$0.08–0.09/min; real cost 2–3× with BYO keys; bundled subs | Non-technical setup | Opaque pricing; enterprise creep; still a tool not an outcome | Same — candidate engine for the AI receptionist tier |
| **Bland AI** | Programmable AI phone calls | ~$0.09/min connected; extras for cloning/concurrency | Scalable outbound, programmable | Raw platform; needs engineering; outbound-heavy positioning | Candidate engine; watch for compliance/quality |
| **GoHighLevel** | Agency CRM with missed-call text-back, Voice AI, "AI Employee" | Platform $97–497/mo; AI Employee ~$97/mo/sub-account or ~$0.02–0.05/min usage | Bundles everything; agency reseller model | Generalist, complex, agency-oriented; steep setup; not trade-vertical | LeadClaw wins on focus: one vertical, one outcome, near-zero setup |

### Where LeadClaw can realistically compete

LeadClaw should **not** try to out-feature Podium or out-build Retell. It should win on three axes that the codebase and positioning already support:

1. **Price and packaging for UK micro-businesses.** The incumbents are built for US SMBs at $400–800/mo or per-seat/per-call models. A single-van plumber or a two-chair clinic cannot justify that. LeadClaw's existing £79 Growth / £149 Pro pricing is an order of magnitude more appropriate, and missed-call recovery can be a low-priced add-on or a Pro inclusion.
2. **Vertical depth.** The ~35 trade-specific SEO pages are a real moat-in-the-making. Onboarding copy, SMS templates, and intake questions tuned per trade ("What's the issue and is it an emergency?" for plumbers; "Which treatment?" for clinics) beat any horizontal tool's generic flow.
3. **Outcome, not tooling.** Competitors sell inboxes, minutes, or seats. LeadClaw sells *recovered leads in a portal with an alert on the owner's phone*. That framing maps directly onto the existing `enquiries` → portal → notification pipeline.

The realistic target is to be **the cheapest, fastest-to-set-up, UK-trade-native missed-call recovery product**, not the most feature-complete platform.

---

## PART 2 — Implementation Options

Scoring is relative (Low / Medium / High) and pragmatic to LeadClaw's current stack (Next.js + Supabase + Stripe + Resend).

### Option A — Missed Call → Automatic SMS (text-back)

Flow: caller dials → call unanswered → telephony webhook fires "missed/no-answer" → LeadClaw sends an instant SMS ("Sorry we missed you — how can we help?") → caller replies → reply is captured as a lead and the owner is alerted.

| Dimension | Assessment |
|---|---|
| Complexity | **Low–Medium.** One inbound webhook, one outbound SMS send, conversation state, reply webhook. Reuses lead pipeline + notifications. |
| Cost | **Low.** ~£1–2/number/mo + ~£0.04/SMS. A 30-missed-call month ≈ £10–12 telephony per customer. |
| Time to market | **Fastest — 2–4 weeks** for a production MVP. |
| Customer value | **High.** Directly solves the stated use case (owner can't pick up; lead is recovered automatically). |
| Technical risk | **Low–Medium.** Main risk is UK calling-line-identity (CLI) on diverted calls + A2P/sender-ID compliance (see Part 3). |
| Commercial potential | **High relative to effort.** This is the exact feature Podium charges hundreds for. |

### Option B — Missed Call → Voicemail → Transcription → Lead

Flow: missed call → caller leaves voicemail → recording transcribed → lead created with transcript + audio.

| Dimension | Assessment |
|---|---|
| Complexity | **Medium.** Recording capture, storage (Supabase Storage), transcription (provider STT or Whisper), surfacing audio + text in portal. |
| Cost | **Low–Medium.** Recording storage + transcription (~£0.005–0.02/min equivalent). |
| Time to market | **3–5 weeks**, ideally built *on top of* Option A. |
| Customer value | **Medium–High.** Captures callers who won't engage with SMS; richer intent. But many callers hang up rather than leave voicemail. |
| Technical risk | **Low–Medium.** Transcription accuracy on UK accents/trades jargon; PII handling of recordings. |
| Commercial potential | **Medium.** Strong as a bundled enhancer to A rather than a standalone. |

### Option C — AI Voice Receptionist

Flow: caller dials → AI answers in natural voice → collects name/number/job/urgency → creates lead (and optionally books).

| Dimension | Assessment |
|---|---|
| Complexity | **High.** Real-time voice (STT→LLM→TTS), barge-in, latency budget, call-flow design, failure/handoff, per-trade scripting, integration with booking. |
| Cost | **Medium–High.** ~£0.10–0.25/min all-in via Retell/Bland/Synthflow-style engine, plus telephony. |
| Time to market | **8–14 weeks** for something safe to put in front of real callers. |
| Customer value | **Very High.** This is what the marketing already promises; answers 24/7, handles callers who'd never text. |
| Technical risk | **High.** Voice quality/latency, hallucination, mis-booking, compliance (call recording notice), brand risk if it sounds bad. |
| Commercial potential | **Very High** and premium-priced — but only credible after A/B prove the pipeline and the brand. |

### Option D — Combined System

Website widget + missed-call text-back + voicemail capture + SMS follow-up, unified in one portal.

| Dimension | Assessment |
|---|---|
| Complexity | **Medium–High** as a single release; **Low** if assembled incrementally (A → B → unified inbox). |
| Cost | Sum of components. |
| Time to market | **Long if "big bang"; fast if phased.** |
| Customer value | **Highest** — one place for every inbound lead regardless of channel. |
| Technical risk | Manageable if built as layers, not all at once. |
| Commercial potential | **Highest** — this is the full LeadClaw vision and the natural Pro/premium bundle. |

**Verdict:** Option D is the *destination*; Option A is the *door*. Build A first, layer B, then C, and D emerges as the unified result.

---

## PART 3 — Telephony Providers

All messaging/voice prices below are indicative 2026 list rates in **USD** (providers price in USD) and **must be re-verified against live UK rate cards at build time** — UK SMS in particular varies by route and carrier surcharge. Approximate GBP conversions assume ~£1 ≈ $1.27.

| Provider | UK numbers | UK SMS (outbound) | UK voice | Reliability | API / DX | Integration ease |
|---|---|---|---|---|---|---|
| **Twilio** | Excellent; local + national + toll-free, easy self-serve provisioning | ~$0.04/msg (≈3p) outbound; inbound also charged | Inbound to local number low single-cents/min; programmable voice mature | Tier-1, battle-tested, strong status/SLA | Best-in-class docs, SDKs, webhooks, Studio; huge community | **Easiest** — most examples, fastest to first call |
| **Telnyx** | Strong UK coverage; very cheap numbers (sub-$1, bulk to ~$0.25) | Base ~$0.004/segment (≈0.3p) + route/carrier fees — materially cheaper than Twilio | Competitive, often below Twilio | Owns network/IP backbone; very reliable | Good API, good docs (a notch below Twilio); messaging-profile model | Medium — slightly more setup, big cost upside |
| **Vonage** (API / Nexmo) | Good UK support | Roughly Twilio-class or a touch lower | Competitive | Reliable, enterprise heritage | Capable API but DX/docs weaker than Twilio/Telnyx | Medium |
| **Plivo** | Good UK support | Among the cheapest headline SMS | Competitive | Reliable for the price tier | Decent API; smaller ecosystem/community | Medium — fewer Next.js examples |

### UK-specific considerations (important)

- **A2P / sender identity.** UK does not use the US 10DLC regime, but application-to-person SMS still needs a sensible sender setup: an **alphanumeric sender ID** (e.g. "LeadClaw" or the business name) cannot receive replies, whereas a **long virtual number / UK mobile-capable number** can. For two-way text-back we need a **reply-capable UK number per customer (or shared with metadata routing)**. This is a provisioning and cost decision, not a blocker.
- **CLI on diverted calls (the key technical risk).** The standard text-back pattern uses **conditional call forwarding**: the customer sets their existing phone to forward *on no-answer/busy* to a LeadClaw telephony number. We then read the **original caller's number** from the inbound webhook and text them. Whether the original CLI (not the diverting number) is reliably presented depends on the customer's carrier and divert type. **This must be validated on real UK mobile and landline carriers during a spike** before committing the GTM motion. Mitigation if CLI is unreliable: capture caller number via a brief IVR/voicemail prompt, or provide a LeadClaw tracking number as the public number.
- **Number porting vs forwarding.** Forwarding (no porting) is the low-friction path for businesses attached to their existing number. Offer porting later for customers who want LeadClaw as the system of record.
- **Compliance.** Call recording (Options B/C) requires an upfront notice. SMS must include opt-out handling ("reply STOP"); LeadClaw already has unsubscribe/suppression plumbing for email that establishes the pattern.

### Recommendation

**Start on Twilio.** The MVP's dominant cost is engineering time and risk, not per-message cost. Twilio's documentation, reliability, and UK breadth get us to a working, trustworthy product fastest, and its programmable voice maturity de-risks the later Option C work. Architect the telephony layer behind a thin internal interface (`TelephonyProvider`) so that **Telnyx can be swapped in for messaging/voice in Phase 2** as a margin optimisation once volume makes the ~40–60% lower rates worth the migration. Avoid committing to Vonage/Plivo unless a specific UK rate or feature advantage emerges at scale.

---

## PART 4 — LeadClaw Integration Review

Based on the current codebase (Next.js App Router, Supabase with RLS + admin client, Stripe billing, Resend email).

### What can be reused (most of it)

- **Lead pipeline.** `enquiries` table (`clinic_id, name, email, phone, created_at`) and the `/api/widget/submit` flow are the template. A recovered call is just another way to create an enquiry/lead — the portal `leads` screen already renders them.
- **Identity / tenancy.** `clinics`, `onboarding_sites`, `onboarding_clients`, and the **widget token model** already map a public credential to a tenant. The same pattern maps a **phone number** to a clinic.
- **Notifications.** `src/lib/email.ts` (`sendEmail`, `sendFounderAlertEmail`) and the Resend webhook give us owner alerts immediately; SMS alerts reuse the same telephony layer we're adding.
- **Scheduled jobs.** Existing `…/run` cron routes (`enquiries/follow-up/run`, `appointments/remind/run`, `retention/run`, `outreach/run`) establish the pattern for **follow-up SMS sequences** and **stale-conversation sweeps**.
- **Billing.** Stripe checkout/portal/webhook + the `basic/growth/pro` plan model and `subscription-access` gating let us gate the feature and meter usage with minimal new work.
- **Portal shell + Command Centre.** `/portal/*` and `/admin` Command Centre give us the surfaces to display calls, conversations, and operational health (recovery rate, SMS spend).
- **Compliance plumbing.** Email suppression/unsubscribe establishes the opt-out pattern to mirror for SMS STOP handling.

### New tables required (additive — consistent with the repo's additive-migration convention)

1. **`phone_numbers`** — provisioned/forwarded numbers per tenant: `id, clinic_id, e164_number, provider, provider_sid, type (forwarding|tracking|ported), capabilities (sms,voice), forwarding_mode, status, created_at`.
2. **`calls`** — every inbound/missed call event: `id, clinic_id, phone_number_id, from_e164, to_e164, direction, status (missed|answered|voicemail), provider_call_sid, started_at, ended_at, recording_url (nullable), duration_seconds`.
3. **`call_recoveries` / conversations** — the recovery state machine linking a missed call to an SMS thread and a resulting lead: `id, clinic_id, call_id (nullable), lead_id (nullable), channel (sms), state (initiated|sent|replied|converted|expired|opted_out), last_message_at`.
4. **`messages`** — SMS log (a `messages` API route stub already exists): `id, clinic_id, conversation_id, direction (in|out), from_e164, to_e164, body, provider_message_sid, status, segment_count, cost_micros, created_at`.
5. **`voicemails`** (Option B) — `id, clinic_id, call_id, recording_url, transcript, transcription_status, created_at`.
6. **`usage_counters`** (or extend an existing metering table) — per-tenant per-period counts of SMS sent, inbound messages, call minutes, voicemail minutes — for plan inclusions, overage billing, and margin monitoring.

A foreign key from `calls`/`conversations` to the existing `enquiries` (or a generalised `leads`) keeps recovered calls inside the one lead list rather than a separate silo. Follow the repo's **additive, RLS-enabled, deny-by-default** migration pattern; do not author these now (planning only).

### New API routes required

- `POST /api/webhooks/twilio/voice` — inbound/missed-call webhook (TwiML or status callback). Detects no-answer/busy, records the call, triggers text-back.
- `POST /api/webhooks/twilio/sms` — inbound SMS (caller replies, STOP handling) → updates conversation, creates/updates lead, fires owner alert.
- `POST /api/webhooks/twilio/status` — delivery/recording-status callbacks.
- `POST /api/calls/recover` (internal) — orchestrates the text-back send + conversation creation.
- `POST /api/numbers/provision` & `POST /api/numbers/forwarding-test` — provisioning + a self-serve "send us a test missed call" verification (mirrors the existing `/api/portal/test-enquiry` verification idea).
- `POST /api/sms/send` — internal send wrapper through the `TelephonyProvider` interface.
- `GET /api/calls` & `GET /api/conversations` — portal data.
- `POST /api/voicemails/transcribe/run` (Option B) and `…/follow-up/run` (cron) for sequences — following the existing `…/run` cron convention.

All webhooks need provider **signature validation** (Twilio request validation) and tenant resolution by the `to` number.

### New portal screens required

- **Calls / Conversations** screen (or a "Calls" tab inside the existing Leads view) — list of missed calls, recovery status, SMS thread, and a reply box.
- **Phone setup** screen under `/portal/install` (reuse the install/verify pattern) — provision/choose a number, show **the exact conditional-call-forwarding code** for the customer's carrier, and a **"test it"** verification step that confirms forwarding + CLI work end-to-end.
- **SMS templates & settings** under `/portal/settings` — per-trade default text-back copy, business hours, auto-reply on/off, STOP/opt-out view.
- **Usage** view (portal + Command Centre) — SMS/minutes used vs included, recovery rate, spend; ties into billing/overage.
- **Command Centre** additions — fleet-wide recovery rate, SMS spend vs revenue (margin guard), numbers needing attention.

---

## PART 5 — Customer Experience (full flow)

**Setup (once, self-serve, ~10 minutes):**

1. Owner signs up / is on a qualifying plan → opens **Phone setup** in the portal.
2. Chooses: *Keep my number* (forwarding — recommended) or *Use a LeadClaw number* (tracking/porting later).
3. Portal shows the exact **conditional-call-forwarding dial code** for their carrier and a one-tap copy. Owner sets "forward when unanswered/busy" to the LeadClaw number.
4. Owner picks their **trade template** (pre-filled SMS copy + intake questions) and business hours; confirms SMS opt-out language.
5. Owner taps **"Send a test missed call"** → LeadClaw confirms forwarding works *and that the caller's CLI is captured* → green check.

**Live (every missed call):**

1. Customer rings the business. Owner is under a sink / with a patient / driving → doesn't answer.
2. Call forwards (on no-answer) to the LeadClaw number; the voice webhook fires "missed".
3. Within seconds LeadClaw sends an **automatic SMS** from the business's number: *"Hi, this is [Business] — sorry we missed your call. How can we help? Reply here and we'll get straight back to you."*
4. Caller replies with the job/issue. The reply is captured as a **lead** in the portal (same `enquiries`/leads list as web leads) and a **conversation** thread is created.
5. Owner gets an **instant alert** (email now; SMS/push later) — "New recovered call lead from 07…: 'leaking tap, kitchen, Tooting'."
6. Owner replies from the portal (or the thread auto-follows up if no human reply within X minutes — reusing the cron follow-up pattern).
7. Optional later: voicemail transcript attached (Option B); AI receptionist handled the whole conversation (Option C).
8. Lead shows in **Command Centre** metrics: recovery rate, time-to-first-reply, conversion.

Net experience: the owner does nothing during the job, and finishes to find a captured, qualified lead and an alert — exactly the promise on the existing landing pages.

---

## PART 6 — Commercial Model

### Unit economics (MVP, Option A, indicative)

- Number rental: ~£1–2 / number / month.
- SMS: ~£0.04 / message (Twilio UK list; lower on Telnyx).
- A recovered-lead conversation ≈ 4–6 messages ≈ £0.16–£0.30.
- A customer with ~30 missed calls/month ≈ **£10–12/month** telephony cost all-in.
- Inbound forwarded-call voice time is seconds → effectively negligible.

This means missed-call recovery can be sold for **£20–35/month and still hold a strong gross margin** at typical small-business volumes, with overage protection on heavy users.

### Suggested packaging

| Tier | Missed-call recovery | Included SMS | Included voicemail | Included AI call minutes | Rationale |
|---|---|---|---|---|---|
| **Basic (£0)** | Not included | — | — | — | Keep free tier as web-widget acquisition only |
| **Growth (£79)** | **Add-on (+£20–25/mo)** *or* light inclusion (e.g. 150 SMS) | ~150 SMS | — | — | Let price-sensitive trades buy recovery deliberately |
| **Pro (£149)** | **Included** | ~500 SMS | Included (Option B) | — | Make Pro the "never miss a lead" tier — the upgrade driver |
| **Premium / Receptionist (future, £249+)** | Included | High | Included | Metered AI minutes bundle (e.g. 200 min, then per-min overage) | Houses Option C; premium margin |

Overage: bill SMS/minutes above inclusions at a transparent per-unit rate (with a healthy markup over telephony cost) via the existing Stripe metering. Surface usage in the portal to avoid bill-shock.

### Add-on vs included — recommendation

**Both, by tier.** Offer missed-call recovery as a **paid add-on on Growth** (captures willingness-to-pay and keeps the entry plan lean) and **include it on Pro** (so it becomes the reason to upgrade). Rationale:

- An add-on on Growth creates a clean, low-friction upsell and protects margin on light buyers.
- Including it on Pro turns a thin-margin telephony feature into a **plan-upgrade lever**, which is worth more than the add-on revenue.
- It mirrors how the market actually buys: incumbents bundle at high prices; LeadClaw can bundle at a fraction and still win on value.

Avoid putting any telephony cost into the **free Basic** tier — usage-based cost with zero revenue is a margin trap and an abuse vector.

---

## PART 7 — Recommended MVP

### 1. Recommended MVP

**Option A — Missed Call → Automatic SMS Text-Back**, delivered on **Twilio**, packaged as a **Growth add-on / Pro inclusion**, with self-serve **conditional-call-forwarding** setup (no number porting required) and recovered conversations surfaced inside the existing leads pipeline and owner alerts.

### 2. Why

- **Fastest route to revenue:** reuses the lead pipeline, notifications, portal shell, and Stripe billing; the only net-new surface is a telephony webhook + light conversation state.
- **Lowest engineering complexity:** no real-time voice, no STT/LLM/TTS latency budget, no AI safety surface. One inbound webhook, one outbound SMS, one reply webhook, one state machine.
- **Highest customer value per unit of effort:** it *is* the headline feature competitors charge hundreds for and the exact scenario in our own marketing.
- **Best architectural fit:** a recovered call is "just another enquiry," so it slots into `enquiries`/leads, the portal, and Command Centre with additive migrations only.
- **Closes the credibility gap:** we already rank/sell for "missed call recovery UK" — this makes the promise real.

### 3. Estimated build effort

**~3–4 weeks for one engineer to a production MVP** (single trade vertical first, then template the rest):

- Week 0 (spike, 2–3 days): validate UK conditional-call-forwarding + CLI capture on real carriers; provision a Twilio UK number; prove inbound-webhook → outbound-SMS → inbound-reply round trip.
- Week 1: telephony provider interface, webhooks (voice/sms/status) with signature validation, `phone_numbers`/`calls`/`conversations`/`messages` schema (additive), text-back send + state machine.
- Week 2: portal — phone setup + verification ("test missed call"), conversations view, SMS templates/settings, STOP/opt-out handling; owner alert reusing `sendFounderAlertEmail`.
- Week 3: billing inclusions + usage metering + overage; Command Centre metrics; QA, abuse/rate-limit, soft launch to a handful of design-partner customers.

### 4. Estimated operating costs

- Per active customer: **~£10–12/month** telephony at ~30 missed calls/month (number rental + SMS), lower on Telnyx.
- Platform: marginal — runs on existing Vercel/Supabase/Resend footprint; add Twilio account + a Supabase Storage bucket only when Option B (voicemail) lands.
- Cost scales with usage, so meter from day one and guard margin in Command Centre.

### 5. Estimated monthly revenue opportunity

Illustrative, at a **£25/mo** effective price (add-on or attributed Pro uplift), ~£12 cost → ~£13 gross margin/customer:

| Paying customers | MRR | Approx. gross margin |
|---|---|---|
| 50 | £1,250 | ~£650 |
| 200 | £5,000 | ~£2,600 |
| 500 | £12,500 | ~£6,500 |
| 1,000 | £25,000 | ~£13,000 |

The bigger prize is **upgrade pull-through to Pro** and the platform's eventual move to the Premium AI-receptionist tier, where price points (£249+) and willingness-to-pay are materially higher.

---

## PART 8 — Implementation Roadmap

Evolving LeadClaw from *Website Enquiries* → *Website Enquiries + Missed Calls + Voicemail Recovery + AI Receptionist*.

### Phase 1 — Missed Call Text-Back (Weeks 0–4) — *Revenue now*

- Telephony spike + Twilio UK provisioning; validate forwarding + CLI.
- `TelephonyProvider` interface; voice/sms/status webhooks with signature validation.
- Additive schema: `phone_numbers`, `calls`, `conversations`, `messages`, `usage_counters`.
- Automatic text-back + reply capture into the existing leads pipeline; owner email alert.
- Portal: phone setup + "test missed call" verification, conversations view, SMS templates/STOP.
- Billing: Growth add-on + Pro inclusion + overage metering; Command Centre recovery/spend metrics.
- Launch to design partners in one vertical (e.g. plumbers), then template SMS/intake to the other trades that already have SEO pages.

**Exit criteria:** a customer can self-serve setup in <10 min, missed calls reliably text back, leads appear in the portal, and the feature is billable with margin visibility.

### Phase 2 — Voicemail Recovery + Cost & Inbox polish (Weeks 5–10)

- Option B: voicemail capture → Supabase Storage → transcription → lead with transcript + audio; recording-notice compliance.
- Unified **conversation inbox** (web + SMS + voicemail in one thread per lead) — begins delivering the Option D experience.
- Follow-up SMS sequences via the existing cron `…/run` pattern (e.g. nudge if no reply in 30 min).
- **Evaluate/begin Telnyx migration** for messaging/voice to cut per-unit cost as volume grows (provider interface makes this low-risk).
- SMS/push owner alerts (beyond email).

**Exit criteria:** every inbound channel lands in one lead inbox; voicemail leads are captured and transcribed; per-lead cost is trending down.

### Phase 3 — AI Voice Receptionist + Combined System (Weeks 11–24+) — *Premium tier*

- Option C: integrate a voice engine (Retell / Bland / Synthflow-class) behind LeadClaw, with per-trade scripts, urgency triage, safe handoff/fallback to text-back, and call recording notice.
- Optional booking/appointment creation (the app already has `appointments` routes to build on).
- Launch **Premium / Receptionist tier (£249+)** with metered AI minutes + overage.
- Full **Option D** unified product: website widget + missed-call recovery + voicemail + SMS follow-up + AI answering, all in one portal and Command Centre — finally matching every promise on the existing landing pages.

**Exit criteria:** AI answers live calls safely at quality, books/qualifies, and the premium tier sustains a higher price point with controlled margins.

---

## Open Risks & Decisions to Resolve Before Build

1. **UK CLI on diverted calls** — must be validated on real carriers in the Phase 1 spike; it gates the whole forwarding-based GTM. Have the IVR/tracking-number fallback ready.
2. **Reply-capable number strategy** — per-customer number vs shared number with routing; affects cost and provisioning UX.
3. **SMS sender identity / compliance** — alphanumeric vs long-number, STOP handling, consent posture for UK.
4. **Margin control** — meter usage from day one; never expose telephony usage on the free tier.
5. **Provider lock-in** — keep the telephony layer behind an interface so Twilio→Telnyx is a config change, not a rewrite.
6. **Brand risk on Option C** — a bad-sounding AI receptionist damages trust; gate it behind real quality bars and human/text fallback.

---

*Prepared as a discovery and planning document only. No code, schema, migrations, or commits were created. All external pricing is indicative as of mid-2026 and must be re-verified against live UK rate cards before commercial commitment.*
