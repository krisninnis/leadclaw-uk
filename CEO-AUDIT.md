# LeadClaw — Full Company Executive Audit

**Prepared by:** Acting CEO / COO / CTO / Head of Product / Sales / Marketing / Ops / Compliance / CS / Finance
**Date:** 18 June 2026
**Method:** Repository traced end-to-end. Build, typecheck, lint and tests executed. Every conclusion below is backed by a file/line reference or a command result. Where something could not be verified from the repo (e.g. live Vercel env, production data), it is explicitly marked **UNVERIFIED**.

---

## Executive summary (read this if nothing else)

LeadClaw is **two products in one repo, at very different maturity levels**:

1. **An internal B2B lead-generation & cold-outreach machine** (Lead Finder scraper → enrichment → PECR classification → lead scoring → outreach drafting → send/queue). This is genuinely well-built, well-tested, and close to operational. **This is your real asset today.**
2. **A customer-facing SaaS "AI Receptionist"** sold via 34 programmatic landing pages. The plumbing around it (signup, no-card trial, automated workspace provisioning, embeddable widget, billing, portal) is real and mostly works — **but the headline feature is not what the marketing says.** The "AI Receptionist" widget contains **no AI**. It is a styled contact form with intent chips that stores an enquiry and sends a templated auto-reply (`src/app/api/widget/bootstrap.js/route.ts`, `src/app/api/widget/submit/route.ts`). A full-codebase search for any LLM SDK (OpenAI/Anthropic/Claude/GPT/Gemini/etc.) returns **zero** real integrations.

**The single most dangerous fact:** you are marketing an "AI Receptionist" that is a form. That is both a conversion problem (customers will churn when they realise) and an advertising-accuracy/compliance problem.

**The second most dangerous fact:** the working tree does not build. `npx tsc --noEmit` fails on `src/app/api/leads/import/route.ts` — the file is **truncated mid-statement at line 234** (`.from("le`). The committed HEAD version is intact (232 lines), so **main is probably fine**, but the corruption sits hidden inside ~171 files of CRLF/LF line-ending churn (no `.gitattributes`), so a careless `git add -A && commit` will ship a build-breaker to production.

**Can a customer pay you today?** Not in the current configuration. `NEXT_PUBLIC_EARLY_ACCESS_MODE=true` (confirmed in `.env`) replaces the Stripe checkout button in the portal with a "Join early access" waitlist (`src/components/portal-plan-upgrade.tsx:107`). The Stripe code itself is complete and correct.

**Maturity (detail in Dept 9):** Sales engine 7/10, the rest 4–6/10. This is a strong **pre-revenue MVP with an unusually mature internal sales tool bolted on**, not yet a sellable, truthfully-described SaaS.

---

## Department 1: Product

Feature-by-feature, with evidence. Status key: **Complete** (works end-to-end) / **Partial** (works but gaps) / **Broken** / **Missing**.

