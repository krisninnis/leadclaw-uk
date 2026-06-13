\# LEADCLAW — SEO CONTENT ARCHITECTURE \& EXECUTION PLAN



\*\*Domain:\*\* https://www.leadclaw.uk · \*\*Category:\*\* UK AI receptionist \& lead-capture SaaS

\*\*Built for the actual codebase:\*\* Next.js app with existing programmatic SEO infra — `lib/seo-pages.ts` → `/seo/\[slug]` (`force-static`, `dynamicParams=false`) → `SeoLandingPage` component (already emits \*\*Service\*\* + \*\*FAQPage\*\* JSON-LD) + `sitemap.ts` + `robots.ts`. This plan extends that system; it does not reinvent it.



\---



\## 1. EXECUTIVE SUMMARY



LeadClaw has better SEO foundations than its traffic suggests: a working programmatic landing-page engine with schema, a sitemap, and three live SEO pages. The problem is \*\*positioning drift and under-population\*\*, not missing infrastructure. Three things are actively costing you rankings and conversions:



1\. \*\*Wrong canonical term.\*\* Existing pages target \*\*"AI agent"\*\* (`/seo/ai-agent-for-dental-clinics-uk`) and the schema/OG copy still says \*\*"AI workflow automation suite."\*\* Your buyers search \*\*"AI receptionist."\*\* You are optimising for a term with lower intent and lower volume than the category you actually compete in. Fix the term first — everything else compounds on it.

2\. \*\*The money pages don't exist yet.\*\* There is no `/ai-receptionist-uk` hub, no per-vertical "AI receptionist for \[dentists/clinics]" pages on the right slug, no comparison pages, and no resources/blog route at all. The highest-intent, highest-converting queries have no page to rank.

3\. \*\*No EEAT layer.\*\* No author, no founder, no case studies, no testimonials, no company entity on-site. Google's clinic/health-adjacent queries (YMYL-adjacent) demand trust signals you currently have zero of — and so do your buyers.



\*\*Strategy in one line:\*\* Own \*\*"AI receptionist UK"\*\* as the category hub, fan out to \*\*high-intent vertical and comparison pages\*\* (the demo/trial drivers), build an \*\*EEAT + resources layer\*\* for authority, and use the scraper/lead DB for a \*\*carefully-gated\*\* "best \[vertical] in \[city]" programmatic set that is a \*backlink/outreach\* play — never a thin doorway farm.



\*\*Priority order of effort:\*\* (1) fix the canonical term + homepage/hub, (2) ship the 20 landing pages via `seo-pages.ts`, (3) comparison pages, (4) EEAT, (5) local + content calendar, (6) programmatic last and gated.



\*\*90-day target:\*\* rank top-10 for 3–5 long-tail vertical/comparison terms, top-20 for "AI receptionist UK," and route SEO traffic into the existing `/free-trial` and `/demo` funnels with measurable demo/trial events (GA4 already installed).



\---



\## 2. SITE ARCHITECTURE



\### 2.1 Canonical-term decision (do this before any page work)

Adopt \*\*"AI receptionist"\*\* as the primary category term sitewide. \*\*"AI agent"\*\* and \*\*"AI workflow automation"\*\* are demoted to body synonyms.

\- 301-redirect existing `/seo/ai-agent-for-dental-clinics-uk` → `/ai-receptionist-for-dentists-uk`, `/seo/ai-agent-for-aesthetic-clinics-uk` → `/ai-receptionist-for-aesthetic-clinics-uk`.

\- Change `SeoLandingPage` `serviceType` from `"AI workflow automation"` → `"AI receptionist service"` and the OG `alt`/image off the panther mascot.

\- Consolidate the three hard-coded sitemap SEO URLs into the `seoPages\[]` array so routes, canonicals, and sitemap never drift.



\### 2.2 Homepage structure (SEO + conversion)

H1 around the head term; one primary CTA (free trial), one secondary (demo). Section order optimised for both crawl semantics and conversion:

1\. Hero — H1 "AI receptionist for UK \[clinics/businesses]…" + trial CTA.

2\. Problem ("every missed call is a missed booking").

3\. How it works (3 steps; link to `/how-it-works`).

4\. Outcomes/features (3, outcome-led; internal-link to vertical pages).

5\. \*\*"By industry" grid\*\* — links to each vertical landing page (dentists, aesthetic, physio, chiropractor, estate agents, +). This is the internal-linking hub.

