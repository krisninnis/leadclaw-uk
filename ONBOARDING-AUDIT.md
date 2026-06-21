# LeadClaw — Onboarding & Widget Install Audit + Roadmap

> Investigation + planning pass. **Nothing implemented.** Audit and recommendations first,
> then a prioritised roadmap and the top 3 trial→paid conversion levers.
> Goal restated: a new customer should sign up → configure → install → capture a real
> enquiry in **under 5 minutes**, and LeadClaw should sell *more leads / fewer missed
> enquiries / faster responses / more bookings* — not "AI".

Scope reviewed in code: `/free-trial` (+ `_components`), `/signup`, `/api/trial/*`,
`/api/auth/callback`, `/api/onboarding/*`, `lib/provision-clinic.ts`, `lib/onboarding.ts`,
`/portal`, `/portal/install`, `/portal/settings`, `/api/widget/bootstrap.js`,
`/api/widget/ping`, `/api/widget/submit`, `lib/audit/run-audit.ts`,
`ONBOARDING_ARCHITECTURE.md`.

---

## 1. Current-state onboarding audit

### What actually happens today

**Two parallel signup routes, near-duplicated:**

- `/free-trial?plan=growth|pro` → `SignupForm` (8 fields) → `NotificationStep` (WhatsApp/SMS)
  → redirect to `/portal?startTrial=1&trial=started&setup=ready&plan=…`.
- `/signup?plan=basic` → leaner form (name, email, password×2) → on password signup it shows
  "check your email" and **redirects to `/login` after 2 s**; OAuth/magic-link go straight through.

**Where provisioning really fires.** The trial *start* + workspace provisioning does **not**
run on the page redirect. It runs inside **`/api/auth/callback`** when the magic-link / OAuth /
email-confirmation link comes back carrying `startTrial=1` or `startBasic=1` in `next`.
`startTrialForUser()` writes the `subscriptions` row (status `trialing`, 7-day `trial_end`,
`cancel_at_period_end`) and calls `provisionClinicWorkspace()`. That function:

1. reads the latest `applications` row for the email,
2. upserts `profiles`, creates `onboarding_clients`, `clinics`, `onboarding_sites`,
3. mints a `widget_tokens` token,
4. seeds `onboarding_tasks` from `AUTONOMOUS_TASK_ORDER`.

**The widget.** `/api/widget/bootstrap.js` returns a self-contained script that renders a
fixed launcher + panel: name / email / phone / message and four hard-coded intent chips
("New request", "Pricing question", "Document help", "General question"). Submissions POST to
`/api/widget/submit` (emails the clinic via Resend, writes an `enquiries` row, gated on an
active subscription).

**The portal after signup.** `/portal` is a dashboard (subscription, widget status, leads this
week, recent activity, quick actions). `/portal/install` shows the snippet + a 4-step "paste
before `</body>`" list and a passive "refresh to confirm detected" status.
`/portal/settings` is titled "Workspace settings" but contains only a Google review URL and
two automation toggles.

### The blunt summary

There is **no onboarding wizard and no in-product configuration of the product the customer
is buying.** The workspace is auto-provisioned from whatever sparse data the signup form
captured, the widget is the same generic form for a dentist and a roofer, and "is it live?"
can't be confirmed reliably from the portal. The pieces that would make 5-minute time-to-value
possible (a website-audit fetch/parse pipeline, a welcome-email builder, a platform enum, an
autonomous task list) **exist in the codebase but are not wired into the new-customer path.**

---

## 2. Friction report (ranked)