| Feature | Status | Evidence & notes |
|---|---|---|
| Public website / marketing pages | **Complete** | ~80 routes render; home, how-it-works, pricing, compare, demo, contact, 34 niche pages, SEO pages, legal. `src/app/**/page.tsx`. |
| Signup (Supabase auth + Google) | **Complete** | `src/app/signup`, `src/app/login`, `src/app/api/auth/callback`, `free-trial-google.test.js` passing. |
| No-card trial flow | **Complete** | `src/app/api/trial/start/route.ts` creates a 7-day `trialing` subscription and provisions a workspace. Gated by `trial-subscription-gate.ts` (tested). |
| Workspace auto-provisioning | **Complete** | `src/lib/provision-clinic.ts` idempotently creates onboarding_client → clinic → site → widget token → onboarding tasks. Solid. |
| Widget delivery (embed script) | **Complete** | `src/app/api/widget/bootstrap.js/route.ts` serves a self-contained, subscription-gated, CORS-safe JS widget with a demo mode. Genuinely polished UI. |
| Widget lead capture | **Complete** | `src/app/api/widget/submit/route.ts`: zod-validated, rate-limited (Upstash), subscription-gated, stores `enquiries`, emails clinic + auto-reply. |
| **"AI Receptionist" (the actual AI)** | **Missing / Misrepresented** | The widget is a **static form** (intent chips + name/email/phone/message). No conversation, no LLM, no knowledge base. `grep` for any AI SDK across `src` + scraper = **none**. The product name is not the product. |
| Portal (dashboard, leads, activity, billing, settings, profile, install, support, visibility, audit) | **Partial → Complete** | All routes exist and render real data. `portal/resources` is a 10-line stub. |
| Onboarding experience | **Partial** | Backend tasks are auto-created (`onboarding_tasks`, `AUTONOMOUS_TASK_ORDER`). There is no guided in-product onboarding wizard for the user; tasks are largely backend/founder-side. |
| Appointment flows | **Partial / UNVERIFIED** | `appointments` table + `/api/appointments`, remind/run, review/run routes + Vercel crons exist. No evidence the widget actually books appointments — it captures enquiries, not calendar slots. |
| Lead capture (customer-side) | **Complete** | Enquiries flow from widget → `enquiries` → portal + email. |
| Landing page builder (admin) | **Complete** | `/admin/landing-pages` CRUD, publish/unpublish, templates, public render at `/lp/[slug]`. Heavily tested (`landing-*.test.ts`). One of the most finished features. |
| Sales workspace (admin) | **Complete** | `/admin/sales`, `/admin/outreach`, `/admin/lead-finder` with tests. Internal tool, not customer-facing. |
| Lead Finder | **Complete (internal)** | Covered in Dept 3. Works, CI-tested. |
| AI Visibility scan | **Partial** | `src/lib/visibility/*` + `portal/visibility`. Scores a site's "AI visibility" using heuristics/provider config — not a live LLM query. Real feature, but "AI" here is also heuristic. |
| Website Audit | **Complete** | `src/lib/audit/*` fetches a site, parses HTML, scores it. Real, self-contained. |

**Product verdict:** the scaffolding is real and surprisingly complete. The core promised value — an AI that talks to website visitors — does not exist.

---

## Department 2: Engineering

**Stack:** Next.js 16.1.6 (App Router), React 19, TypeScript, Supabase (Postgres + Auth), Stripe, Resend, Upstash (rate-limit), PostHog + GA, Sentry, Zod. Python 3.12 scraper. Vercel hosting.

**Build health (executed, not assumed):**
- `npx tsc --noEmit` → **FAILS.** Real error: `src/app/api/leads/import/route.ts(235,16): error TS1002: Unterminated string literal` — the working-tree file is truncated at line 234 (`.from("le`). Also two generated `.next/types/*` errors. **The committed HEAD version of the file is intact (232 lines).** `next.config.ts` does **not** set `ignoreBuildErrors`, so `next build` will fail on this file if committed.
- `npx jest` → **PASSES** (sampled suites all green; 35 test files: outreach, leads, PECR, landing, billing-plans, trial-gate, email, visibility, enrichment). Good coverage on the sales engine, **none** on Stripe webhook, provisioning, widget, or auth.
- `npx eslint` → did not complete within the 40s sandbox limit (slow), so lint is **UNVERIFIED**; config is standard `next/core-web-vitals` + `next/typescript`.
- Python scraper: `python -m unittest` → **23 tests pass**, stdlib-only (no external deps). CI-verified.

**Architecture observations:**
- Clean separation: `src/lib/*` (logic, unit-tested) vs `src/app/api/*` (thin routes). Token-gated automation endpoints. Security headers + HSTS in `next.config.ts`. This is above-average discipline for an MVP.
- **No generated Supabase types.** Every DB call is cast `as unknown as SupabaseUntypedClient`. You have given up compile-time safety on your entire data layer — the largest source of latent runtime bugs and the reason the truncated-file class of error is so dangerous.
- **Duplicate / overlapping systems** (see also Dept 3): two outreach pipelines and four outreach tables (`outreach_events` + `outreach_log` for the automated sender; `outreach_queue` + `outreach_activity` for the manual queue). Data model overlap between `clinics`, `onboarding_clients`, and `clinic_settings`.
- **Committed junk / dead code** (all tracked in git, confirmed via `git ls-files`): `src/app/api/agent/command/route.tses` (typo extension), `"idebar nav, mascots, pricing refactor…"` (a commit message saved as a filename), `supabase/schema.sql.bak_20260314` (backup committed), `src/components/Dashboard.js` (legacy). 
- **No `.gitattributes`** → ~171 files show as "modified" from pure CRLF/LF churn (`git diff src/lib/stripe.ts` shows identical content, 13/13 line changes). This makes `git status` useless and hides real changes (like the truncated file).
- 83 TODO/FIXME/placeholder markers across `src`.

