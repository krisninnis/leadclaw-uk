# Homepage Trust & AI Readiness Upgrade — Delivery Report

**Date:** 2026-06-19
**Goal:** Improve homepage Trust, Conversion, SEO and AI Readiness without a public phone number or physical address.
**Out of scope (untouched):** Billing, Stripe, Lead Finder, Outreach.

---

## Files changed

| File | Change |
|------|--------|
| `src/app/page.tsx` | Added **Organization**, **Service**, and **FAQPage** JSON-LD (kept the existing SoftwareApplication block); added an 11-question **FAQ section** (same array powers both the visible accordion and the FAQPage schema, so they can't drift); added an honest **Trust / outcomes** section (metric tiles + a "worked example, not a promise" block); added a prominent **Free Audit CTA** band linking to `/free-audit`. |
| `src/components/app-footer.tsx` | Bottom bar now reads **"© {year} LeadClaw AI Ltd · United Kingdom · UK-based AI receptionist software"**; Privacy / Terms / Contact links retained. No phone, no address. |

Nothing else was modified. No billing, Stripe, Lead Finder, or Outreach files were touched.

### What was deliberately NOT added
- **No phone number** and **no physical address** anywhere (page or schema), per the brief.
- **No fake testimonials and no invented metrics.** The Trust section is mechanism-based: it explains *how* recovering one missed enquiry changes the maths, and labels the worked example as illustrative. (Confirmed with you: "no real figures yet — frame honestly".)

---

## Structured data

Four JSON-LD blocks now render on `/` (all validated as well-formed JSON, round-tripped through `JSON.parse`):

| Block | @type | Notes |
|-------|-------|-------|
| Existing | `SoftwareApplication` | Unchanged — kept as required. |
| New | `Organization` | `legalName: LeadClaw AI Ltd`, logo, `areaServed: United Kingdom`, `contactPoint` → /contact. No telephone/address. |
| New | `Service` | AI receptionist service, provider = LeadClaw, `areaServed: United Kingdom`, plan offers. |
| New | `FAQPage` | 11 Q&A built from existing pricing / free-trial / how-it-works messaging. |

This takes the homepage from **1 → 4** JSON-LD blocks (the audit's `structured_data` check scores full marks at ≥2) and adds the FAQ signal the `faq_content` check looks for.

---

## Review schema assessment (requested)

**Finding: legitimate review schema cannot be added yet — and was not.** There is no real review or rating data anywhere in the repo (no testimonials store, no ratings source), and the codebase already enforces a "never synthesise a rating" rule (`src/lib/landing/schema.ts` only emits `AggregateRating` when `rating.count > 0`). Inventing `ratingValue`/`reviewCount` would be a trust/policy violation and risk a Google manual action.

**Path to add it later, legitimately:** collect verifiable reviews (e.g. Google Business Profile or Trustpilot), persist the real `ratingValue` + `reviewCount`, then emit `AggregateRating` on the Organization/Service node using the same guarded pattern already in `schema.ts`. Until then, the homepage's existing "reviews/testimonials" wording keeps the partial-credit `review_content` signal without claiming a rating.

---

## Estimated score impact

Estimates use LeadClaw's own audit weightings (`src/lib/audit/checks.ts`) applied to the homepage's rendered signals. They assume the changes are **deployed** (the live audit fetches production HTML). Treat as directional (±5).

| Category | Current | Projected | Main drivers |
|----------|:------:|:---------:|--------------|
| **AI Readiness** | ~53 | **~95** | FAQPage schema (0→1), 4 JSON-LD blocks (0.7→1.0), author/team signal (0→1), more body content for knowledge depth (→1.0). |
| **Trust** | ~50 | **~70** | About signal (FAQ "about LeadClaw" + "our team"), results signal, existing contact/privacy/terms/reviews. Capped at ~70 by design — `phone` (wt 2) and `address` (wt 1) are intentionally left unmet. |
| **SEO** | ~92 | ~92 | Already strong; `local_seo` (wt 1) stays unmet without a local-business address. More headings/content reinforce but don't raise the ceiling. |
| **Conversion** | ~60 | ~60 (audit) | `clear_cta` and `online_booking` already pass. The audit's remaining points are `call_button` (tel:) and `contact_form` (a `<form>`) — neither added. Real-world conversion improves via the prominent Free Audit CTA even though the score is flat. |
| **Health** | ~96 | ~96 | Unchanged. |
| **Overall** | **~70** | **~83** | Driven almost entirely by AI Readiness + Trust. |

**Biggest remaining lever (not done, by design/scope):** adding a real on-page enquiry `<form>` would lift Conversion ~60→~80. It was left out to avoid touching enquiry/lead plumbing and because it needs a backend action — flagged for your call.

---

## Tests run

- `npx jest src/__tests__/landing-schema.test.ts` → **PASS (9/9).**
- Babel parse (project `next/babel` config) of both changed files → **PASS** (`page.tsx`, `app-footer.tsx`).
- JSON-LD validation: all four blocks extracted and `JSON.parse` round-tripped → **valid**; FAQ count = 11; confirmed **no phone/PostalAddress** emitted in structured data.
- `audit-engine` / `public-audit-widget` suites → **could not run** (see blockers).

## Build result

**Build did not complete — blocked by two issues unrelated to this change:**

1. **Offline environment:** `node_modules` holds the Windows SWC binary; Next 16 needs the Linux SWC binary and cannot download it here (`registry.npmjs.org` unreachable).
2. **Pre-existing corruption in the working tree (NOT from this task):**
   - `src/lib/audit/fetch-site.ts` is **truncated at line 239** (ends mid-word `retur`). It contains a half-finished DNS-pinning SSRF refactor. This breaks every test suite that imports the audit engine and will break `next build` too.
   - `package-lock.json` also appears truncated at EOF (JSON parse error at its final byte).

   I did **not** modify `fetch-site.ts` — it is outside this task's scope and is an in-progress refactor with no complete source to restore from. Recommend recovering it (revert to the last good commit or finish the refactor) before building/committing.

> ⚠️ During this task, the editor's write path repeatedly **truncated** `page.tsx` and `app-footer.tsx` on save (the known worktree truncation gremlin). Both files were re-written through the shell and **verified intact on disk** (page.tsx = 761 lines, app-footer.tsx = 136 lines, correct closing tags, 0 stray CR bytes). Please sanity-check these two files after pulling.

## Commit hash

**None.** Per the brief, a commit is provided only if fully validated. The build cannot be validated in this environment (offline SWC + the pre-existing `fetch-site.ts` / `package-lock.json` corruption), so nothing was committed. Once those blockers are resolved on a machine with the Linux toolchain, run `npm run build && npm test`, then commit.
