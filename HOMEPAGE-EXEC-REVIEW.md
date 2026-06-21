# Homepage Executive Review — LeadClaw

**Date:** 2026-06-19
**Scope:** Homepage positioning, clarity, trust, conversion. No changes to brand, pricing, billing, Stripe, onboarding, Lead Finder, Outreach, Audit Engine, AI Readiness. No invented proof.
**Method:** Read `src/app/page.tsx` + every rendered component (`SolutionsByClinicType`, `TrialCtaLink`, `app-footer`, `nav`) and inspected the actual product (widget API, enquiry/follow-up crons, appointments, portal) to verify what is real.

---

## Verdict: the homepage is currently *hurting* trust-led conversion

It is well-designed and honest in places (the FAQ already admits "you don't need a phone number"), but the top of the page makes a **provably false core claim** — that LeadClaw answers phone calls — and buries the real, defensible value (24/7 website enquiry capture + automatic follow-up) under repetition, a 34-link wall, and defensive "we don't fake reviews" language. A sceptical buyer who tests the call claim will bounce.

---

## 1. Strengths
- Clean, modern visual system; clear single brand colour; good hierarchy.
- Hero already has the right CTA pair (Start free trial / Book a demo) and the "7-day free trial — no card required" line.
- FAQ is genuinely useful and is wired to FAQPage schema (no drift).
- Honest *instinct* already present: outcome section avoids invented stats; FAQ admits no phone line is needed.
- Fully server-rendered, static homepage — no above-the-fold loading flash (Phase 8 largely already satisfied).

## 2. Weaknesses
- **Hero preview card states "Answers calls & enquiries 24/7" and shows a phone-style chat** — the product does not do this.
- Repetition: the "one recovered enquiry pays for it / change the maths" idea appears in **three** separate sections.
- The mid-page **"Solutions by Clinic Type" 34-link wall** is overwhelming and clinic-only in tone despite serving trades, agencies, accountants, etc.
- Defensive negations ("No invented ratings, fake testimonials"; "We do not publish invented ratings or fake testimonials") appear repeatedly and *highlight* the absence of proof.
- Abstract "worked example, not a promise" paragraph — a busy owner won't read it.
- Diffuse next step: Start trial, Book demo, See pricing, Talk to us, Get free audit all compete.

## 3. Features actually implemented (verified in code)
- **Website enquiry widget** — chat-styled intake **form** (name, email, phone, message/intent) → stored in DB + emailed (`api/widget/bootstrap.js`, `api/widget/submit`). Always-on, embeddable snippet.
- **Lead/enquiry capture into a portal workspace inbox** (`enquiries`, `/portal`).
- **Automated follow-up email** to enquiries still "new" after ~2h (cron, `api/enquiries/follow-up/run`).
- **Appointment reminders + review-request emails** (cron, `api/appointments/remind`, `.../review`).
- **Free website audit** tool (health/SEO/trust/conversion/AI-readiness scoring).
- Portal/dashboard, Stripe billing, onboarding, install snippet. (All out of scope to change.)

## 4. Features partially implemented
- **"Follow-Up Assistant"** — real but modest: a single automated email nudge, not a multi-step sequence or an "assistant."
- **"AI" intelligence** — the widget greeting is templated copy; **there is no LLM in the enquiry path** (no openai/anthropic/gpt anywhere in widget/enquiries/messages). It is an automated intake form, not a conversational AI that answers customer questions.

## 5. Features NOT implemented (must not be marketed)
- **Answering live phone calls** — no telephony anywhere (no Twilio/voice/SIP). The hero card's "Answers calls 24/7", the footer's "answer every call", and `SolutionsByClinicType`'s "answers calls and website enquiries" are **false as written**.
- **"Missed Call Recovery"** — nothing detects or recovers an actual missed phone call. Must be reframed to after-hours / when-you're-busy *website* enquiry capture.
- **"Weekly Enquiry Summary"** — no customer-facing weekly enquiry digest found in the enquiry path (the only weekly/summary code is internal Lead-Finder/Outreach tooling). Do not market until verified.

## 6. Biggest conversion blockers
1. False call claim above the fold → instant credibility loss for anyone who tests it.
2. 34-link wall mid-page pushes the real pitch and CTAs down.
3. Three repeated "maths/ROI" sections dilute the message.
4. Too many competing CTAs; no single obvious next step.

## 7. Biggest trust blockers
1. The unverifiable/false "answers calls" claim.
2. Defensive "no fake reviews / no invented ratings" language (reads as insecure; Phase 6 says remove).
3. No human / founder / "early access" signal; no testimonial scaffold for when real proof arrives.

## 8. Biggest messaging problems
1. "AI receptionist that answers calls" implies phone answering throughout.
2. Clinic-only framing ("Solutions by Clinic Type", "patient") for a multi-industry product.
3. Five-second test currently fails on "What exactly does it do?" and "Why trust it?"

---

## Implementation plan (pending one decision below)
1. **Hero rebuild** — honest headline + subheadline (24/7 *website enquiry* capture + auto follow-up), keep CTA pair + no-card line, fix the preview card so it shows the website widget → portal inbox (remove "Answers calls").
2. **Honesty pass** — remove/reframe every "answers calls / missed call recovery" claim on the homepage and in the footer; drop the unverified "Weekly Enquiry Summary"; relabel features to what's real.
3. **De-dupe structure** — collapse the three ROI/maths sections into one; tighten "how it works" + "what it does."
4. **Positioning** — replace the 34-link wall with a concise flagship section (aesthetic clinics first + a few example industries + one "View all industries" link). Create a dedicated industries index page (existing per-industry pages and URLs untouched).
5. **Trust rebuild** — remove defensive negations; add positive signals (UK-built, founder-led, early access, direct support, fast setup, no card). Add a **testimonial component with obvious placeholders** for real proof later.
6. **Conversion** — one primary path (Start free trial) + one secondary (Book a demo); demote audit/pricing to supporting links.
7. **Validate** — production build, fix, rebuild until clean; commit only if green.