**Ranked engineering list:**

*Critical bugs:*
1. Truncated `leads/import/route.ts` (build-breaker if committed).
2. No `.gitattributes` → line-ending churn masking real diffs; high risk of shipping corruption.
3. Untyped Supabase layer → no compile-time protection on any query.

*Quick wins (hours each):*
1. Restore `leads/import/route.ts` from HEAD; add `.gitattributes` with `* text=auto eol=lf`.
2. `git rm` the three junk files + `Dashboard.js`.
3. Generate Supabase types (`supabase gen types`) and replace the `SupabaseUntypedClient` casts incrementally.
4. Add a CI step that runs `tsc --noEmit` on every PR (CI currently runs jest + scraper, see `.github/workflows/ci.yml`).

*Scalability risks:*
1. Serverless cold child-process spawn for the scraper in dev (`lead-finder.ts` uses `spawn`); prod correctly offloads to GitHub Actions — good, but the local path is a foot-gun.
2. Outreach run is bounded to 45s inside one serverless invocation with a daily cap of 5 — fine for now, will not scale to volume without a real queue/worker.
3. Single-region Supabase, no read replicas, no obvious connection pooling strategy — irrelevant at current scale, revisit at >100 clinics.

---

## Department 3: Sales

**This is the strongest part of the company.** Trace:

1. **Lead Finder** (`src/lib/lead-finder.ts` + `leadclaw-lead-scraper/places_batch.py`): in production dispatches a GitHub Actions workflow (`lead-scraper.yml`) that runs a Google Places scraper, optionally discovers public website emails, and posts results back via `/api/admin/lead-finder/callback`. Scraper is **CI-tested (23 tests) and stdlib-only**. ✅
2. **Lead database** (`leads` table, 26 code references): stores company, website, email, phone, ratings, etc. ✅
3. **PECR classification** (`src/lib/lead-enrichment.ts` → `classifyPecrConservatively`): confidence-weighted scoring of corporate vs sole-trader signals; defaults to `manual_review` on ambiguity. Conservative and **unit-tested** (`pecr-classification.test.ts`). ✅
4. **Lead quality scoring** (`scoreLeadQualityConservatively`): 0–100 with bands Poor/Medium/Good/Hot. ✅
5. **Outreach generation** (`src/lib/outreach-templates.ts`, `outreach-drafts.ts`, and inline rendering in `outreach/run`): templated, variant copy, compliance footer with company number/address/privacy/unsubscribe. ✅
6. **Outreach eligibility gate** (`src/lib/outreach-eligibility.ts`): only `likely_corporate` + valid non-free email + not unsubscribed/suppressed/already-contacted passes. ✅
7. **Two outreach delivery systems (duplication):**
   - **Automated sender** — `src/app/api/outreach/run/route.ts` + `outreach.yml`. Sends real emails via Resend, 3-stage follow-ups, daily cap (default 5), suppression checks, logs to `outreach_events`/`outreach_log`. The workflow is **`workflow_dispatch` only — not scheduled** (safe default).
   - **Manual queue** — `outreach-queue.ts` + `/admin/outreach/queue`. Human reviews drafts and marks `called`/`skipped`/`do_not_contact`. Statuses are `draft/skipped/called/do_not_contact` — note "called", not "sent".
8. **CRM** (`/admin/sales`, `lead-command-center.tsx`, `lead-ops/board`): a real internal lead board. ✅