| # | Severity | Friction | Evidence in code | Impact |
|---|----------|----------|------------------|--------|
| F1 | **Critical** | Widget is a **static form, not an AI receptionist**. Identical fields + 4 fixed intent chips for every business; no awareness of industry, services, tone, FAQs, or goal. | `bootstrap.js` `renderFormBody()` / `renderHeader()` are hard-coded; no clinic config is read except domain string. | Buyers told they're getting an "AI receptionist" get a contact form → expectation gap, weak demos, churn. Undercuts the entire value prop. |
| F2 | **Critical** | **No onboarding wizard / no business setup.** Nowhere to set industry, primary goal, fields to collect, tone, business name, hours, FAQs, prompt, or welcome message. | `/portal/settings` only has review URL + 2 toggles; provisioning pulls from `applications` only. | Customer can't make the product *theirs*; value is generic; nothing to "configure" in the 5-minute promise. |
| F3 | **Critical** | **"Widget live" detection is effectively broken.** Portal + install page key off `widget_tokens.last_seen_at`, which is only set by `/api/widget/ping` — and **nothing calls ping** (`bootstrap.js` never pings). | No `widget/ping` reference anywhere in `src`; bootstrap only fetches `/api/widget/submit` on a real submit. | User installs correctly, portal still says "Needs install / Not detected yet" → they think they failed, re-paste, or churn at the verification moment. |
| F4 | **High** | **Email confirmation blocks the <5-min path** for password signups. Trial only provisions when the confirmation link hits `/api/auth/callback`. | `SignupForm.signUpWithPassword` → `supabase.auth.signUp` → confirm email → callback. | Only Google OAuth is truly instant. Everyone else leaves the app to check email; classic drop-off. |
| F5 | **High** | **Website URL — the highest-value input — is optional and buried** in an 8-field form. OAuth users provide no website at all, so the workspace domain falls back to `test.leadclaw.uk`. | `SignupForm` website field `(optional)`; `provision-clinic.ts` `domain = … || "test.leadclaw.uk"`. | Kills any chance of "magic setup" and shows a fake domain in the dashboard → looks broken. |
| F6 | **High** | **Settings page is mislabeled and near-empty.** "Workspace settings" implies business config; delivers a review link + 2 toggles. | `/portal/settings/page.tsx`. | Users hunt for where to configure the assistant and find nothing. |
| F7 | **Medium** | **Generic, non-platform install instructions** despite a documented platform matrix. Provisioning always sets `platform: "custom"`. | `install/page.tsx` 4-step list; `provision-clinic.ts` hard-codes `platform: "custom"`; `ONBOARDING_ARCHITECTURE.md` describes WP/GTM/Shopify. | WordPress/Wix/Shopify users get no tailored path → install failures, support load. |
| F8 | **Medium** | **No "send a test enquiry" inside the portal.** Verifying requires leaving the app, visiting the live site, and submitting the public form. | No test action in `install/page.tsx`; success only via real `submit`. | No fast, in-product "it works" moment. |
| F9 | **Medium** | **Two divergent signup flows** with duplicated auth logic and different endings (basic → `/login` after 2 s; trial → notifications step). | `/signup` vs `/free-trial/_components`. | Inconsistent UX, double maintenance, more bugs. |
| F10 | **Medium** | **Notification step interrupts before value.** WhatsApp/SMS collection sits between signup and the portal, before the user has seen anything work. | `free-trial/page.tsx` step machine. | Extra step before the "aha"; better placed after first lead. |
| F11 | **Low** | **Unfinished-looking copy/glyphs**: literal `OK` used as success/check badges. | `bootstrap.js` `lcw-success-badge` = `OK`; `notification-step` `<span>OK</span>`. | Looks like placeholder text; erodes "premium" positioning. |
| F12 | **Low** | **Welcome email exists but isn't part of a guided flow** and promises "10-minute launch". | `lib/onboarding.ts` `buildWelcomeEmail`. | Inconsistent with a true 5-minute target; orphaned asset. |
| F13 | **Low** | **Magic-setup engine already exists, unused for onboarding.** `runAudit()` already fetches + parses a site (SSRF-guarded). | `lib/audit/run-audit.ts`, `parse-html.ts`. | Biggest opportunity is sitting one wire away. |

---

## 3. Competitor analysis