6\. Social proof (testimonials/case studies).

7\. Pricing snapshot → `/pricing`.

8\. FAQ (FAQPage schema) → final trial CTA.



\### 2.3 Navigation (exactly what should appear)

Lean top nav — 5 items + login + 1 button:



```

\[LeadClaw]   Solutions ▾   Pricing   Compare ▾   Resources   |   Login   \[ Start free trial ]

```

\- \*\*Solutions ▾\*\* (mega-menu / dropdown): AI receptionist for Dentists · Aesthetic clinics · Physiotherapists · Chiropractors · Estate agents · Small businesses · "See all industries." → these are the vertical landing pages.

\- \*\*Pricing\*\* → `/pricing`.

\- \*\*Compare ▾\*\*: LeadClaw vs Rosie · vs Goodcall · vs Synthflow · vs Podium · "All comparisons."

\- \*\*Resources\*\* → `/resources` (blog/guides hub — does not exist yet; create it).

\- \*\*Login\*\* (quiet text link) · \*\*Start free trial\*\* (button) → `/free-trial`.

\- Demo lives as a secondary CTA on pages, not a top-nav item (keeps nav tight).



\### 2.4 Footer structure (also an internal-linking + EEAT surface)

```

Product:     How it works · Pricing · Demo · Free trial · Login

By industry: Dentists · Aesthetic clinics · Physiotherapists · Chiropractors · Estate agents · All industries

Compare:     vs Rosie · vs Goodcall · vs Synthflow · vs Podium · All comparisons

Company:     About · Founder · Case studies · Contact · Careers

Trust/Legal: Security \& data · Privacy · Terms · Cookies · DPA

Identity:    LeadClaw is a product of \[Entity Ltd], reg. England \& Wales, co. no. \[XXXX], \[address]. UK-based. Payments by Stripe.

```

The footer's "By industry" + "Compare" columns give every money page a sitewide internal link (crawl depth ≤1 from homepage).



\### 2.5 Internal-linking structure (the model)

\- \*\*Hubs (pillars):\*\* `/ai-receptionist-uk` (category), `/missed-call-solutions-uk`, `/lead-capture-software-uk`, `/resources` (content hub).

\- \*\*Spokes:\*\* each vertical page + each comparison page links \*\*up\*\* to the relevant hub and \*\*across\*\* to 2–3 sibling pages ("AI receptionist for dentists" ↔ "for physios" ↔ "for clinics"). Blog posts link \*\*down\*\* to the matching vertical/hub page with a keyword-rich anchor.

\- \*\*Conversion links:\*\* every SEO page ends with a contextual CTA to `/free-trial` and `/demo` (the template already supports `TrialCtaLink`).

\- Rule: no orphan pages — anything added to `seo-pages.ts` must be reachable from a hub, the Solutions/Compare menus, or the footer.



\---



\## 3. LANDING PAGE ROADMAP — FIRST 20 SEO PAGES



Each ships as an entry in `lib/seo-pages.ts` (slug, title, metaDescription, h1, audience, faq\[]) rendered by the existing template. \*\*Funnel:\*\* TOFU/MOFU/BOFU. \*\*Conv. intent:\*\* High/Med/Low.



| # | URL slug | Page title | Meta description | Intent | Funnel | Conv |

|---|---|---|---|---|---|---|

|1|`/ai-receptionist-uk`|AI Receptionist UK — Never Miss a Call or Enquiry \\| LeadClaw|UK AI receptionist that answers calls \& web enquiries 24/7, captures leads and books appointments. Start a 7-day free trial — no card.|Commercial — category head|MOFU|High|

|2|`/ai-receptionist-for-dentists-uk`|AI Receptionist for Dental Clinics UK \\| LeadClaw|Fill more chairs: LeadClaw answers patient calls \& website enquiries 24/7 and books them in. Built for UK dental practices. Free trial.|Commercial — vertical|BOFU|High|

|3|`/ai-receptionist-for-aesthetic-clinics-uk`|AI Receptionist for Aesthetic Clinics UK \\| LeadClaw|Capture every aesthetics enquiry instantly and book consultations automatically. AI front desk for UK clinics. Try it free.|Commercial — vertical|BOFU|High|