**Can sales… today?**
- **Generate leads?** ✅ Yes — if `GOOGLE_PLACES_API_KEY` (SET locally) + GitHub dispatch token are configured. Scraper works.
- **Qualify leads?** ✅ Yes — enrichment + PECR + quality scoring are automated and tested.
- **Contact leads?** ⚠️ **Partially.** Drafting is automated; sending requires either a manual GitHub Actions dispatch or a human marking the queue. The automated sender has explicit handling for Resend's *"you can only send testing emails to your own address"* error (`outreach/run` line ~995) → **strong signal the Resend sending domain may not be verified yet.** Resend keys are absent from local `.env` (prod UNVERIFIED).

**Still manual:** triggering outreach runs, verifying the Resend domain, reviewing the manual queue, and any reply handling (no inbound reply parsing exists).

---

## Department 4: Marketing

**Live:**
- **Programmatic SEO at scale:** 34 `ai-receptionist-for-{niche}-uk` pages, plus `seo/[slug]`, comparison pages (`ai-receptionist-vs-answering-service`, `-vs-virtual-receptionist`), cost/stat pages, and data-driven article pages. Data sources: `ai-receptionist-pages.ts` (71 entries), `seo-article-pages.ts` (44), `seo-pages.ts` (23).
- `sitemap.ts`, `robots.ts`, `public/robots.txt`, structured metadata (`seo-metadata.ts`). ✅
- Conversion paths: every page funnels to `/free-trial` / `/demo`. Analytics wired (GA + PostHog).
- A 28KB `docs/SEO-ROADMAP-2026.md` strategy exists.

**Missing / weak:**
- **No blog / content engine.** No `/blog` route. The roadmap describes content that isn't built.
- **Thin programmatic pages** (the plumber page template is ~20 lines pulling shared data) risk being treated by Google as low-value "doorway" pages — strong on quantity, light on unique content.
- Internal linking exists via `solutions-by-clinic-type.tsx` but is template-driven.

**Fastest traffic wins:** (1) make 5–10 niche pages genuinely deep (real FAQs, local proof, unique copy) rather than 34 thin ones; (2) ship the comparison pages hard (high commercial intent, already built); (3) stand up a minimal blog to capture the roadmap's keywords. **But fix the product-truth problem first — driving traffic to "AI Receptionist" copy that a form can't deliver amplifies churn.**

---

## Department 5: Operations & Automation

Every background process, with the four-question test: **Live? Scheduled? Verified? Monitored?**

| Automation | Live? | Scheduled? | Verified? | Monitored? | Notes |
|---|---|---|---|---|---|
| Lead Scraper (`lead-scraper.yml`) | Yes | **Yes — daily 08:00 UTC** + manual | CI validates scraper each run (compileall + unittest) | Callback logs to `lead_finder_runs`; failures fail the workflow | Scheduled run **no-ops unless a schedule is enabled in DB** (`schedule_enabled`, default false) and defaults to `--dry-run`. So it likely runs daily and does nothing. **Verify intent.** |
| Outreach Runner (`outreach.yml`) | Yes | **No — `workflow_dispatch` only** | Heavily unit-tested logic | `outreach_events`/`outreach_log` + `logSystemEvent` | Sends real cold email. Currently manual-trigger only (safe). |
| Retention run (`vercel.json`) | UNVERIFIED | Yes — 09:00 daily | `retention.ts` exists | `system_events` | Token `RETENTION_RUN_TOKEN` SET. Whether Vercel cron passes the token correctly is **UNVERIFIED**. |
| Billing trial run | UNVERIFIED | Yes — 09:15 daily | `trial-automation.ts` | `system_events` | Drives trial→billing transitions. Verify prod. |
| Enquiry follow-up | UNVERIFIED | Yes — 09:30 daily | route exists | `system_events` | |
| Appointment reminders | UNVERIFIED | Yes — 09:45 daily | route exists | `system_events` | Depends on appointment data actually existing. |
| Appointment reviews | UNVERIFIED | Yes — 10:00 daily | route exists | `system_events` | |