| Tool | Does well | Frustrates users | LeadClaw should **copy** | LeadClaw should **avoid** |
|------|-----------|------------------|--------------------------|---------------------------|
| **Tidio** | Live in **5–10 min, no card**; **auto-detects** store language/branding/common questions; guided customise of greeting, hours, response timing. Won "ease of use" badges 2025/26. | Pricing tiers/feature gating; AI limits on low plans. | Auto-detection from the site; one short guided customise; instant "you're live". | Hiding core setup behind upsells. |
| **Crisp** | Install widget, then a clean guided "add teammates / set automations" path. | Thin analytics, less polished for advanced needs. | The "install first, then guide" ordering. | Stopping at install with no value framing. |
| **Intercom** | **Checklists** that frame onboarding as *value tasks*; product tours; Fin ingests your content for instant answers. | Heavy, complex, expensive; overkill for SMBs; long time-to-value if you enable everything. | The value-framed checklist pattern; content ingestion for FAQs. | Enterprise sprawl, config overload, jargon. |
| **Drift** (Salesloft) | Strong playbook/routing for sales teams. | Rep-heavy, complex setup, steep learning curve, pricey. | Goal-based routing concept (book vs. quote vs. FAQ). | Sales-rep-centric complexity for SMB owners. |
| **LiveChat** | Mature **platform install** (WordPress plugin, Shopify app, GTM) with clear per-platform docs. | Agent-seat model; setup is feature-rich but not "magic". | Per-platform install instructions + verification. | Seat-based, agent-first framing. |
| **Zendesk Chat** | Deep platform integrations; pulls store/customer context. | Admin-heavy, migration churn (Chat→Web Widget), enterprise complexity. | Platform plugins/apps as install options. | Multi-product admin maze. |
| **ChatBot / Lyro / Chatbase / Oscar Chat** | **Paste a URL → crawl site → build knowledge base/FAQ in minutes.** This is now the *baseline expectation* for AI setup. | Generic answers if the crawl is thin; hallucination risk. | **URL-to-config "magic setup" as the default first action.** | Over-promising AI depth LeadClaw can't yet deliver. |

**Net read:** the market standard for "AI" tools is now *paste your URL and we configure
ourselves*, plus *live in under 10 minutes with no card*. LeadClaw already beats most on the
no-card trial, but loses on (a) self-configuration from the URL, and (b) the widget actually
behaving like the thing it's sold as.

---

## 4. Recommended onboarding flow

### 4.0 Principle
One signup route. **Website URL is the first and primary input.** Wizard steps are **pre-filled
by magic setup** and the user just *confirms* — never types from scratch when avoidable. Every
step states the outcome ("so we book appointments straight into your inbox"), not the mechanism.

### 4.1 The wizard (6 steps, all pre-fillable)

**Step 0 — URL + auth (combined).** "Enter your website to set up LeadClaw." One field +
Continue-with-Google. Kick off magic setup (§4.2) immediately and provision in the background.

**Step 1 — Industry** (dropdown; pre-selected by detection):
Dentist · Aesthetic Clinic · Cosmetic Clinic · Physiotherapist · Chiropractor · Osteopath ·
Private GP · Vet · Accountant · Solicitor · Recruitment Agency · Estate Agent · Plumber ·
Electrician · Roofer · Builder · Cleaner · Marketing Agency · IT Support · Other.