|4|`/ai-receptionist-for-physiotherapists-uk`|AI Receptionist for Physiotherapists UK \\| LeadClaw|Stop losing patients to voicemail. LeadClaw answers \& books physio enquiries 24/7. UK-based. 7-day free trial.|Commercial — vertical|BOFU|High|

|5|`/ai-receptionist-for-chiropractors-uk`|AI Receptionist for Chiropractors UK \\| LeadClaw|AI front desk for chiropractic clinics — answer, capture and book every enquiry around the clock. Free trial, no card.|Commercial — vertical|BOFU|High|

|6|`/ai-receptionist-for-estate-agents-uk`|AI Receptionist for Estate Agents UK \\| LeadClaw|Never miss a viewing request. LeadClaw captures and qualifies property enquiries 24/7 for UK estate \& letting agents.|Commercial — vertical|BOFU|High|

|7|`/ai-receptionist-for-small-businesses-uk`|AI Receptionist for Small Businesses UK \\| LeadClaw|Affordable AI receptionist for UK small businesses — answer calls, capture leads, automate follow-ups from £79/mo. Free trial.|Commercial — vertical|MOFU|High|

|8|`/missed-call-solutions-uk`|Missed Call Solutions for UK Businesses \\| LeadClaw|Turn missed calls into booked customers. LeadClaw auto-responds, captures the lead and follows up. UK AI receptionist. Free trial.|Problem-aware|MOFU|High|

|9|`/missed-call-recovery-uk`|Missed Call Recovery Software UK \\| LeadClaw|Recover revenue from missed calls: instant text-back, lead capture and follow-up. Built for UK service businesses.|Problem-aware|MOFU|High|

|10|`/lead-capture-software-uk`|Lead Capture Software for UK Service Businesses \\| LeadClaw|Capture website and call enquiries automatically, organise them in one inbox, and chase follow-ups. UK lead-capture software.|Commercial|MOFU|High|

|11|`/ai-phone-answering-service-uk`|AI Phone Answering Service UK \\| LeadClaw|24/7 AI phone answering for UK businesses — books appointments and captures leads at a fraction of a human service. Free trial.|Commercial|MOFU|High|

|12|`/virtual-receptionist-uk`|Virtual Receptionist UK — AI-Powered \\| LeadClaw|A virtual receptionist that never sleeps. AI call \& enquiry answering, lead capture and booking for UK businesses.|Commercial|MOFU|High|

|13|`/after-hours-call-answering-uk`|After-Hours Call Answering for UK Clinics \\| LeadClaw|Capture and book enquiries that come in after you close. 24/7 AI receptionist for UK clinics and service businesses.|Problem-aware|MOFU|Med|

|14|`/website-chat-widget-lead-capture`|AI Website Chat Widget for Lead Capture \\| LeadClaw|Add an AI receptionist widget to your site to capture and qualify enquiries 24/7. Lightweight, works on any website.|Solution-aware|MOFU|Med|

|15|`/appointment-booking-ai-uk`|AI Appointment Booking for UK Clinics \\| LeadClaw|Let AI book appointments from calls and web enquiries straight into your calendar. Built for UK clinics. Free trial.|Commercial|MOFU|High|

|16|`/dental-reception-software-uk`|Dental Reception Software UK — AI Front Desk \\| LeadClaw|Reduce front-desk load: AI answers patient enquiries, books appointments and chases no-shows. For UK dental practices.|Commercial — vertical|BOFU|High|

|17|`/ai-receptionist-pricing-uk`|AI Receptionist Pricing UK — How Much Does It Cost? \\| LeadClaw|What a UK AI receptionist costs in 2026, compared. LeadClaw from £79/mo with a free trial. See pricing.|Commercial — pricing|BOFU|High|

|18|`/best-ai-receptionist-uk`|Best AI Receptionist for UK Small Businesses (2026) \\| LeadClaw|Compare the best AI receptionists for UK businesses in 2026 — features, pricing and fit. See where LeadClaw stands.|Commercial — "best of"|MOFU|Med|

|19|`/24-7-call-answering-for-clinics-uk`|24/7 Call Answering for UK Clinics \\| LeadClaw|Never miss a patient call again. Round-the-clock AI answering, lead capture and booking for UK clinics.|Problem-aware|MOFU|Med|

|20|`/free-trial-ai-receptionist`|Try an AI Receptionist Free for 7 Days \\| LeadClaw|Start a 7-day free LeadClaw trial — set up an AI receptionist for your business in minutes. No card required.|Transactional|BOFU|High|