**Flag: every Vercel cron above is "configured but unverified."** They are wired in `vercel.json` and the routes exist, but there is no evidence in-repo that they have ever successfully fired in production, nor that Vercel's cron requests authenticate against the `*_RUN_TOKEN` bearer tokens the routes expect. **This is the #1 operations gap to verify.**

**Monitoring:** Sentry (`@sentry/nextjs` configured), `logSystemEvent` → `system_events`, founder-alert emails (default to `krisninnis@gmail.com`). `ALERT_WEBHOOK_URL` is **not set** locally, so webhook alerting is likely off. There is no uptime dashboard beyond `/api/health` + `/api/ops/uptime`.

---

## Department 6: Compliance

**What exists (genuinely good for the stage):**
- Full legal surface: `legal/privacy` (94 lines), `legal/dpa` (83), `legal/terms` (102), `legal/trial-waiver` (58), `legal/compliance-checklist` (53).
- **PECR-aware outreach:** only `likely_corporate` leads are eligible (`outreach-eligibility.ts:129`). Conservative classifier defaults to `manual_review`. Compliance footer on every email (company no. 13546017, registered address, privacy link, data-rights email, unsubscribe). Suppression list (`email_suppressions`) + `/api/unsubscribe` + Resend webhook handling.
- GDPR: `/api/account/delete`, `/api/account/profile` (data deletion/access).

**Legal risks that remain:**
1. **Cold-emailing scraped contacts on a heuristic B2B classification.** UK PECR permits B2B marketing email to corporate subscribers (Ltd/LLP/PLC), **not** to sole traders/partnerships treated as individuals. Your gate is a *heuristic* — any misclassification that emails a sole trader is a breach. The conservatism helps; it is not a legal guarantee. Keep volumes low and keep the manual-review default.
2. **Advertising accuracy / consumer protection.** Marketing a form as an "AI Receptionist" across 34 pages risks falling foul of the CMA/ASA rules on misleading advertising, independent of any tech debt. **This is a compliance issue, not just a product one.**
3. **Scraped personal data (emails) = personal data under GDPR** even in a B2B context if it identifies an individual (e.g. `john@…`). You need a documented lawful basis (legitimate interest assessment) and the privacy notice must cover scraping. **UNVERIFIED** whether an LIA exists.
4. Data Processor obligations: as the widget processes your customers' end-users' data, your DPA must be solid and signed at checkout. The DPA page exists; confirm it's contractually accepted in the signup flow.

**What should never be enabled yet:**
- **Do not schedule the automated outreach sender** (`outreach.yml`) until: (a) Resend domain verified, (b) PECR classification spot-audited against real Companies House data, (c) volume caps and an LIA are signed off. Keep it manual-dispatch.
- **Do not turn off `manual_review`-by-default** in the classifier.

---

## Department 7: Customer Success

- **Support:** `portal/support` (136 lines) + `portal-chat.tsx` (216 lines) → posts to `/api/messages` storing `client_messages`. This is an **async support inbox**, not live or AI chat. Founder answers manually.
- **Help centre:** `/help` (270 lines) — a real, substantial help/FAQ page. ✅
- **Resources:** `portal/resources` is a **10-line stub.** Public `/resources` (132 lines) is real.
- **Onboarding:** backend tasks auto-created on provision; **no guided in-app onboarding** for the user. The "install the widget" step (`portal/install`, `install-snippet-card.tsx`) is the main self-serve moment and is well done.
- **Retention:** `retention.ts` + `/api/retention/*` + daily cron schedule follow-ups when a clinic doesn't respond to an enquiry. Real logic, **prod-UNVERIFIED**.

**Customer friction points:** (1) the gap between "AI Receptionist" expectation and the form reality — the biggest retention risk; (2) no guided onboarding wizard; (3) support is async-only (no SLA, no live chat); (4) resources stub looks unfinished to a paying user.

---

## Department 8: Finance & Commercial

