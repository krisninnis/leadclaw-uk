# LeadClaw Lead Scraper — Audit & Pivot Assessment

**Repo:** github.com/krisninnis/leadclaw-lead-scraper
**Date:** 11 June 2026
**Status:** Read-only audit. No code changed.

---

## 1. Current scraper purpose

A daily, automated B2B lead-generation pipeline that finds local UK businesses via the Google Places API, visits each business website to assess how well it captures enquiries, scores the lead, enriches it with a contact email, runs a UK PECR/GDPR compliance classification, generates a personalised cold-outreach email, and triggers sending through the LeadClaw web app. It runs unattended via GitHub Actions every day at 08:00 UTC (`--limit 4`, capped at 40 new leads/day).

The pipeline stages (in `auto_pipeline.py`) are:

`scrape → enrich emails → compliance classify + suppression check → generate messages → trigger outreach`

---

## 2. Current target niches

Exclusively **aesthetic / beauty-adjacent personal-care businesses**. Niches and their search queries are hardcoded in `places_batch.py`:

| Niche | Search queries |
|---|---|
| beauty | "beauty salon", "beauty clinic" |
| hair | "hair salon", "hairdresser" |
| nails | "nail salon", "nail bar" |
| lashes | "lash studio", "eyelash extensions" |
| brows | "brow bar", "eyebrow studio" |
| facials | "facial clinic", "skin clinic" |

The automated pipeline (`auto_pipeline.py`) narrows this further: `DEFAULT_NICHES = ["beauty"]` — so the daily GitHub Actions run only scrapes beauty salons/clinics. The PowerShell runner (`run-pipeline.ps1`) uses `beauty aesthetics skin laser cosmetic`. Despite the README calling it a generic "Lead Scraper Bot", every default and template is clinic/beauty-specific.

---

## 3. Where search terms, locations, categories, keywords & filters are defined

| Item | File | Detail |
|---|---|---|
| **Niche → query map** | `places_batch.py` | `DEFAULT_QUERIES` dict (lines ~18–25) |
| **Default city list** | `places_batch.py` | `DEFAULT_CITIES` (10 UK cities) |
| **Pipeline city pools** | `auto_pipeline.py` | `CITY_POOLS` — `uk` (20 cities) and `english_speaking` (29 global cities), selected by `TARGET_MARKET` env var |
| **City rotation** | `auto_pipeline.py` | `get_rotating_cities()` picks 3 cities/day based on the calendar ordinal |
| **Pipeline default niche** | `auto_pipeline.py` | `DEFAULT_NICHES = ["beauty"]` |
| **Query construction** | `places_run.py` `main()` | `query = f"{args.query} {args.city} uk"` |
| **Website signal keywords** | `places_run.py` | `CHAT_PATTERNS`, `CONTACT_FORM_PATTERNS`, `BOOKING_PATTERNS`, `WHATSAPP_PATTERNS`, `FAQ_PATTERNS`, `PHONE_CTA_PATTERNS`, `WEAK_SITE_PATTERNS` |
| **Lead-quality filter** | `places_run.py` | `should_keep_lead()` and `score_lead()` |
| **Email block/allow lists** | `enrich_emails.py` | `BLOCKED_SUBSTRINGS`, `BLOCKED_PREFIXES`, `PREFERRED_LOCAL_PARTS`, etc. |
| **Corporate-entity filter** | `auto_pipeline.py` | `CORPORATE_TYPES` set (Companies House types) |

---

## 4. Data sources

The scraper is **API- and website-based, not HTML-scraping of Google or directories**:

- **Google Places API** — `textsearch/json` (find businesses) and `details/json` (name, website, phone, address, rating, review count). This is the only discovery source.
- **Each business's own website** — fetched directly with `requests` + a custom User-Agent (`LeadClawResearchBot/1.0`) to detect live chat / booking / contact-form signals (`places_run.py`) and to extract a contact email (`enrich_emails.py`, parses HTML with BeautifulSoup, follows up to 3 contact/about links).
- **Companies House API** — `search/companies` for entity classification (corporate vs sole trader) — used for PECR compliance, not discovery.
- **Supabase** — `email_suppressions` table (do-not-contact list) and the `leads` table.

The legacy public-web scraper (`run.py`) is **disabled** — it raises `SystemExit` and points to the Places scripts. There is **no Google SERP scraping, no Maps HTML scraping, no third-party directory scraping**.