> **How industry auto-configures the AI.** Industry selects a **template pack**: (a) default
> *primary goal* (clinics → book appointments; trades → request quotes; agencies → generate
> leads); (b) default *fields to collect* (dentist → name/phone/preferred date/service; roofer
> → name/phone/postcode/job type/photos); (c) a **receptionist system prompt** seeded with
> sector vocabulary, compliance tone (e.g. medical = no diagnosis, reassurance + booking), and
> typical objections; (d) a **starter FAQ set** ("Do you take NHS?", "Do you offer free
> quotes?", "Where do you cover?"); (e) launcher copy ("Book a dental appointment" vs "Get a
> roofing quote"). Detection just pre-picks the pack; the user can override in one click.

**Step 2 — Website platform** (dropdown; pre-selected by detection):
WordPress · Wix · Squarespace · Shopify · Webflow · Framer · GoHighLevel · HubSpot · React ·
Next.js · Custom Website · Not Sure.

> **How install adapts.** Platform routes Step 5 to the exact install method: WordPress →
> WPCode/header-footer plugin steps (or the optional LeadClaw plugin); Shopify → `theme.liquid`
> before `</body>`; Wix/Squarespace/Webflow/Framer → their custom-code/embed panels; GTM via
> GoHighLevel/HubSpot → container snippet; React/Next.js → component/`app/layout` snippet;
> Custom/Not Sure → generic `</body>` snippet + "email my developer" button. Persist the choice
> on `onboarding_sites.platform` (stop hard-coding `"custom"`).

**Step 3 — Primary goal** (single select; pre-set by industry):
Book appointments · Generate leads · Request quotes · Answer FAQs · Customer support.
Goal sets the widget's default CTA, the success message, and which automations switch on.

**Step 4 — Information to collect** (checkboxes; pre-ticked by industry):
Name · Phone · Email · Preferred date · Service · Budget · Message. Drives the live widget
fields directly (replacing the hard-coded set in `bootstrap.js`).

**Step 5 — Business details** (pre-filled by detection; user confirms):
Business name · Phone · Email · Website · Opening hours. Prefer detected values; show a subtle
"detected from your website" tag so confirmation feels effortless.

**Step 6 — Tone** (single select; default by industry): Professional · Friendly · Premium ·
Conversational. Tone is appended to the system prompt and tunes greeting/wording.

**End:** show the **live widget preview** already configured, then the platform-specific install
(§5). Move WhatsApp/SMS capture to *after* the first captured lead, not before value.

### 4.2 "Magic setup" (URL → self-configuring)

Reuse the existing audit fetcher/parser (`run-audit.ts` → `fetch-site.ts` SSRF-guarded fetch +
`parse-html.ts`). New `POST /api/onboarding/magic` does:

1. **Detect business name** — `og:site_name` / `<title>` / schema.org `Organization`.
2. **Detect contact details** — `tel:` / `mailto:` links, footer, `ContactPoint` schema.
3. **Detect services** — nav items, H1/H2s, `/services` page, service schema.
4. **Detect industry** — keyword/LLM classification of homepage text against the 20-item list.
5. **Detect opening hours** — `OpeningHours` schema / footer patterns.
6. **Generate receptionist prompt** — industry pack + detected services/name/tone.
7. **Generate FAQs** — from page content + industry starter set.
8. **Generate welcome message** — "Hi, welcome to {business}. I can help you {goal}…".

Output pre-fills every wizard step. Target: **URL entered → configured draft in <15 s**, user
confirms in a few clicks. Keep a graceful fallback (thin sites → industry defaults only).

---

## 5. Recommended widget setup flow

Goal: **the user knows with certainty the widget is live.**

1. **Platform-specific instructions** (from Step 2) with screenshots, not a generic `</body>`
   line. WordPress and Shopify get first-class, copy-along guides; others get tailored panels.
2. **Copy-paste snippet** with a real Copy button (already present) plus **"Email install
   instructions to my web person"** and **"Done-for-you install"** options for non-technical owners.
3. **Active success verification — fix F3 first.** Make `bootstrap.js` fire `/api/widget/ping`
   on load (token + domain) so detection works *without* a submitted lead. Then the install page
   can **live-poll** and flip to a green "✅ Widget is live on yourdomain.com" the moment the
   script loads — no manual refresh.
4. **Installation checklist** (live ticks): snippet added · site published · widget detected ·
   test enquiry received · notifications confirmed.
5. **Test conversation flow** — a **"Send a test enquiry"** button in the portal that submits a
   sample lead and lands it in the inbox, so the owner sees the whole loop in-product in seconds.

---

## 6. Missing features

**Customer expectations LeadClaw isn't meeting yet:** URL-to-config auto-setup; an assistant
that actually answers (FAQs) rather than only collecting; live "it's working" confirmation;
per-platform install; a configurable widget (fields, tone, branding, greeting).

**Setup features competitors have that LeadClaw lacks:** website/content ingestion (Tidio,
Intercom Fin, ChatBot, Lyro); value-framed onboarding checklists (Intercom); platform plugins
/apps (Zendesk, LiveChat, Tidio); in-product test/preview; auto-detected branding & hours (Tidio).

**Setup features LeadClaw could offer that competitors don't (wedge):** a true UK-vertical
**industry pack** library (dentist vs roofer vs solicitor) that configures prompt + fields +
FAQs + compliance tone in one click; an **AI website audit at signup** (the visibility/audit
engine already exists) that doubles as both a lead magnet and the config source; **outcome-named
setup** ("turn missed calls into booked appointments") rather than feature setup.

---

## 7. Prioritised roadmap

### Quick wins (<1 day each)
- **QW1 — Make the widget ping (fixes F3).** Add a `fetch('/api/widget/ping', {token, domain})`
  on `bootstrap.js` load so "live" detection works. Highest trust-per-hour fix in the doc.
- **QW2 — Promote website URL to the first/required field** on `/free-trial`; capture it for
  OAuth too; stop defaulting domain to `test.leadclaw.uk` (use the entered URL).
- **QW3 — Rename + redirect:** retitle `/portal/settings` honestly, and add a visible "Set up
  your assistant" entry point on `/portal` (today there's only "install").
- **QW4 — Replace placeholder glyphs** (`OK` → real check icon) in widget + notification step.
- **QW5 — Add "Send a test enquiry" button** on `/portal/install` to create the in-product aha.
- **QW6 — Move the WhatsApp/SMS step to after the first lead** (or make it a one-line optional
  field on the dashboard), removing a pre-value interruption.

### Medium improvements (<1 week each)
- **MW1 — Build the magic-setup endpoint** (`/api/onboarding/magic`) on top of `run-audit`'s
  fetch/parse to extract name, contacts, services, industry, hours.
- **MW2 — Ship the 6-step wizard** pre-filled by MW1, writing real config to the workspace
  (industry, goal, fields, tone, business details). One route; deprecate the duplicate flow (F9).
- **MW3 — Make the widget config-driven:** `bootstrap.js` reads fields, greeting, CTA, tone, and
  launcher copy from the site/clinic record instead of hard-coding them (starts fixing F1).
- **MW4 — Platform-specific install module** keyed off `onboarding_sites.platform` (WordPress,
  Shopify, Wix, Squarespace, Webflow/Framer, GTM, React/Next, custom) + live checklist.
- **MW5 — Reduce the email-confirmation wall (F4):** prefer magic-link/OAuth in the UI, or defer
  confirmation so the workspace provisions and the user reaches value before verifying email.

### Strategic improvements (<1 month)
- **SW1 — Industry pack library** for all 20 verticals: prompt + default fields + starter FAQs +
  compliance tone + launcher copy, versioned and editable.
- **SW2 — Real AI answering in the widget** (FAQ/knowledge from MW1 + packs) so "AI receptionist"
  is literally true — closes F1 and the core expectation gap.
- **SW3 — Onboarding checklist + progress on the dashboard** (Intercom-style, value-framed):
  "Configure → Install → First lead → Notifications", with a measurable completion rate.
- **SW4 — Done-for-you install path** (temporary scoped access / send-to-developer) for
  non-technical owners, per `ONBOARDING_ARCHITECTURE.md`'s assisted model.
- **SW5 — Instrument the funnel** end-to-end (URL entered → configured → installed → first lead →
  paid) so the conversion levers below are measured, not guessed.

---

## Top 3 changes most likely to improve trial→paid conversion

1. **Make the widget actually configure itself and answer (magic setup + config-driven, FAQ-
   capable widget — MW1 + MW3, toward SW2).** Trials convert when the owner sees *their* business
   reflected and the assistant doing real work in minutes. This is the single biggest gap vs.
   every "paste-your-URL" competitor and directly fixes the F1 expectation gap that quietly kills
   paid conversion.

2. **Guarantee the "it's live" + first-lead moment (QW1 ping fix + QW5 test enquiry + live
   checklist).** People pay for proof. Today a correctly-installed widget can still read "not
   detected", and the only way to see a lead is to leave and submit on the live site. A reliable
   green "live" state plus an in-portal test lead manufactures the aha that precedes a card.

3. **Put the website URL first and kill the pre-value friction (QW2 + QW6 + MW5).** Lead with the
   one input that powers everything, drop the fake `test.leadclaw.uk` domain, defer
   WhatsApp/SMS and the email-confirmation wall until after value. Shorter path to the first
   captured enquiry → more trials reach the point where paying makes sense.

---

### Sources
- [Intercom — Checklists / value-based onboarding](https://www.intercom.com/blog/intercom-checklists-onboard-engage-customers/), [retain users with value-based onboarding](https://www.intercom.com/blog/retain-users-with-value-based-onboarding/)
- [Tidio — Crisp review & setup](https://www.tidio.com/blog/crisp-review/), [Tidio vs Crisp 2025](https://www.ringly.io/comparison/tidio-vs-crisp-chat), [Tidio review (Tooltester)](https://www.tooltester.com/en/live-chat/tidio-review/)
- [ChatBot.com — connect a URL to build a knowledge base](https://www.chatbot.com/), [Oscar Chat — crawl your website](https://www.oscarchat.ai/blog/knowledge-base-ai-chatbot-2026/)
- [Zendesk Chat — install on Shopify](https://support.zendesk.com/hc/en-us/articles/4408843485978-How-do-I-manually-install-the-Zendesk-Chat-widget-in-my-Shopify-store), [install on WordPress](https://support.zendesk.com/hc/en-us/articles/4408883132186-Installing-Zendesk-Chat-for-WordPress)