- **Pricing:** Basic £0 / Growth £79/mo / Pro £149/mo (`src/lib/plans.ts`). Clear and simple.
- **Billing:** `stripe/checkout` (subscription mode, dedupes existing subs) → `stripe/webhook` (handles `checkout.session.completed`, `subscription.updated/deleted`, `invoice.payment_failed`; on success **provisions the workspace and syncs the application plan**) → `stripe/portal` (self-serve management). **This code is complete and correct.** ✅
- **Trials:** no-card 7-day trial (`trial/start`) with a gate to prevent abuse (`trial-subscription-gate.ts`, tested).

**Can a customer sign up and pay today? Can they self-serve?**
- ⛔ **Not in the current configuration.** `NEXT_PUBLIC_EARLY_ACCESS_MODE=true` swaps the checkout button for a "Join early access" waitlist (`portal-plan-upgrade.tsx:107`; pricing page also gated, `pricing/page.tsx:19`). Customers can sign up and **trial**, but cannot **pay**.
- Additionally, **Stripe and Resend keys are absent from local `.env`** (`STRIPE_SECRET_KEY`, `STRIPE_PRICE_GROWTH/PRO`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, and even `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Production/Vercel env is **UNVERIFIED** — this must be confirmed before claiming the money path works.

**What breaks the revenue path (in order):** (1) early-access flag is on; (2) Stripe env unverified in prod; (3) Resend domain likely unverified → trial/transactional emails may not send; (4) the product under-delivers vs the promise, so even a completed payment leads to churn.

---

## Department 9: Executive Dashboard

### Current maturity score (/10, evidence-based)

| Area | Score | One-line justification |
|---|---:|---|
| Product | **5** | Excellent scaffolding; the headline "AI" feature is a form. |
| Engineering | **6** | Disciplined patterns + real tests, undercut by untyped DB layer, build-breaking corruption, CRLF chaos, committed junk. |
| Sales | **7** | Mature, tested lead-gen → enrichment → PECR → scoring → outreach. Best part of the company. |
| Marketing | **6** | Large programmatic SEO surface + analytics; thin content, no blog. |
| Operations | **5** | Many automations wired; most are configured-but-unverified in prod; thin monitoring. |
| Compliance | **6** | Strong legal pages + PECR gate; real risk in scraped cold email + "AI" advertising claims. |
| Customer Success | **4** | Async support + good install flow; no onboarding wizard, stub resources, expectation gap. |
| Finance | **5** | Correct, complete billing code, switched off behind early-access; prod env unverified. |
| **Overall** | **5.5** | A pre-revenue MVP with a disproportionately strong internal sales tool. |

### Top 10 revenue priorities (ranked by revenue × customer impact × speed)

1. **Decide the product truth and align it.** Either (a) build a real AI reply layer into the widget, or (b) rebrand to what it is ("instant enquiry capture & auto-reply"). Everything else is built on this. *(High impact / medium speed)*
2. **Verify the production money path** — Stripe keys, webhook endpoint, price IDs live; do one real test purchase. *(High / fast)*
3. **Flip `EARLY_ACCESS_MODE` off** once #2 is verified, so customers can actually pay. *(High / trivial)*
4. **Verify the Resend sending domain** (DNS/SPF/DKIM). Without it, trial emails, auto-replies, and outreach silently fail. *(High / fast)*
5. **Ship a real onboarding moment** that gets the widget installed and produces one captured lead in the first session. Activation = retention. *(High / medium)*
6. **Make the manual outreach queue your daily revenue engine** — it's built and compliant. Drive 5–10 reviewed sends/day to book demos. *(High / fast)*
7. **Deepen 5–10 niche/comparison pages** into genuinely useful content. *(Medium / medium)*
8. **Fix the resources stub + add a basic help centre index.** Cheap credibility. *(Medium / fast)*
9. **Add reply/inbound handling** so outreach replies don't fall on the floor. *(Medium / medium)*
10. **Instrument activation funnel in PostHog** (signup → install → first lead → pay) so you can see where the 10 customers leak. *(Medium / fast)*

### Top 10 technical risks (most dangerous first)

1. **Truncated `leads/import/route.ts`** sitting in a dirty tree → one bad commit ships a non-building app. (HEAD is clean.)
2. **No `.gitattributes`; 171-file CRLF churn** hiding real changes and inviting #1.
3. **Untyped Supabase layer** (`as unknown as` everywhere) → no compile-time safety on any query.
4. **Production crons unverified** — retention/billing/appointment automations may be silently dead.
5. **Resend domain likely unverified** → silent email failures across product and outreach.
6. **Two outreach systems + 4 overlapping tables** → drift, double-sends, reporting confusion.
7. **Stripe/Resend/anon-key env unverified in prod** → revenue + auth + email may be misconfigured.
8. **No tests on the money path** (webhook, provisioning, widget, auth) — your most critical flows are untested.
9. **Committed junk files** (`route.tses`, commit-message filename, `.bak` schema) → confusion, accidental imports.
10. **Scraper/outreach legal exposure** if classification or domain verification is wrong at volume.

### Top 10 "looks finished but probably isn't" (investigated)

1. **"AI Receptionist"** — investigated: it is a static form, no AI. **Confirmed not what it claims.**
2. **`/api/leads/import`** — looks like a route; working copy is **truncated and won't compile.**
3. **Vercel cron automations** — wired in `vercel.json`, but **no proof they fire/auth in prod.**
4. **Automated outreach sender** — fully built, but **never scheduled** and **Resend likely unverified** → may have sent ~0 real emails.
5. **Self-serve billing** — complete code, **gated off** by early-access flag.
6. **Appointment booking** — tables + crons exist; widget **captures enquiries, doesn't book slots.**
7. **AI Visibility scan** — real feature, but the "AI" is heuristic, not a live model query.
8. **Portal chat** — looks like chat; it's an **async message form** to the founder.
9. **Portal resources** — **10-line stub.**
10. **Onboarding** — backend tasks created, but **no user-facing guided onboarding.**

### Final CEO assessment — first 10 paying customers in 30 days

**Brutally honest:** you do not have a believable "AI Receptionist" to sell in 30 days, and you cannot currently take payment. But you *do* have (a) a working lead-capture widget + portal, and (b) a compliant, mostly-built outreach engine to reach prospects. Win by selling **what actually works, truthfully**, to a small cohort.

**What I would focus on:**
- Reposition honestly to "**instant website enquiry capture + auto-reply + lead inbox for UK service businesses**." It's real, it works, and missed-enquiry recovery is a genuine pain you can demo.
- Turn the money path on: verify Stripe + Resend in prod, flip off early-access, run one real £79 purchase end-to-end.
- Use the **manual outreach queue** (compliant, built) to book 20–30 demos. Hand-onboard every one of the first 10 customers — install their widget for them, prove one captured lead.

**What I would ignore (for 30 days):**
- Building real conversational AI (worthy, but not a 30-day revenue lever).
- Scaling SEO page count, the blog, appointment booking, AI Visibility polish.
- Refactoring the duplicate outreach systems.

**What I would ship next (in order):** (1) prod Stripe/Resend verification + early-access off; (2) restore the truncated file + add `.gitattributes` + CI typecheck; (3) honest repositioning of the widget copy; (4) a "first lead captured" onboarding moment; (5) daily manual-outreach cadence.

**What I would stop immediately:**
- **Stop describing the product as an "AI Receptionist"** until it is one — it is the central commercial and compliance liability.
- **Stop committing from this working tree** until line-endings are fixed and the truncated file is restored — you are one `git add -A` away from a broken production deploy.
- **Do not schedule automated cold email** until Resend is verified and the PECR classification is spot-audited.

---

*Evidence base: `git log`/`git status`/`git diff`, `tsc --noEmit`, `jest`, Python `unittest`, `.env` key-presence scan, and direct reads of `src/lib/{lead-enrichment,outreach-eligibility,outreach-drafts,outreach-queue,outreach-templates,lead-finder,plans,email,provision-clinic}.ts`, `src/app/api/{outreach/run,stripe/checkout,stripe/webhook,trial/start,widget/submit,widget/bootstrap.js,agent/command}/route.ts`, `next.config.ts`, `vercel.json`, `.github/workflows/*`, and the portal/marketing/legal route tree.*