---

## 5. Deduplication

Two layers:

1. **Database constraint (insert-time)** — `places_run.py` `save()` catches `duplicate key value violates unique constraint` from Supabase and skips. So there's a unique index in the DB (defined in Supabase, not in this repo).
2. **Post-insert fuzzy dedup** — the README and `run-pipeline.ps1` reference marking duplicates `status=duplicate` using key priority **website > email > company+city**, with fuzzy company-name matching. The helper functions `clean_name()` and `name_similarity()` (SequenceMatcher, `NAME_MATCH_THRESHOLD = 0.80`) exist in `auto_pipeline.py`, but note: in the current `auto_pipeline.py` `main()` these are wired into **Companies House classification**, not an explicit dedupe pass. The dedupe-marking step described in the README appears to live in the Supabase/app side or an earlier version. Worth confirming where `status=duplicate` is actually set before relying on it.

---

## 6. Fields collected

Written to the Supabase `leads` table (`places_run.py` `save()`):

`niche, company_name, website, contact_email, contact_phone, city, source` (`"google-places"`), `score, lead_score, status` (`"new"`), `notes, google_rating, review_count, has_live_chat, has_contact_form`.

`notes` is a packed string built by `build_notes()`: `address`, `primary_cta`, `outreach_angle`, `website_quality_score`, `lead_fit_score`, `has_booking_cta`, `has_whatsapp`, `has_faq`, `has_phone_cta`.

Later stages add: `contact_email` (enrich), `pecr_classification`, `pecr_reason`, `company_number`, `pecr_classified_at` (compliance), and `outreach_angle`, `outreach_subject`, `outreach_message` (message generation).

---

## 7. Emails / phone / websites

- **Websites** — yes, from Google Places `details`. Required: leads with no website are dropped (`should_keep_lead` returns `False`).
- **Phone** — yes, `formatted_phone_number` from Places.
- **Emails** — **not** from Google. `contact_email` starts null and is filled by `enrich_emails.py`, which scrapes the business's own site (and contact/about pages) with a regex, then heavily filters out vendor/asset/no-reply addresses and prefers role inboxes (`info@`, `hello@`, `bookings@`, etc.). This is generic business contact harvesting from the company's own public website.

---

## 8. Output destination

**Supabase is the system of record.** Everything is inserted/updated in the `leads` table. Additionally:

- A markdown file `output/OUTREACH_MESSAGES_TODAY.md` is written by `generate_outreach_messages.py` (gitignored).
- **Live email outreach** is triggered by `auto_pipeline.py` `trigger_outreach()` → `POST {OUTREACH_BASE_URL}/api/outreach/run` (default `https://www.leadclaw.uk`) with a bearer token. The actual sending happens in the LeadClaw web app, not in this repo.

No CSV/JSON export, no direct SMTP in this repo.

---

## 9. Hardcoded clinic / aesthetic / dental wording

Significant. This is the biggest blocker to a clean pivot. Found in:

- **`generate_outreach_messages.py`** — the three email templates are written *to clinics*: "a brand-new startup **for clinics**", "a quick demo **for your clinic**", "We found **your clinic** on Google Maps", and the fallback business name defaults to **"your clinic"** (two places: lines ~205 and ~317). Subject line `"Quick idea for {business}"` is neutral.
- **`places_batch.py`** — `DEFAULT_QUERIES` is entirely beauty/clinic terms.
- **`auto_pipeline.py`** — `DEFAULT_NICHES = ["beauty"]`.
- **`run-pipeline.ps1`** — `--niches beauty aesthetics skin laser cosmetic`.
- **`README.md`** — examples use beauty/nail salons; "Insert into Supabase ... `source=google-places`".

No dental-specific wording. "aesthetic" only in the PowerShell runner. The website-signal keyword lists (booking platforms like Fresha/Treatwell/Phorest/Booksy) are beauty-industry booking tools but won't break on other niches — they just won't match as often.

---

## 10. Compliance risks

**This repo is noticeably more compliance-aware than typical scrapers** — it already classifies entities for UK PECR and honours a suppression list. Still, risks:

