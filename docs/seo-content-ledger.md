# LeadClaw SEO Content Ledger

> Single source of truth for **what exists**, **what's planned**, and **what to publish next**.
> Additive companion to the SEO Content Engine (`src/lib/seo/content-engine.ts`).
> Purpose: prevent duplicate content, maintain history, and keep publishing focused on
> commercial relevance and topical authority — **not** mass programmatic pages.

Last audited: 2026-06-24.

---

## How this ledger works

- **Existing content** is inventoried below from the three live page registries plus
  standalone routes. The engine builds the same inventory at runtime
  (`getExistingInventory()`), so duplicate detection is grounded in real published slugs.
- **Backlog / opportunities** are scored (Commercial + SEO + Product Fit, each 0–10;
  Total 0–30), clustered, and ranked by the engine. Workflow status
  (`planned` / `in_progress` / `published`) is tracked in the Command Centre → **SEO Content Queue**
  and persisted in the additive `seo_content_status` table.
- **Columns:** title · url · keyword · category (cluster) · industry · funnel_stage · status · publish_date · internal_links.

---

## Part 1 — Content audit (existing inventory)

### Summary

| Source | Pages | Funnel | Notes |
| --- | --- | --- | --- |
| `ai-receptionist-pages.ts` (`/ai-receptionist-for-*-uk`) | 35 | BOFU | Deep per-industry coverage (trades, clinics, professional services). |
| `seo-pages.ts` (`/seo/[slug]`) | 10 | BOFU | Clinic + dental landing pages. |
| `seo-article-pages.ts` | 4 | MOFU/TOFU | The only true informational/cluster articles. |
| Standalone `/seo/*` + hubs | 3 | mixed | `missed-call-recovery-uk`, `best-ai-receptionist-uk`, `missed-call-statistics-uk`. |
| **Total inventoried** | **52** | | |

### Existing informational / cluster pages (the thin layer)

| Title | URL | Keyword | Cluster | Funnel | Status |
| --- | --- | --- | --- | --- | --- |
| AI Receptionist vs Answering Service | /ai-receptionist-vs-answering-service | ai receptionist vs answering service | ai-receptionists | MOFU | published |
| AI Receptionist vs Virtual Receptionist | /ai-receptionist-vs-virtual-receptionist | ai receptionist vs virtual receptionist | ai-receptionists | MOFU | published |
| How Much Does an Answering Service Cost (UK) | /how-much-does-an-answering-service-cost-uk | answering service cost uk | ai-receptionists | MOFU | published |
| Missed Call Statistics UK | /missed-call-statistics-uk | missed call statistics uk | missed-calls | TOFU | published |
| Missed Call Recovery UK (landing) | /seo/missed-call-recovery-uk | missed call recovery uk | missed-calls | BOFU | published |
| AI Agent for Dental Clinics UK | /seo/ai-agent-for-dental-clinics-uk | ai agent dental clinics | dental | BOFU | published |
| AI Agent for Aesthetic Clinics UK | /seo/ai-agent-for-aesthetic-clinics-uk | ai agent aesthetic clinics | aesthetic-clinics | BOFU | published |
| Dental Missed Call Recovery UK | /seo/dental-missed-call-recovery-uk | dental missed call recovery | dental | BOFU | published |
| Best AI Receptionist UK | /best-ai-receptionist-uk | best ai receptionist uk | ai-receptionists | BOFU | published |

> The 35 `ai-receptionist-for-{industry}-uk` pages and the remaining `/seo/[slug]` clinic
> pages are BOFU industry landing pages — see the registries for the full list. They are
> intentionally **not** re-listed individually here; the engine treats their slugs as
> "existing" for duplicate detection.

### Findings

- **Duplicates:** none. The backlog was curated against the live slug set; the engine's
  `findDuplicateSlugs()` returns `[]` (asserted in tests).
- **Strength:** excellent bottom-funnel, per-industry coverage (35 BOFU pages).
- **Gaps (the opportunity):**
  - **Missed-call cluster is thin** — only a statistics article + one landing page; no
    recovery-for-{trade} or ROI/cost-of-missed-calls content.
  - **AI-receptionist cluster** has comparisons but lacks **cost**, **ROI**, **alternatives**,
    and "is it worth it" articles that capture high-intent commercial search.
  - **Dental / Aesthetic** have BOFU landers but no enquiry-conversion / response-time /
    missed-enquiry supporting content.
  - **Trades** have BOFU landers but no missed-call-recovery or lead-conversion articles to
    feed the missed-call-recovery pilot.
  - **Lead conversion** (speed-to-lead, response-time) — no authority pillar yet.

---

## Part 2 — Scoring model

Each opportunity scores three axes 0–10; **Total = sum (0–30)**.

| Axis | Question | Weight |
| --- | --- | --- |
| **Commercial** | Buyer intent / revenue proximity — does the searcher want to buy? | 0–10 |
| **SEO** | Search demand vs ranking feasibility — winnable traffic? | 0–10 |
| **Product Fit** | Alignment with LeadClaw's missed-call / AI-receptionist product | 0–10 |

Quality gate: opportunities below **Total 18** are excluded by design (anti-thin-content).
Worked example (from the brief): *Missed Call Recovery for Plumbers* — Commercial 10, SEO 8,
Product Fit 10 → **Total 28**.

