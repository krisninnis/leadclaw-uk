# Homepage Rebuild — Delivery Report

**Date:** 2026-06-19
**Scope honoured:** No changes to brand/visual system, pricing, billing, Stripe, onboarding, Lead Finder, Outreach, Audit Engine, or AI Readiness. No invented customers, testimonials, logos, ratings, stats, or case studies. Existing industry SEO pages and their URLs were not touched.
**Decision taken (with you):** Keep "AI receptionist" as the category term but reframe it honestly as a **website** enquiry tool — never implying it answers phone calls.

Companion document: `HOMEPAGE-EXEC-REVIEW.md` (Phase 1–2 review + capability matrix).

---

## Files changed and why

| File | Change | Why |
|------|--------|-----|
| `src/app/page.tsx` | Full rewrite of copy/structure. New honest hero; preview card no longer says "answers calls"; features relabelled to what's real; three overlapping ROI/trust sections collapsed into one; added flagship-industries + testimonials sections; positive trust signals replace defensive negations; new honest FAQ "Does LeadClaw answer phone calls?". | Remove the false phone-answering claim, cut repetition, lead with aesthetic clinics while staying multi-industry, and pass the 5-second test. |
| `src/components/app-footer.tsx` | "answer every call and enquiry" → "capture every website enquiry … follow up automatically". | The product has no telephony; the footer claim was false. |
| `src/components/seo/solutions-by-clinic-type.tsx` | Heading "Solutions by Clinic Type" → "Solutions by industry"; intro no longer says "answers calls"; examples broadened beyond clinics. | Honesty + the product is multi-industry, not clinic-only. (Shared component — also improves /demo, /help, /how-it-works.) |
| `src/components/seo/flagship-industries.tsx` | **New.** Concise homepage industries block: aesthetic clinics as flagship + 6 example industries + one "View all industries" link. | Replaces the 34-link wall on the homepage (Phase 5) to protect conversion while keeping multi-industry recognition. |
| `src/components/landing/testimonials.tsx` | **New.** Testimonial scaffold that renders real quotes when added, and an honest "early access / verified stories coming soon" placeholder until then. | Phase 6 — structure ready for real proof, no invented testimonials. |
| `src/app/industries/page.tsx` | **New** `/industries` index page rendering the full industry grid + hero CTAs. | Phase 5 — a real "all industries" destination for the homepage's single link. No existing pages/URLs changed. |
| `src/app/sitemap.ts` | Added the `/industries` route (additive only). | So the new index page is discoverable. |

## What was deliberately NOT done
- No telephony/"answers calls" claim anywhere (it's false).
- No invented proof of any kind. The testimonials section ships with obvious placeholders.
- `src/lib/audit/fetch-site.ts` left untouched — it's in the Audit Engine (out of scope) and is a pre-existing, incomplete refactor (truncated at line 239).
- No brand, pricing, billing, Stripe, onboarding, Lead Finder, Outreach, or AI Readiness changes.

---

## Honesty pass (Phase 2 result applied)
- **Removed/false → fixed:** hero card "Answers calls 24/7"; footer "answer every call"; component "answers calls"; "Missed Call Recovery" feature; "Weekly Enquiry Summary" (unverified).
- **Reframed to real:** "24/7 enquiry capture", "Out-of-hours cover", "Lead capture", "Automatic follow-up" (real 2-hour cron), "Enquiry inbox", "Appointment reminders" (real cron).
- **Defensive → positive:** removed "no fake reviews / no invented ratings" lines; replaced with UK-built, founder-led, early access, fast setup, no card, UK-GDPR data handling.

## Phase 8 — performance
The homepage is a fully static server component with no above-the-fold client or async work, so the hero renders immediately with no loading flash. The global `loading.tsx` spinner only appears during transitions to async routes, not on the static homepage. No change required.

## Phase 9 — persona critique
- **Clinic owner (aesthetic):** Trusts UK-built/founder-led/no-card and the flagship section that speaks directly to them; the honest "we don't answer calls, we capture website enquiries" removes a future disappointment. Converts on "one enquiry covers the plan" + free trial.
- **Plumber:** Recognises themselves (plumbers in examples + /industries); "out-of-hours cover" and "capture quote requests while on a job" land. Converts via low-risk trial.
- **Accountant:** Listed in examples; "capture enquiries + automatic follow-up" is relevant; multi-industry framing avoids feeling clinic-only.
- **Sceptical buyer:** The explicit "Does LeadClaw answer phone calls? No." plus labelled placeholder testimonials read as honest, not evasive. Residual gap (no real proof yet) is mitigated by the no-card trial and free audit. Would convert to *trial*, not to a paid plan sight-unseen — which is the correct ask.

---

## Validation

**Production build: could NOT complete in this environment — blocked by three pre-existing, out-of-scope issues, none caused by these changes:**
1. **SWC binary mismatch** — `node_modules` contains only `@next/swc-win32-x64-msvc`; the Linux sandbox needs `@next/swc-linux-x64-gnu`, which can't be fetched offline.
2. **`package-lock.json` corrupt** — `next build` fails parsing it: *"Expected double-quoted property name in JSON at position 577031 (line 15479)"*.
3. **`src/lib/audit/fetch-site.ts` truncated** at line 239 (ends mid-statement `retur`) — an incomplete Audit-Engine refactor, explicitly out of scope.

**Changed files validated independently (all pass):**
- TypeScript compiler **syntax parse** of all 7 changed/new files → **ALL PARSE CLEAN**.
- **ESLint** on the intact set → clean (the only two errors seen mid-task were a file-corruption artdefact, since fully restored and re-verified).
- **NUL-byte audit** → 0 across all 7 files (the worktree truncation gremlin struck `page.tsx`, `sitemap.ts`, and `solutions-by-clinic-type.tsx` during edits; all were repaired from intact sources and re-verified — line counts and closing tags correct).
- **Link integrity** → every flagship link and the `/industries` link resolve to existing pages.

**Screenshots:** not available — the app cannot be built or served in this offline/SWC-blocked sandbox.

**Commit:** **None.** Per the brief, commit only if the build passes. The full build cannot be validated here (external blockers above), so nothing was committed. On a machine with the Linux toolchain: restore/finish `fetch-site.ts`, repair `package-lock.json`, then `npm run build && npm test`, and commit only if green.

---

## Conversion summary
The homepage now passes the 5-second test honestly: a visitor learns it's an AI receptionist **for your website** that captures enquiries 24/7 and follows up automatically (what), for UK service businesses led by aesthetic clinics (who/problem), backed by a UK founder-led team with a no-card trial (trust), with one clear next step — **Start free trial** (action). The biggest credibility risk (a provably false "answers calls" claim) is gone, repetition is cut, the 34-link wall is replaced by a focused flagship section, and defensive language is replaced with positive proof — with a testimonial slot ready for real customer stories.