- **robots.txt** — **Not checked.** Neither `places_run.py` (site scan) nor `enrich_emails.py` (email harvest) reads or respects `robots.txt` before fetching business websites. The README claims "Respect robots.txt" but the code does not enforce it. *Gap.*
- **Rate limits** — Light/uneven. No global throttle or politeness delay between website fetches; requests fire as fast as the loop runs (12s/10s timeouts only). Companies House calls have a `time.sleep(0.5)` and 429 back-off. Google Places has no client-side rate limiting. Daily volume is capped (`SCRAPER_DAILY_NEW_CAP=40`, `ENRICH_DAILY_LIMIT=20`, pipeline `--limit 4`), which mitigates scale risk but not burst politeness.
- **Personal data (UK GDPR)** — Emails are scraped from business sites. Role inboxes (`info@`) are lower-risk, but personal addresses (`firstname@`, gmail/hotmail) **are accepted and even scored** in `enrich_emails.py`, which can constitute personal data. Storing/processing these needs a lawful basis and a retention policy.
- **Email outreach rules (PECR)** — Strong points: every template includes sender identity (Lead Claw Ltd, company number, postal address), how the data was obtained ("found on Google Maps"), a privacy-policy link, a data-rights email, and an unsubscribe link. The pipeline runs a **Companies House classification** and only generates messages for leads classified `corporate`; sole traders/individuals are held as `unknown`. Under PECR, unsolicited B2B email to **corporate subscribers (Ltd/PLC/LLP)** is permitted with an opt-out; emailing **sole traders/partnerships/individuals** generally requires consent — so the corporate-only gate is the right instinct.
- **Consent / GDPR considerations** — No prior consent is obtained (legitimate-interest model). Remaining gaps: (a) the "unknown" classification when `COMPANIES_HOUSE_API_KEY` is absent — leads are held, which is safe, but if the key is missing in production nothing gets contacted; (b) no visible data-retention/erasure job in this repo; (c) personal-format emails should be excluded from outreach, not just deprioritised; (d) robots.txt/ToS adherence as above.

**Net:** the *outreach* side is well-built for UK PECR. The *collection* side (robots.txt, personal emails, fetch politeness) is where the exposure sits — and it grows if the pivot widens volume and niches.

---

## 11. Safe target categories for LeadClaw

LeadClaw's value prop is capturing missed enquiries / calls and automating follow-up for **appointment-led local service businesses with a website but weak digital lead capture**. The scoring engine (`should_keep_lead` / `scan_website`) already rewards exactly this: a real website, no live chat, a contact form or weak booking flow, decent reviews. That logic is **niche-agnostic** and transfers directly. Good-fit categories:

- **Appointment-based personal services:** barbers, tattoo/piercing studios, spas, massage therapists, tanning salons.
- **Health & wellbeing (non-medical):** physiotherapists, chiropractors, osteopaths, sports-massage, podiatrists, private dentists/orthodontists, opticians, hearing clinics, vets.
- **Home & trade services (high missed-call value):** plumbers, electricians, boiler/heating engineers, locksmiths, roofers, pest control, garage doors, driveways/landscaping.
- **Property & professional:** estate/letting agents, mortgage/insurance brokers, accountants, solicitors, surveyors, IFAs.
- **Auto:** independent garages, MOT centres, car valeting/detailing, body shops.
- **Education & lessons:** driving instructors/schools, tutoring centres, music schools, dance/martial-arts studios.
- **Events & hospitality services:** photographers, caterers, event venues, wedding planners.

These all (a) take bookings/enquiries, (b) commonly have basic websites, (c) lose revenue to missed calls and slow follow-up.

---

## 12. Safest niches to scrape first (recommended order)

Prioritised by **PECR safety (high incorporation rate → mostly "corporate")**, clear missed-call pain, and lowest reputational/legal sensitivity:

1. **Trades — plumbers, electricians, heating engineers, locksmiths.** Frequently Ltd companies (clean PECR fit), notoriously miss calls while on jobs → strongest pain match. Best starting niche.
2. **Independent auto garages / MOT / detailing.** Often incorporated, appointment-driven, phone-heavy.
3. **Property — estate & letting agents, brokers.** High incorporation, enquiry-form heavy, already marketing-receptive.
4. **Professional services — accountants, solicitors, surveyors.** Almost all incorporated (very clean PECR), but more gatekeepers; expect lower reply rates.
5. **Non-medical wellbeing — physio, chiro, osteo, sports massage.** Good fit, but more sole traders → more will classify "individual" and be (correctly) held back.