\*\*Build order:\*\* 2,3 (already have "ai-agent" equivalents — migrate first), then 1 (hub), 7,8,9,10 (high-volume problem terms), then 4,5,6 (verticals), then 11–20. Verticals (#2–6,16) convert best because intent is unambiguous and competition is thin; the hub (#1) is the authority anchor everything links to.



\---



\## 4. COMPARISON PAGE STRATEGY



Competitor pricing (verified June 2026): Rosie \~£/$49/mo, Goodcall $59–199, Smith.ai $95+ (hybrid), GoHighLevel $97–497 + AI add-ons, Synthflow (DIY voice-AI builder), Podium (US reviews/messaging), Birdeye, Tidio, Dialzara.



\*\*Build first (easiest to win + best converting):\*\*

1\. \*\*LeadClaw vs Rosie\*\* — Rosie is the closest SMB-priced competitor; "vs Rosie" searchers are bottom-funnel and price-sensitive (your sweet spot). \*Easiest + high convert.\*

2\. \*\*LeadClaw vs Goodcall\*\* — same SMB tier, phone-AI; differentiate on inbound \*\*+\*\* outbound + UK + done-for-you. \*Easy + high convert.\*

3\. \*\*LeadClaw vs Synthflow\*\* — Synthflow is DIY/technical; position LeadClaw as the productised, no-build alternative. \*Medium difficulty, strong angle.\*

4\. \*\*LeadClaw vs Podium\*\* — higher volume term but US-centric/expensive; win on "UK + cheaper + lead-gen included." \*Harder, good top-funnel.\*



\*\*Then:\*\* vs Smith.ai (price/automation angle), vs GoHighLevel (DIY-sprawl vs done-for-you), vs Dialzara/Tidio (commodity).



| Slug | Title | Intent | Difficulty | Conv |

|---|---|---|---|---|

|`/compare/leadclaw-vs-rosie`|LeadClaw vs Rosie — UK AI Receptionist Compared (2026)|BOFU comparison|Low|High|

|`/compare/leadclaw-vs-goodcall`|LeadClaw vs Goodcall — Which AI Receptionist Wins?|BOFU comparison|Low|High|

|`/compare/leadclaw-vs-synthflow`|LeadClaw vs Synthflow — Done-For-You vs DIY Voice AI|BOFU comparison|Low–Med|High|

|`/compare/leadclaw-vs-podium`|LeadClaw vs Podium — UK Alternative for Clinics|BOFU comparison|Med|Med|



\*\*Page template (each comparison):\*\* honest at-a-glance table (price, UK support, inbound+outbound, setup, contracts), "best for X / best for Y" verdict (never claim you win every row — Google and users punish that), migration angle, FAQ schema, trial CTA. \*\*Keywords easiest to win:\*\* "\[competitor] alternative UK", "\[competitor] vs", "\[competitor] pricing UK" — low competition, high intent. Put a `/compare` hub page linking all of them.



\---



\## 5. PROGRAMMATIC SEO ROADMAP (gated, using the lead DB)



You can generate "Best \[vertical] in \[city]" pages from the scraper's Google Places + Companies House data. \*\*Be clear-eyed: this is an authority/backlink/outreach play, not a demo driver\*\* — patients searching "best dentist in Birmingham" are not LeadClaw buyers. It also carries the highest risk in this plan (doorway/thin-content penalties, and reputational/legal risk from publishing rankings of real named businesses scraped without consent). Do it \*\*small, editorial, and gated\*\*, or not at all.



\*\*Use it for two legitimate goals:\*\* (a) topical authority + local backlinks, (b) an outreach hook ("you're featured / claim your profile" → warm conversation with the exact clinics you sell to).



\### Page templates

\- \*\*City × vertical index:\*\* `/\[vertical]/best-in/\[city]` e.g. `/dentists/best-in-birmingham`. Editorial intro (200+ unique words on choosing a \[vertical] in \[city]), a genuinely useful curated list (rating, reviews, area, services) — \*\*not\*\* a raw scrape dump.

\- \*\*Listing detail (optional, later):\*\* `/\[vertical]/\[city]/\[business-slug]` — only if you add real unique value (summary, hours, a "claim this listing" CTA). Higher duplication risk; defer.



\### Schema

`ItemList` of `LocalBusiness`/`Dentist`/`MedicalClinic` for the index; `BreadcrumbList`; `FAQPage` for "how we chose." Do \*\*not\*\* fake `aggregateRating` on businesses you don't own (the homepage already had a fake rating — never repeat that).



\### Duplication risks \& quality safeguards (mandatory)

\- \*\*Unique content floor:\*\* every page needs ≥150–200 words of genuinely unique, human-edited intro + a different curated set. Boilerplate-with-city-swapped = doorway pages = deindex risk.

\- \*\*Minimum data quality gate:\*\* only generate a city×vertical page if you have ≥8 quality, deduplicated, verified listings (rating + reviews present). Below threshold → don't build it.

\- \*\*No PII / no scraped emails on public pages.\*\* Public listings = business name, public address, rating only. (Cold-outreach data stays internal — keeps you clear of the PECR/GDPR exposure flagged in the legal review.)

\- \*\*Takedown path:\*\* a visible "request changes / claim or remove this listing" link. Publishing rankings of named businesses invites complaints — give them a route.

\- \*\*Editorial review:\*\* a human approves each batch before indexing. The existing `force-static` + `dynamicParams=false` setup is perfect for this — pages only exist if you explicitly add them to the data source, so you control the index set.



\### Indexing strategy (staged)

1\. \*\*Phase 1 (10–20 pages):\*\* build for your top target cities × your wedge vertical (e.g. dentists in Birmingham, Manchester, Leeds, Cardiff, Bristol). Index only these. Watch Search Console for impressions, CTR, and any "Crawled – not indexed" (Google's thin-content signal).

2\. \*\*Phase 2:\*\* if Phase 1 pages get indexed and earn impressions/links, scale to more cities — but keep the quality gate. If Phase 1 sits in "Crawled – not indexed," \*\*stop and improve depth\*\*, don't scale the problem.

3\. Add programmatic URLs to `sitemap.ts` only after editorial approval. Keep them in a separate sitemap section so you can monitor their indexation cohort.

4\. Never let programmatic pages outnumber your "real" pages 50:1 early — it dilutes site quality signals on a young domain.



\---



\## 6. EEAT STRATEGY



Clinic/health-adjacent SEO is YMYL-adjacent; Google wants trust, and so do dentists. You currently have none on-site.



\- \*\*Founder page\*\* (`/founder` or `/about`): real name, photo, background, why LeadClaw exists, LinkedIn link. Author of the blog. This is your strongest EEAT asset as a solo founder — use it.

\- \*\*Author bylines:\*\* every blog post authored by the founder (or a named person) with an `author` schema + bio box linking to the founder page.

\- \*\*Case studies\*\* (`/case-studies/\[slug]`): even 1–2 pilot results ("clinic X recovered N missed calls / booked N appointments in 30 days"). Real numbers, named or anonymised with permission. `Article` + `Review`/`Organization` schema.

\- \*\*Testimonials:\*\* on homepage + vertical pages, with name + clinic + (ideally) photo. Pilot/founding-customer quotes are fine if genuine. Never fabricate.

\- \*\*Citations / authority:\*\* get listed in legitimate UK SaaS/AI directories, relevant industry bodies, and earn a few editorial mentions (guest posts on dental/clinic-ops blogs). Consistent NAP (name/address/phone) everywhere.

\- \*\*Trust signals on-site:\*\* legal entity + company number + UK address in footer, a \*\*Security \& data\*\* page (you have the substance — RLS, DPA, GDPR posture), "Payments secured by Stripe," visible privacy/DPA links, a real support email and phone.

\- \*\*Organization schema\*\* sitewide (logo, sameAs to LinkedIn/socials, foundingDate, founder) so Google builds a knowledge entity for LeadClaw.



\---



\## 7. LOCAL SEO STRATEGY (UK)



\- \*\*City pages\*\* (conversion-focused, distinct from the programmatic "best of"): `/ai-receptionist/\[city]` — "AI receptionist for \[Birmingham] businesses." Target your top 8–12 UK cities (London, Birmingham, Manchester, Leeds, Glasgow, Cardiff, Bristol, Edinburgh, Liverpool, Sheffield). Unique local intro + the standard trial CTA. These target \*your buyers\* searching locally (unlike the programmatic patient-facing pages).

\- \*\*Regional pages:\*\* lighter — "AI receptionist in the Midlands / South Wales / Greater London" as hubs linking to their city pages.

\- \*\*Google Business Profile:\*\* create/verify a GBP for LeadClaw (category: Software company). Even a SaaS benefits — reviews, posts, and a verified entity. Keep NAP consistent with the footer.

\- \*\*Local backlinks:\*\* UK small-business directories, local chambers of commerce, UK startup/SaaS lists, dental/clinic-supplier directories, local business press. Sponsor/contribute to a UK clinic-ops newsletter for a link.

\- \*\*Citations:\*\* consistent NAP across Crunchbase, UK company directories, G2/Capterra (also review platforms — double win), Clutch, and niche industry directories.

\- \*\*Reviews:\*\* drive happy pilot customers to leave Google + G2/Capterra reviews — these feed both local SEO and the comparison-page trust layer.



\---



\## 8. CONTENT CALENDAR — FIRST 30 ARTICLES



Hub: `/resources/\[slug]` (create this route — it doesn't exist). \*\*Publishing logic:\*\* alternate BOFU (converts now) and TOFU (builds authority); front-load articles that internally link to the vertical/comparison money pages. Difficulty L/M/H. Conv value H/M/L.



| Order | Article (target keyword) | Intent | Diff | Conv |

|---|---|---|---|---|

|1|How much does an AI receptionist cost in the UK? (ai receptionist cost uk)|Commercial|L|H|

|2|AI receptionist vs answering service: which is cheaper? |Commercial|L|H|

|3|How to stop losing customers to missed calls (missed calls small business)|Problem|L|H|

|4|Best AI receptionists for UK small businesses 2026 (roundup)|Commercial|M|H|

|5|How dentists can fill empty appointment slots with AI|Vertical/problem|L|H|

|6|AI receptionist for dental practices: a practical guide|Vertical|L|H|

|7|How to reduce no-shows at your clinic (no show reduction)|Problem|L|H|

|8|What is an AI receptionist and how does it work?|Informational|L|M|

|9|Missed call text-back: how it works and why it matters|Solution|L|H|

|10|AI receptionist for aesthetic clinics: capturing consult enquiries|Vertical|L|H|

|11|7 ways physios lose patients before the first appointment|Vertical/problem|L|H|

|12|How estate agents can capture more viewing requests automatically|Vertical|L|M|

|13|Is an AI receptionist GDPR-compliant? (UK)|Trust/informational|M|H|

|14|Human receptionist vs AI receptionist: a cost \& cover comparison|Commercial|M|H|

|15|How to add a lead-capture widget to any website|Solution/how-to|L|M|

|16|After-hours enquiries: how much revenue are you missing?|Problem|L|M|

|17|Rosie vs Goodcall vs LeadClaw: UK comparison|Commercial|M|H|

|18|How AI appointment booking works for clinics|Solution|L|H|

|19|The true cost of a missed call for a dental practice|Vertical/problem|L|H|

|20|Chiropractor marketing: turning enquiries into bookings|Vertical|L|M|

|21|Do AI receptionists work with my existing phone/website?|Objection|L|H|

|22|How to choose an AI receptionist (buyer's checklist)|Commercial|M|H|

|23|Lead response time: why speed wins more customers|Informational|L|M|

|24|Automating follow-ups for service businesses (playbook)|Solution|L|M|

|25|AI receptionist for small UK businesses on a budget|Vertical|L|H|

|26|Case study: how \[clinic] recovered N missed calls in 30 days|Proof|L|H|

|27|GDPR \& call recording in the UK: what businesses must know|Trust/YMYL|M|M|

|28|Treatwell/Dentally/Cliniko + AI receptionist: a connected front desk|Integration/vertical|M|M|

|29|Best practices for clinic reception in 2026|Informational|L|L|

|30|How LeadClaw works: a behind-the-scenes look (founder)|Brand/EEAT|L|M|



Articles 1,2,4,17,22 are the workhorses — high-intent, link straight to pricing/comparison/vertical pages. Article 13 \& 27 build YMYL trust for the clinic audience.



\---



\## 9. 90-DAY ACTION PLAN



\### Days 1–7 — fix foundations (10 quick wins, ranked by ROI)

1\. Change canonical term to "AI receptionist" in titles/H1s/schema sitewide (highest ROI — unblocks everything).

2\. Fix `SeoLandingPage` `serviceType` → "AI receptionist service"; replace panther OG image.

3\. Migrate + 301 the two "ai-agent" vertical pages to "ai-receptionist" slugs.

4\. Add the \*\*Solutions\*\* + \*\*Compare\*\* menus and the \*\*By industry\*\* footer column (internal links).

5\. Consolidate the 3 hard-coded sitemap SEO URLs into `seoPages\[]`.

6\. Add Organization + WebSite schema + founder/author identity sitewide.

7\. Build the `/ai-receptionist-uk` hub page (#1).

8\. Add real trust to footer: legal entity, company no., address, Stripe mark.

9\. Submit updated sitemap in Search Console; request indexing of the hub.

10\. Set GA4 goals/events for `free-trial` start and `demo` request (tag exists; define conversions).



\### Days 8–30 — money pages (10 wins)

11\. Ship vertical pages #2–6 (dentists, aesthetic, physio, chiro, estate agents).

12\. Ship problem pages #8,9,10 (missed call / lead capture).

13\. Ship comparison pages: vs Rosie, vs Goodcall (easiest wins).

14\. Create `/resources` hub + publish articles 1–6.

15\. Add testimonials section (pilot quotes) to homepage + vertical pages.

16\. Publish the founder/about page (EEAT anchor).

17\. Create + verify Google Business Profile; start citation consistency (NAP).

18\. Add FAQ sections (FAQPage schema) to the 5 vertical pages.

19\. Internal-link blog posts → vertical/comparison pages with keyword anchors.

20\. Get the first 3–5 G2/Capterra/Google reviews from pilots.



\### Days 31–90 — scale + authority (10 wins)

21\. Ship remaining landing pages #11–20 and comparisons vs Synthflow, vs Podium.

22\. Publish articles 7–20 (≈2/week).

23\. Build 6–10 UK city pages (`/ai-receptionist/\[city]`) targeting buyers.

24\. Publish 1–2 real case studies with numbers.

25\. Launch \*\*Phase 1\*\* programmatic "best \[vertical] in \[city]" (10–20 gated, editorial pages) + use as outreach hook.

26\. Earn 5–10 quality UK backlinks (directories, guest posts, local press).

27\. Build `/compare` and per-hub interlinking; fix any orphan pages.

28\. Add a \*\*Security \& data\*\* page for clinic buyers.

29\. Monitor Search Console: prune/expand based on "Crawled–not indexed" and CTR; iterate titles.

30\. Review demo/trial conversions by landing page in GA4; double down on top performers.



\---



\## 10. HIGHEST-ROI OPPORTUNITIES (do these even if you do nothing else)



1\. \*\*Rename the category to "AI receptionist" everywhere.\*\* You're optimising for the wrong, lower-intent term. One change, sitewide compounding gain.

2\. \*\*Vertical BOFU pages (dentists/aesthetic/physio/chiro/estate agents).\*\* Lowest competition, highest intent, best conversion — and they double as cold-outreach landing pages.

3\. \*\*Comparison pages vs Rosie \& Goodcall.\*\* Bottom-funnel, low difficulty, buyers comparing = ready to act.

4\. \*\*EEAT layer (founder page + testimonials + entity in footer).\*\* Cheap, unlocks trust for clinic buyers and YMYL-adjacent ranking.

5\. \*\*`/ai-receptionist-uk` hub + internal linking.\*\* Concentrates authority and gives every spoke a path to rank.



Everything else (programmatic city pages, broad content calendar, regional SEO) is real but \*\*secondary\*\* — it pays off over 3–12 months and should never come before the five items above. And the programmatic "best of" set is the one tactic that can actively hurt you if done thin: gate it hard or skip it.



\---



\### Sources (external facts used)

Competitor pricing/positioning verified June 2026: \[Rosie vs Goodcall — ServiceAgent](https://serviceagent.ai/blogs/rosie-ai-vs-goodcall/), \[AI Receptionist Pricing Guide — AgentZap](https://agentzap.ai/blog/ai-receptionist-pricing-complete-cost-guide-2025), \[GoHighLevel AI pricing — NetPartners](https://netpartners.marketing/gohighlevel-ai-pricing/). Internal: `leadclaw-uk/src/lib/seo-pages.ts`, `app/seo/\[slug]/page.tsx`, `components/seo/seo-landing-page.tsx`, `app/sitemap.ts`, `app/robots.ts`, existing `/seo/\*` pages.