Ranking: Total desc → Commercial → Product Fit → cluster priority → title.

---

## Part 3 — Topic clusters

Priority order (commercial): **1 Missed Calls · 2 AI Receptionists · 3 Dental · 4 Aesthetic Clinics · 5 Trades · 6 Lead Conversion (cross-cutting authority)**.

Each cluster has pillar page(s) — reusing existing hubs where they exist — plus supporting
articles and an internal-linking rule (see `getClusters()` in the engine). Examples:

- **Missed Calls** → pillar `/seo/missed-call-recovery-uk`; supporting: recovery-for-plumbers/
  electricians/roofers/dentists/aesthetics, text-back guide, ROI, cost-of-missed-calls,
  after-hours, lost-leads. Link every supporting piece to the pillar + the relevant industry page.
- **AI Receptionists** → pillars `/ai-receptionist-uk` + `/best-ai-receptionist-uk`; supporting:
  cost, ROI, alternatives, vs-hiring, pricing-explained, how-it-works. Route to `/pricing` + `/compare`.
- **Dental** → pillar `/seo/ai-agent-for-dental-clinics-uk`; supporting: enquiry-conversion,
  missed-calls-at-practices, response-time, new-patient acquisition.
- **Aesthetic Clinics** → pillar `/seo/ai-agent-for-aesthetic-clinics-uk`; supporting:
  lead-conversion, response-time, Botox/filler enquiries, Instagram-DM conversion.
- **Trades** → pillar (new) "How Tradespeople Can Stop Losing Jobs to Missed Calls" +
  `/seo/missed-call-recovery-uk`; supporting per-trade conversion/management pieces → link to
  each `/ai-receptionist-for-{trade}-uk` and the pilot (`/apply`).
- **Lead Conversion** → authority pillar "Speed to Lead"; links every cluster pillar back to it.

---

## Part 4 — Backlog (ranked)

> Full ranked list is generated by the engine and shown in the Command Centre. The top of the
> backlog at audit time (all status `backlog` until moved in the queue):

| Rank | Title | URL (proposed) | Keyword | Cluster | Industry | Funnel | C/S/P | Total | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Missed Call Recovery Software for UK Businesses | /missed-call-recovery-software-uk | missed call recovery software uk | Missed Calls | All | BOFU | 10/8/10 | 28 | backlog |
| 2 | Missed Call Recovery for Plumbers | /missed-call-recovery-for-plumbers-uk | missed call recovery for plumbers | Missed Calls | Plumbers | BOFU | 10/8/10 | 28 | backlog |
| 3 | Missed Call Recovery for Dental Practices | /missed-call-recovery-for-dentists-uk | missed call recovery for dentists | Missed Calls | Dental | BOFU | 10/8/10 | 28 | backlog |
| 4 | Missed Call Recovery for Electricians | /missed-call-recovery-for-electricians-uk | missed call recovery for electricians | Missed Calls | Electricians | BOFU | 10/7/10 | 27 | backlog |
| 5 | Missed Call Recovery for Roofers | /missed-call-recovery-for-roofers-uk | missed call recovery for roofers | Missed Calls | Roofers | BOFU | 10/7/10 | 27 | backlog |
| 6 | AI Receptionist Cost in the UK | /ai-receptionist-cost-uk | ai receptionist cost uk | AI Receptionists | All | MOFU | 9/9/9 | 27 | backlog |
| 7 | Missed Call Text-Back: A Practical Guide | /missed-call-text-back-guide-uk | missed call text back | Missed Calls | All | MOFU | 9/8/10 | 27 | backlog |
| 8 | How Tradespeople Can Stop Losing Jobs to Missed Calls | /how-tradespeople-stop-losing-jobs-to-missed-calls | tradespeople missed calls | Trades | Trades | MOFU | 9/7/10 | 26 | backlog |
| 9 | Missed Calls at Dental Practices | /missed-calls-at-dental-practices | missed calls dental practice | Dental | Dental | MOFU | 9/7/10 | 26 | backlog |
| 10 | Missed Call Recovery for Aesthetic Clinics | /missed-call-recovery-for-aesthetic-clinics-uk | missed call recovery aesthetic clinic | Missed Calls | Aesthetic clinics | BOFU | 9/7/10 | 26 | backlog |
| … | _(42 more — see Command Centre → SEO Content Queue)_ | | | | | | | | |

The full 52-opportunity backlog (≥50 required) lives in `CONTENT_BACKLOG`. The complete,
always-current ranking is rendered in the admin Command Centre and returned by
`GET /api/admin/seo-content`.

---

## Part 5 — Next article recommendation

The engine recommends the single best next article (highest-ranked opportunity not yet
`in_progress`/`published`). At audit time: **"Missed Call Recovery Software for UK Businesses"**
(Total 28) — the commercial pillar that anchors the highest-priority cluster.

`recommendNextArticle()` returns: title, primary keyword, target audience, why it matters,
internal links to add, and recommended CTA.

---

## Workflow

1. Review the SEO Content Queue in the Command Centre.
2. Move the recommended next article to **Planned** → **In Progress**.
3. Publish it (ideally via the existing `seoArticlePages` registry so it joins the sitemap).
4. Mark **Published** and add its URL; the engine then recommends the next one.
5. Append published pieces to the existing-content audit above to keep history.