**Hold / handle with care:** anything medical/regulated (private GPs, dentists doing clinical work, cosmetic-medical) — higher data-sensitivity and advertising rules. Avoid until the corporate-only gate and personal-email exclusion are tightened.

The Companies House gate means **whichever niche you pick, only the incorporated businesses get emailed automatically** — so trades/property/professional will have the highest usable yield, while sole-trader-heavy niches (some beauty, some wellbeing) will see more leads parked as "unknown/individual".

---

## 13. Files likely needing changes for the pivot

| File | Change needed | Why |
|---|---|---|
| **`places_batch.py`** | Replace/extend `DEFAULT_QUERIES` and `DEFAULT_CITIES`; make niches configurable | This is the search-term source of truth |
| **`auto_pipeline.py`** | Change `DEFAULT_NICHES`; consider a niche-rotation scheme like the city rotation | Controls what the daily automated run actually scrapes |
| **`generate_outreach_messages.py`** | **Rewrite the 3 templates** to be niche-neutral (remove "for clinics" / "your clinic" / "found your clinic on Google Maps"); change the two `"your clinic"` fallbacks to e.g. `"your business"`; optionally make value-prop copy niche-aware | Biggest hardcoded-wording blocker; sending clinic copy to a plumber will tank reply rates and looks untargeted |
| **`places_run.py`** | Optionally broaden `BOOKING_PATTERNS` (add trades/professional booking tools: Calendly, Acuity, Setmore, ServiceM8, Jobber, Housecall) and tune scoring per niche; **add robots.txt check** | Improves signal accuracy for new niches and closes a compliance gap |
| **`enrich_emails.py`** | **Exclude personal-format emails from outreach** (or flag them), add robots.txt respect and a politeness delay | Compliance hardening that matters more at wider scale |
| **`run-pipeline.ps1`** | Update hardcoded `--niches beauty aesthetics skin laser cosmetic` | Local Windows runner still beauty-locked |
| **`README.md`** | Update examples and positioning | Docs still say beauty/clinic |
| **Supabase (outside repo)** | Confirm `leads` unique constraint, the `status=duplicate` logic, and add a retention/erasure routine | Dedup and GDPR retention live partly in the DB/app |

No new data source is required — the same Google Places + website + Companies House stack works for every niche above. The pivot is mostly **config + copy + two compliance hardening edits**, not an architectural change.

---

## 14. Suggested staged implementation plan

**Stage 0 — Decide & confirm (no code).** Pick the first pivot niche (recommend trades). Confirm where `status=duplicate` is actually set (DB trigger vs app vs script) so dedup isn't silently lost when niches change.

**Stage 1 — Niche-neutral copy.** Rewrite the three templates and the `"your clinic"` fallbacks in `generate_outreach_messages.py` to be business-type-neutral. This alone de-risks any wider scrape, since outreach content is what recipients and regulators see. Keep all the existing PECR footer/unsubscribe machinery.

**Stage 2 — Config-driven niches.** Add the new niche→query entries to `places_batch.py`, point `DEFAULT_NICHES` in `auto_pipeline.py` at the chosen niche, and update `run-pipeline.ps1`. Run a **dry-run** (`auto_pipeline.py --dry-run`) and a tiny live batch (`--limit 2`, `--skip-outreach`) to inspect lead quality in Supabase before any sending.

**Stage 3 — Compliance hardening (do before scaling).** In `enrich_emails.py`: respect robots.txt, add a per-request politeness delay, and exclude/flag personal-format emails. Verify `COMPANIES_HOUSE_API_KEY` is set in production so the corporate gate actually functions; confirm sole-trader leads stay held.

**Stage 4 — Tune scoring per niche.** Broaden `BOOKING_PATTERNS` for trades/professional booking tools and review `should_keep_lead` thresholds (review-count minimums differ by niche — a plumber may have fewer Google reviews than a salon).

**Stage 5 — Controlled ramp.** Keep `FREE_TIER_MODE=1` and the daily caps low; enable outreach for the new niche only after manually reviewing the first generated message batch. Add a data-retention/erasure job in Supabase. Then widen cities/niches via the existing rotation.

---

*Audit complete — no code modified. Recommend starting with Stage 1 (copy) since it's the single biggest blocker and the lowest-risk change.*
