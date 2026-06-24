// LeadClaw SEO Content Engine — core intelligence.
//
// Pure, side-effect-free logic (no I/O) that answers ONE question:
//   "What should LeadClaw publish next?"
//
// It does NOT generate pages, write content, or create programmatic spam. It
// scores and ranks a hand-curated backlog of high-value, commercially relevant
// opportunities, organises them into topic clusters, audits what already exists
// (by importing the real published-page registries so duplicates are detected
// against live slugs), and recommends the single best next article.
//
// Consumed read-only by the admin API route; nothing here touches Lead Finder,
// the scraper, outreach, billing, or auth.

import { aiReceptionistPages } from "@/lib/ai-receptionist-pages";
import { seoArticlePages } from "@/lib/seo-article-pages";
import { seoPages } from "@/lib/seo-pages";

// ---- Taxonomy --------------------------------------------------------------

export type FunnelStage = "TOFU" | "MOFU" | "BOFU";

export type ClusterKey =
  | "missed-calls"
  | "ai-receptionists"
  | "dental"
  | "aesthetic-clinics"
  | "trades"
  | "lead-conversion";

export type ContentStatus = "backlog" | "planned" | "in_progress" | "published";

export const CONTENT_STATUSES: ContentStatus[] = [
  "backlog",
  "planned",
  "in_progress",
  "published",
];

export function isContentStatus(v: unknown): v is ContentStatus {
  return typeof v === "string" && (CONTENT_STATUSES as string[]).includes(v);
}

// Commercial-priority order from the brief (1 = highest).
export const CLUSTER_PRIORITY: Record<ClusterKey, number> = {
  "missed-calls": 1,
  "ai-receptionists": 2,
  dental: 3,
  "aesthetic-clinics": 4,
  trades: 5,
  "lead-conversion": 6,
};

export const CLUSTER_LABELS: Record<ClusterKey, string> = {
  "missed-calls": "Missed Calls",
  "ai-receptionists": "AI Receptionists",
  dental: "Dental",
  "aesthetic-clinics": "Aesthetic Clinics",
  trades: "Trades",
  "lead-conversion": "Lead Conversion",
};

// ---- Scoring model ---------------------------------------------------------
// Three 0–10 axes; Total = their sum (0–30). Mirrors the brief's example:
//   "Missed Call Recovery for Plumbers — Commercial 10, SEO 8, Product Fit 10 = 28".
//
//   commercial  — buyer intent / revenue proximity (does the searcher want to buy?)
//   seo         — search demand vs ranking feasibility (winnable traffic)
//   productFit  — alignment with LeadClaw's missed-call / AI-receptionist product
//
// Quality gate: we only list opportunities that clear MIN_TOTAL so the backlog
// never fills with thin, low-relevance ideas (anti-spam by construction).
export const MAX_AXIS = 10;
export const MAX_TOTAL = 30;
export const MIN_TOTAL = 18;

export type Scores = {
  commercial: number;
  seo: number;
  productFit: number;
};

export function totalScore(s: Scores): number {
  return s.commercial + s.seo + s.productFit;
}

// ---- Opportunity shape -----------------------------------------------------

export type ContentOpportunity = {
  slug: string; // proposed URL slug (path-safe), also the status key
  title: string;
  primaryKeyword: string;
  cluster: ClusterKey;
  industry: string; // "All", "Dental", "Plumbers", ...
  funnelStage: FunnelStage;
  audience: string;
  pillar: boolean; // a hub page vs a supporting article
  scores: Scores;
  whyItMatters: string;
  internalLinks: string[]; // REAL existing URLs to link from/to
  recommendedCta: string;
};

// Convenience constructor keeps the data table compact and consistent.
function op(
  o: Omit<ContentOpportunity, "scores"> & {
    commercial: number;
    seo: number;
    productFit: number;
  },
): ContentOpportunity {
  const { commercial, seo, productFit, ...rest } = o;
  return { ...rest, scores: { commercial, seo, productFit } };
}

// Common CTAs / link targets (all real, published routes).
const CTA_TRIAL = "Start a free trial";
const CTA_DEMO = "Book a demo";
const CTA_PILOT = "Apply for the missed-call recovery pilot";

// ---- The curated backlog (50+ opportunities) -------------------------------
// Ordered loosely by cluster; ranking is computed, not authored. Every entry is
// a genuine, commercially relevant topic that supports an existing BOFU page or
// fills a real cluster gap found in the audit.

export const CONTENT_BACKLOG: ContentOpportunity[] = [
  // ===== Missed Calls (priority 1) =========================================
  op({
    slug: "missed-call-recovery-for-plumbers-uk",
    title: "Missed Call Recovery for Plumbers",
    primaryKeyword: "missed call recovery for plumbers",
    cluster: "missed-calls",
    industry: "Plumbers",
    funnelStage: "BOFU",
    audience: "Plumbing firms losing emergency jobs while on-site",
    pillar: false,
    commercial: 10,
    seo: 8,
    productFit: 10,
    whyItMatters:
      "Plumbers lose high-value emergency jobs to missed calls; perfect product fit and strong commercial intent.",
    internalLinks: ["/ai-receptionist-for-plumbers-uk", "/seo/missed-call-recovery-uk", "/free-trial"],
    recommendedCta: CTA_PILOT,
  }),
  op({
    slug: "missed-call-recovery-for-electricians-uk",
    title: "Missed Call Recovery for Electricians",
    primaryKeyword: "missed call recovery for electricians",
    cluster: "missed-calls",
    industry: "Electricians",
    funnelStage: "BOFU",
    audience: "Electrical contractors who miss calls during jobs",
    pillar: false,
    commercial: 10,
    seo: 7,
    productFit: 10,
    whyItMatters:
      "Mirrors the plumber win for a second core pilot trade with the same emergency-call dynamic.",
    internalLinks: ["/ai-receptionist-for-electricians-uk", "/seo/missed-call-recovery-uk", "/free-trial"],
    recommendedCta: CTA_PILOT,
  }),
  op({
    slug: "missed-call-recovery-for-roofers-uk",
    title: "Missed Call Recovery for Roofers",
    primaryKeyword: "missed call recovery for roofers",
    cluster: "missed-calls",
    industry: "Roofers",
    funnelStage: "BOFU",
    audience: "Roofing companies quoting storm-damage and repair work",
    pillar: false,
    commercial: 10,
    seo: 7,
    productFit: 10,
    whyItMatters:
      "Completes the three launch pilot trades; seasonal demand spikes make recovery especially valuable.",
    internalLinks: ["/ai-receptionist-for-roofers-uk", "/seo/missed-call-recovery-uk", "/free-trial"],
    recommendedCta: CTA_PILOT,
  }),
  op({
    slug: "missed-call-recovery-for-dentists-uk",
    title: "Missed Call Recovery for Dental Practices",
    primaryKeyword: "missed call recovery for dentists",
    cluster: "missed-calls",
    industry: "Dental",
    funnelStage: "BOFU",
    audience: "Dental practice managers losing new-patient calls",
    pillar: false,
    commercial: 10,
    seo: 8,
    productFit: 10,
    whyItMatters:
      "New-patient calls are high lifetime-value; links the missed-call cluster to the dental cluster.",
    internalLinks: ["/seo/dental-missed-call-recovery-uk", "/ai-receptionist-for-dentists-uk", "/demo"],
    recommendedCta: CTA_DEMO,
  }),
  op({
    slug: "missed-call-recovery-for-aesthetic-clinics-uk",
    title: "Missed Call Recovery for Aesthetic Clinics",
    primaryKeyword: "missed call recovery aesthetic clinic",
    cluster: "missed-calls",
    industry: "Aesthetic clinics",
    funnelStage: "BOFU",
    audience: "Aesthetic and cosmetic clinics fielding consultation enquiries",
    pillar: false,
    commercial: 9,
    seo: 7,
    productFit: 10,
    whyItMatters:
      "High-ticket consultations make each recovered enquiry worth a lot; bridges to the aesthetic cluster.",
    internalLinks: ["/seo/ai-agent-for-aesthetic-clinics-uk", "/ai-receptionist-for-aesthetic-clinics-uk", "/demo"],
    recommendedCta: CTA_DEMO,
  }),
  op({
    slug: "missed-call-text-back-guide-uk",
    title: "Missed Call Text-Back: A Practical Guide for UK Businesses",
    primaryKeyword: "missed call text back",
    cluster: "missed-calls",
    industry: "All",
    funnelStage: "MOFU",
    audience: "Owners evaluating automated text-back to recover calls",
    pillar: false,
    commercial: 9,
    seo: 8,
    productFit: 10,
    whyItMatters:
      "Directly describes LeadClaw's missed-call recovery mechanism; high-intent feature search.",
    internalLinks: ["/seo/missed-call-recovery-uk", "/missed-call-statistics-uk", "/free-trial"],
    recommendedCta: CTA_TRIAL,
  }),
  op({
    slug: "missed-call-recovery-roi-uk",
    title: "The ROI of Missed Call Recovery",
    primaryKeyword: "missed call recovery roi",
    cluster: "missed-calls",
    industry: "All",
    funnelStage: "MOFU",
    audience: "Owners quantifying the cost of unanswered calls",
    pillar: false,
    commercial: 9,
    seo: 7,
    productFit: 10,
    whyItMatters:
      "ROI framing converts sceptical owners; pairs with the missed-call statistics article already live.",
    internalLinks: ["/missed-call-statistics-uk", "/pricing", "/seo/missed-call-recovery-uk"],
    recommendedCta: CTA_TRIAL,
  }),
  op({
    slug: "how-much-do-missed-calls-cost-uk-businesses",
    title: "How Much Do Missed Calls Cost UK Businesses?",
    primaryKeyword: "cost of missed calls",
    cluster: "missed-calls",
    industry: "All",
    funnelStage: "TOFU",
    audience: "Owners researching the impact of missed calls",
    pillar: false,
    commercial: 8,
    seo: 9,
    productFit: 9,
    whyItMatters:
      "Top-of-funnel demand magnet that feeds the whole cluster; strong search volume, low difficulty.",
    internalLinks: ["/missed-call-statistics-uk", "/seo/missed-call-recovery-uk"],
    recommendedCta: "Read the missed-call statistics guide",
  }),
  op({
    slug: "lost-leads-from-missed-calls",
    title: "Lost Leads From Missed Calls: How to Win Them Back",
    primaryKeyword: "lost leads missed calls",
    cluster: "missed-calls",
    industry: "All",
    funnelStage: "TOFU",
    audience: "Owners aware they are losing enquiries",
    pillar: false,
    commercial: 8,
    seo: 8,
    productFit: 9,
    whyItMatters:
      "Names the pain in the searcher's words and routes to recovery; supports the pillar.",
    internalLinks: ["/seo/missed-call-recovery-uk", "/ai-receptionist-uk"],
    recommendedCta: CTA_TRIAL,
  }),
  op({
    slug: "after-hours-enquiries-how-to-capture-them",
    title: "After-Hours Enquiries: How to Capture Them",
    primaryKeyword: "after hours enquiries",
    cluster: "missed-calls",
    industry: "All",
    funnelStage: "MOFU",
    audience: "Businesses receiving enquiries when closed",
    pillar: false,
    commercial: 8,
    seo: 7,
    productFit: 9,
    whyItMatters:
      "Out-of-hours capture is a core LeadClaw benefit and a distinct, winnable keyword.",
    internalLinks: ["/ai-receptionist-uk", "/seo/missed-call-recovery-uk"],
    recommendedCta: CTA_TRIAL,
  }),
  op({
    slug: "how-to-reduce-missed-calls-small-business",
    title: "How to Reduce Missed Calls in a Small Business",
    primaryKeyword: "how to reduce missed calls",
    cluster: "missed-calls",
    industry: "All",
    funnelStage: "TOFU",
    audience: "Small-business owners seeking practical fixes",
    pillar: false,
    commercial: 7,
    seo: 7,
    productFit: 8,
    whyItMatters:
      "Practical how-to captures problem-aware searchers and introduces recovery as the best fix.",
    internalLinks: ["/seo/missed-call-recovery-uk", "/missed-call-statistics-uk"],
    recommendedCta: "See how recovery works",
  }),

  // ===== AI Receptionists (priority 2) =====================================
  op({
    slug: "ai-receptionist-cost-uk",
    title: "AI Receptionist Cost in the UK: What to Expect",
    primaryKeyword: "ai receptionist cost uk",
    cluster: "ai-receptionists",
    industry: "All",
    funnelStage: "MOFU",
    audience: "Buyers comparing AI receptionist pricing",
    pillar: true,
    commercial: 9,
    seo: 9,
    productFit: 9,
    whyItMatters:
      "High-intent pricing query; complements the existing answering-service cost article and pricing page.",
    internalLinks: ["/pricing", "/how-much-does-an-answering-service-cost-uk", "/ai-receptionist-uk"],
    recommendedCta: "Compare pricing",
  }),
  op({
    slug: "ai-receptionist-roi-uk",
    title: "AI Receptionist ROI: Is It Worth It?",
    primaryKeyword: "ai receptionist roi",
    cluster: "ai-receptionists",
    industry: "All",
    funnelStage: "MOFU",
    audience: "Owners justifying the spend",
    pillar: false,
    commercial: 9,
    seo: 7,
    productFit: 10,
    whyItMatters:
      "ROI angle de-risks the purchase decision and links straight to trial/pricing.",
    internalLinks: ["/pricing", "/ai-receptionist-cost-uk", "/free-trial"],
    recommendedCta: CTA_TRIAL,
  }),
  op({
    slug: "ai-receptionist-alternatives-uk",
    title: "AI Receptionist Alternatives Compared",
    primaryKeyword: "ai receptionist alternatives",
    cluster: "ai-receptionists",
    industry: "All",
    funnelStage: "BOFU",
    audience: "Buyers weighing options before purchase",
    pillar: false,
    commercial: 8,
    seo: 8,
    productFit: 8,
    whyItMatters:
      "Comparison intent captures buyers late in the journey; extends the existing /compare hub.",
    internalLinks: ["/compare", "/ai-receptionist-vs-answering-service", "/best-ai-receptionist-uk"],
    recommendedCta: "Compare AI receptionist options",
  }),
  op({
    slug: "ai-receptionist-vs-hiring-a-receptionist-uk",
    title: "AI Receptionist vs Hiring a Receptionist",
    primaryKeyword: "ai receptionist vs hiring",
    cluster: "ai-receptionists",
    industry: "All",
    funnelStage: "MOFU",
    audience: "Owners deciding between software and a hire",
    pillar: false,
    commercial: 8,
    seo: 8,
    productFit: 9,
    whyItMatters:
      "Frames LeadClaw against the costly status quo; strong cost-comparison narrative.",
    internalLinks: ["/ai-receptionist-vs-virtual-receptionist", "/pricing", "/ai-receptionist-uk"],
    recommendedCta: "Compare pricing",
  }),
  op({
    slug: "best-ai-receptionist-for-small-business-uk",
    title: "Best AI Receptionist for Small Businesses in the UK",
    primaryKeyword: "best ai receptionist small business",
    cluster: "ai-receptionists",
    industry: "All",
    funnelStage: "BOFU",
    audience: "Small businesses shortlisting tools",
    pillar: false,
    commercial: 9,
    seo: 8,
    productFit: 9,
    whyItMatters:
      "'Best for' modifier is bottom-funnel; reinforces the existing best-ai-receptionist hub for SMB intent.",
    internalLinks: ["/best-ai-receptionist-uk", "/pricing", "/free-trial"],
    recommendedCta: CTA_TRIAL,
  }),
  op({
    slug: "ai-receptionist-pricing-explained-uk",
    title: "AI Receptionist Pricing Explained",
    primaryKeyword: "ai receptionist pricing",
    cluster: "ai-receptionists",
    industry: "All",
    funnelStage: "MOFU",
    audience: "Buyers decoding pricing models",
    pillar: false,
    commercial: 9,
    seo: 8,
    productFit: 9,
    whyItMatters:
      "Transparent pricing explainer builds trust and routes to the pricing page.",
    internalLinks: ["/pricing", "/ai-receptionist-cost-uk"],
    recommendedCta: "See LeadClaw pricing",
  }),
  op({
    slug: "is-an-ai-receptionist-worth-it",
    title: "Is an AI Receptionist Worth It?",
    primaryKeyword: "is an ai receptionist worth it",
    cluster: "ai-receptionists",
    industry: "All",
    funnelStage: "TOFU",
    audience: "Owners early in research",
    pillar: false,
    commercial: 8,
    seo: 7,
    productFit: 9,
    whyItMatters:
      "Captures hesitant researchers and answers the objection directly with evidence.",
    internalLinks: ["/ai-receptionist-roi-uk", "/ai-receptionist-uk"],
    recommendedCta: CTA_DEMO,
  }),
  op({
    slug: "how-does-an-ai-receptionist-work",
    title: "How Does an AI Receptionist Work?",
    primaryKeyword: "how does an ai receptionist work",
    cluster: "ai-receptionists",
    industry: "All",
    funnelStage: "TOFU",
    audience: "Owners new to the category",
    pillar: false,
    commercial: 6,
    seo: 8,
    productFit: 8,
    whyItMatters:
      "Educational query with steady volume; seeds the category and links to how-it-works.",
    internalLinks: ["/how-it-works", "/ai-receptionist-uk"],
    recommendedCta: "See how it works",
  }),
  op({
    slug: "do-i-need-an-ai-receptionist",
    title: "Do I Need an AI Receptionist?",
    primaryKeyword: "do i need an ai receptionist",
    cluster: "ai-receptionists",
    industry: "All",
    funnelStage: "TOFU",
    audience: "Owners self-qualifying",
    pillar: false,
    commercial: 7,
    seo: 7,
    productFit: 9,
    whyItMatters:
      "Self-qualification content gently moves problem-aware readers toward a trial.",
    internalLinks: ["/ai-receptionist-uk", "/free-trial"],
    recommendedCta: CTA_TRIAL,
  }),
  op({
    slug: "ai-receptionist-benefits-uk",
    title: "The Benefits of an AI Receptionist for UK Businesses",
    primaryKeyword: "ai receptionist benefits",
    cluster: "ai-receptionists",
    industry: "All",
    funnelStage: "TOFU",
    audience: "Owners exploring the value",
    pillar: false,
    commercial: 7,
    seo: 7,
    productFit: 8,
    whyItMatters:
      "Benefit-led explainer broadens topical authority around the core category term.",
    internalLinks: ["/ai-receptionist-uk", "/how-it-works"],
    recommendedCta: CTA_DEMO,
  }),
  op({
    slug: "ai-receptionist-for-out-of-hours-uk",
    title: "Using an AI Receptionist for Out-of-Hours Cover",
    primaryKeyword: "ai receptionist out of hours",
    cluster: "ai-receptionists",
    industry: "All",
    funnelStage: "MOFU",
    audience: "Businesses needing evening/weekend cover",
    pillar: false,
    commercial: 8,
    seo: 7,
    productFit: 9,
    whyItMatters:
      "Connects the AI-receptionist and missed-call clusters around the out-of-hours use case.",
    internalLinks: ["/ai-receptionist-uk", "/after-hours-enquiries-how-to-capture-them"],
    recommendedCta: CTA_TRIAL,
  }),

  // ===== Dental (priority 3) ===============================================
  op({
    slug: "dental-enquiry-conversion-guide",
    title: "Dental Enquiry Conversion: A Practice Owner's Guide",
    primaryKeyword: "dental enquiry conversion",
    cluster: "dental",
    industry: "Dental",
    funnelStage: "MOFU",
    audience: "Dental practice owners and managers",
    pillar: true,
    commercial: 9,
    seo: 7,
    productFit: 9,
    whyItMatters:
      "Dental pillar tying enquiry handling to new-patient revenue; supports the two live dental pages.",
    internalLinks: ["/seo/ai-agent-for-dental-clinics-uk", "/seo/dental-lead-generation-software-uk", "/demo"],
    recommendedCta: CTA_DEMO,
  }),
  op({
    slug: "missed-calls-at-dental-practices",
    title: "Missed Calls at Dental Practices: The Hidden Cost",
    primaryKeyword: "missed calls dental practice",
    cluster: "dental",
    industry: "Dental",
    funnelStage: "MOFU",
    audience: "Practice managers worried about lost patients",
    pillar: false,
    commercial: 9,
    seo: 7,
    productFit: 10,
    whyItMatters:
      "Quantifies lost new-patient value; strongest product fit in the dental cluster.",
    internalLinks: ["/seo/dental-missed-call-recovery-uk", "/missed-call-recovery-for-dentists-uk"],
    recommendedCta: CTA_DEMO,
  }),
  op({
    slug: "dental-new-patient-enquiry-response-time",
    title: "Why New-Patient Enquiry Response Time Matters for Dentists",
    primaryKeyword: "dental enquiry response time",
    cluster: "dental",
    industry: "Dental",
    funnelStage: "MOFU",
    audience: "Practices competing for new patients",
    pillar: false,
    commercial: 8,
    seo: 6,
    productFit: 9,
    whyItMatters:
      "Speed-to-lead applied to dentistry; differentiates practices on responsiveness.",
    internalLinks: ["/seo/ai-agent-for-dental-clinics-uk", "/speed-to-lead-uk-guide"],
    recommendedCta: CTA_DEMO,
  }),
  op({
    slug: "how-dental-practices-capture-more-new-patients",
    title: "How Dental Practices Can Capture More New Patients",
    primaryKeyword: "dental new patient acquisition",
    cluster: "dental",
    industry: "Dental",
    funnelStage: "TOFU",
    audience: "Growth-focused practice owners",
    pillar: false,
    commercial: 8,
    seo: 7,
    productFit: 9,
    whyItMatters:
      "Growth-intent topic that broadens the dental cluster beyond missed calls.",
    internalLinks: ["/seo/dental-lead-generation-software-uk", "/seo/ai-agent-for-dental-clinics-uk"],
    recommendedCta: CTA_DEMO,
  }),
  op({
    slug: "dental-reception-management-uk",
    title: "Dental Reception Management: Handling Enquiries Without the Chaos",
    primaryKeyword: "dental reception management",
    cluster: "dental",
    industry: "Dental",
    funnelStage: "MOFU",
    audience: "Front-desk leads and office managers",
    pillar: false,
    commercial: 7,
    seo: 7,
    productFit: 8,
    whyItMatters:
      "Operational angle reaches the front-desk decision-maker who feels the pain daily.",
    internalLinks: ["/ai-receptionist-for-dentists-uk", "/seo/ai-agent-for-dental-clinics-uk"],
    recommendedCta: CTA_TRIAL,
  }),
  op({
    slug: "reducing-no-shows-dental-practice-uk",
    title: "Reducing No-Shows at Your Dental Practice",
    primaryKeyword: "reduce dental no shows",
    cluster: "dental",
    industry: "Dental",
    funnelStage: "TOFU",
    audience: "Practices losing revenue to no-shows",
    pillar: false,
    commercial: 7,
    seo: 7,
    productFit: 7,
    whyItMatters:
      "Adjacent pain with good volume; reminders/follow-up tie back to the product.",
    internalLinks: ["/ai-receptionist-for-dentists-uk", "/dental-enquiry-conversion-guide"],
    recommendedCta: CTA_DEMO,
  }),

  // ===== Aesthetic Clinics (priority 4) ====================================
  op({
    slug: "aesthetic-clinic-lead-conversion",
    title: "Aesthetic Clinic Lead Conversion: Turning Enquiries Into Consultations",
    primaryKeyword: "aesthetic clinic lead conversion",
    cluster: "aesthetic-clinics",
    industry: "Aesthetic clinics",
    funnelStage: "MOFU",
    audience: "Clinic owners and practice managers",
    pillar: true,
    commercial: 9,
    seo: 7,
    productFit: 9,
    whyItMatters:
      "Aesthetic pillar; high-ticket consultations make conversion gains very valuable.",
    internalLinks: ["/seo/ai-agent-for-aesthetic-clinics-uk", "/ai-receptionist-for-aesthetic-clinics-uk", "/demo"],
    recommendedCta: CTA_DEMO,
  }),
  op({
    slug: "enquiry-response-time-aesthetic-clinics",
    title: "Enquiry Response Time: Why Speed Wins Aesthetic Bookings",
    primaryKeyword: "aesthetic clinic enquiry response time",
    cluster: "aesthetic-clinics",
    industry: "Aesthetic clinics",
    funnelStage: "MOFU",
    audience: "Clinics competing on responsiveness",
    pillar: false,
    commercial: 8,
    seo: 7,
    productFit: 9,
    whyItMatters:
      "Speed-to-lead for aesthetics; buyers shop around, so first responder often wins.",
    internalLinks: ["/seo/ai-agent-for-aesthetic-clinics-uk", "/speed-to-lead-uk-guide"],
    recommendedCta: CTA_DEMO,
  }),
  op({
    slug: "handling-botox-and-filler-enquiries-uk",
    title: "Handling Botox and Filler Enquiries Without Losing Bookings",
    primaryKeyword: "botox enquiry handling",
    cluster: "aesthetic-clinics",
    industry: "Aesthetic clinics",
    funnelStage: "TOFU",
    audience: "Injectors and clinic front-desk teams",
    pillar: false,
    commercial: 8,
    seo: 6,
    productFit: 9,
    whyItMatters:
      "Treatment-specific intent reaches clinics by their highest-demand services.",
    internalLinks: ["/ai-receptionist-for-aesthetic-clinics-uk", "/aesthetic-clinic-lead-conversion"],
    recommendedCta: CTA_TRIAL,
  }),
  op({
    slug: "converting-instagram-dms-to-bookings-clinics",
    title: "Converting Instagram DMs Into Clinic Bookings",
    primaryKeyword: "convert instagram dms to bookings",
    cluster: "aesthetic-clinics",
    industry: "Aesthetic clinics",
    funnelStage: "TOFU",
    audience: "Social-led clinics losing DM enquiries",
    pillar: false,
    commercial: 8,
    seo: 6,
    productFit: 8,
    whyItMatters:
      "Aesthetic clinics live on Instagram; captures a channel-specific pain LeadClaw can solve.",
    internalLinks: ["/seo/ai-agent-for-aesthetic-clinics-uk", "/ai-receptionist-for-aesthetic-clinics-uk"],
    recommendedCta: CTA_DEMO,
  }),
  op({
    slug: "aesthetic-clinic-missed-enquiries",
    title: "The Cost of Missed Enquiries at Aesthetic Clinics",
    primaryKeyword: "aesthetic clinic missed enquiries",
    cluster: "aesthetic-clinics",
    industry: "Aesthetic clinics",
    funnelStage: "MOFU",
    audience: "Owners measuring lost consultations",
    pillar: false,
    commercial: 8,
    seo: 6,
    productFit: 9,
    whyItMatters:
      "Links the aesthetic and missed-call clusters with a revenue-loss framing.",
    internalLinks: ["/missed-call-recovery-for-aesthetic-clinics-uk", "/seo/ai-agent-for-aesthetic-clinics-uk"],
    recommendedCta: CTA_DEMO,
  }),

  // ===== Trades (priority 5) ===============================================
  op({
    slug: "how-tradespeople-stop-losing-jobs-to-missed-calls",
    title: "How Tradespeople Can Stop Losing Jobs to Missed Calls",
    primaryKeyword: "tradespeople missed calls",
    cluster: "trades",
    industry: "Trades",
    funnelStage: "MOFU",
    audience: "Plumbers, electricians, roofers, builders on the tools",
    pillar: true,
    commercial: 9,
    seo: 7,
    productFit: 10,
    whyItMatters:
      "Trades pillar; on-the-tools owners miss calls constantly — textbook product fit and pilot funnel.",
    internalLinks: ["/seo/missed-call-recovery-uk", "/ai-receptionist-for-plumbers-uk", "/apply"],
    recommendedCta: CTA_PILOT,
  }),
  op({
    slug: "why-tradespeople-miss-calls-and-how-to-fix-it",
    title: "Why Tradespeople Miss Calls (and How to Fix It)",
    primaryKeyword: "why tradespeople miss calls",
    cluster: "trades",
    industry: "Trades",
    funnelStage: "TOFU",
    audience: "Sole traders and small crews",
    pillar: false,
    commercial: 8,
    seo: 7,
    productFit: 9,
    whyItMatters:
      "Problem-aware TOFU that empathises first, then introduces recovery as the fix.",
    internalLinks: ["/how-tradespeople-stop-losing-jobs-to-missed-calls", "/seo/missed-call-recovery-uk"],
    recommendedCta: CTA_TRIAL,
  }),
  op({
    slug: "quote-request-follow-up-for-trades",
    title: "Quote Request Follow-Up for Trades: Win More of the Work You Quote",
    primaryKeyword: "trade quote follow up",
    cluster: "trades",
    industry: "Trades",
    funnelStage: "MOFU",
    audience: "Trades sending quotes and chasing replies",
    pillar: false,
    commercial: 8,
    seo: 6,
    productFit: 9,
    whyItMatters:
      "Follow-up is where trades leak revenue; concrete, product-aligned advice.",
    internalLinks: ["/ai-receptionist-for-builders-uk", "/follow-up-strategy-for-service-businesses"],
    recommendedCta: CTA_TRIAL,
  }),
  op({
    slug: "plumber-lead-conversion-uk",
    title: "Plumber Lead Conversion: Turning Calls Into Booked Jobs",
    primaryKeyword: "plumber lead conversion",
    cluster: "trades",
    industry: "Plumbers",
    funnelStage: "MOFU",
    audience: "Plumbing business owners",
    pillar: false,
    commercial: 8,
    seo: 7,
    productFit: 9,
    whyItMatters:
      "Deepens the strongest pilot trade with a conversion-focused supporting article.",
    internalLinks: ["/ai-receptionist-for-plumbers-uk", "/missed-call-recovery-for-plumbers-uk"],
    recommendedCta: CTA_PILOT,
  }),
  op({
    slug: "electrician-enquiry-management-uk",
    title: "Electrician Enquiry Management: Never Miss a Job Again",
    primaryKeyword: "electrician enquiry management",
    cluster: "trades",
    industry: "Electricians",
    funnelStage: "MOFU",
    audience: "Electrical contractors",
    pillar: false,
    commercial: 8,
    seo: 6,
    productFit: 9,
    whyItMatters:
      "Supports the electrician pilot page with practical enquiry-handling guidance.",
    internalLinks: ["/ai-receptionist-for-electricians-uk", "/missed-call-recovery-for-electricians-uk"],
    recommendedCta: CTA_PILOT,
  }),
  op({
    slug: "roofer-lead-generation-uk",
    title: "Roofer Lead Generation: Capture More Repair and Replacement Work",
    primaryKeyword: "roofer lead generation",
    cluster: "trades",
    industry: "Roofers",
    funnelStage: "MOFU",
    audience: "Roofing company owners",
    pillar: false,
    commercial: 8,
    seo: 6,
    productFit: 8,
    whyItMatters:
      "Rounds out the trades pilot trio; seasonal demand makes capture timely.",
    internalLinks: ["/ai-receptionist-for-roofers-uk", "/missed-call-recovery-for-roofers-uk"],
    recommendedCta: CTA_PILOT,
  }),
  op({
    slug: "builder-enquiry-response-uk",
    title: "Builder Enquiry Response: Why Speed Wins Bigger Projects",
    primaryKeyword: "builder enquiry response",
    cluster: "trades",
    industry: "Builders",
    funnelStage: "MOFU",
    audience: "Builders and construction firms",
    pillar: false,
    commercial: 7,
    seo: 6,
    productFit: 8,
    whyItMatters:
      "Larger project values reward fast response; extends trades beyond the three pilots.",
    internalLinks: ["/ai-receptionist-for-builders-uk", "/speed-to-lead-uk-guide"],
    recommendedCta: CTA_TRIAL,
  }),
  op({
    slug: "trades-out-of-hours-enquiry-capture",
    title: "Out-of-Hours Enquiry Capture for Trades",
    primaryKeyword: "trades out of hours enquiries",
    cluster: "trades",
    industry: "Trades",
    funnelStage: "MOFU",
    audience: "Trades fielding evening and weekend calls",
    pillar: false,
    commercial: 8,
    seo: 6,
    productFit: 9,
    whyItMatters:
      "Emergency trades get out-of-hours calls; intersects two clusters with clear product fit.",
    internalLinks: ["/after-hours-enquiries-how-to-capture-them", "/ai-receptionist-for-plumbers-uk"],
    recommendedCta: CTA_TRIAL,
  }),

  // ===== Lead Conversion (cross-cutting authority) =========================
  op({
    slug: "speed-to-lead-uk-guide",
    title: "Speed to Lead: Why the First Responder Usually Wins",
    primaryKeyword: "speed to lead",
    cluster: "lead-conversion",
    industry: "All",
    funnelStage: "TOFU",
    audience: "Any service business owner converting enquiries",
    pillar: true,
    commercial: 9,
    seo: 8,
    productFit: 9,
    whyItMatters:
      "Authority pillar for lead conversion; high search demand and links into every cluster.",
    internalLinks: ["/missed-call-statistics-uk", "/ai-receptionist-uk", "/free-trial"],
    recommendedCta: CTA_TRIAL,
  }),
  op({
    slug: "lead-response-time-statistics-uk",
    title: "Lead Response Time Statistics UK Businesses Should Know",
    primaryKeyword: "lead response time statistics",
    cluster: "lead-conversion",
    industry: "All",
    funnelStage: "TOFU",
    audience: "Owners and marketers",
    pillar: false,
    commercial: 8,
    seo: 8,
    productFit: 8,
    whyItMatters:
      "Stat-led linkable asset that earns references and feeds the speed-to-lead pillar.",
    internalLinks: ["/speed-to-lead-uk-guide", "/missed-call-statistics-uk"],
    recommendedCta: "Read the speed-to-lead guide",
  }),
  op({
    slug: "how-to-recover-lost-enquiries",
    title: "How to Recover Lost Enquiries Before They Go Cold",
    primaryKeyword: "recover lost enquiries",
    cluster: "lead-conversion",
    industry: "All",
    funnelStage: "MOFU",
    audience: "Businesses with leaky enquiry handling",
    pillar: false,
    commercial: 8,
    seo: 7,
    productFit: 9,
    whyItMatters:
      "Recovery framing maps directly onto the product and the missed-call pillar.",
    internalLinks: ["/seo/missed-call-recovery-uk", "/ai-receptionist-uk"],
    recommendedCta: CTA_TRIAL,
  }),
  op({
    slug: "website-enquiry-conversion-guide",
    title: "Website Enquiry Conversion: From Form Fill to Booked Job",
    primaryKeyword: "website enquiry conversion",
    cluster: "lead-conversion",
    industry: "All",
    funnelStage: "MOFU",
    audience: "Owners whose website generates enquiries",
    pillar: false,
    commercial: 8,
    seo: 7,
    productFit: 9,
    whyItMatters:
      "Covers the web-form half of capture, complementing the call-centric articles.",
    internalLinks: ["/ai-receptionist-uk", "/how-it-works", "/free-trial"],
    recommendedCta: CTA_TRIAL,
  }),
  op({
    slug: "follow-up-strategy-for-service-businesses",
    title: "A Follow-Up Strategy for Service Businesses That Actually Works",
    primaryKeyword: "lead follow up strategy",
    cluster: "lead-conversion",
    industry: "All",
    funnelStage: "TOFU",
    audience: "Owners with inconsistent follow-up",
    pillar: false,
    commercial: 7,
    seo: 7,
    productFit: 8,
    whyItMatters:
      "Process content that positions LeadClaw as the system behind consistent follow-up.",
    internalLinks: ["/ai-receptionist-uk", "/quote-request-follow-up-for-trades"],
    recommendedCta: CTA_DEMO,
  }),
  op({
    slug: "how-to-respond-to-enquiries-faster",
    title: "How to Respond to Enquiries Faster (Without Hiring)",
    primaryKeyword: "respond to enquiries faster",
    cluster: "lead-conversion",
    industry: "All",
    funnelStage: "TOFU",
    audience: "Small teams stretched thin",
    pillar: false,
    commercial: 7,
    seo: 7,
    productFit: 8,
    whyItMatters:
      "Actionable how-to that introduces automation as the no-hire route to speed.",
    internalLinks: ["/speed-to-lead-uk-guide", "/ai-receptionist-uk"],
    recommendedCta: CTA_TRIAL,
  }),
  op({
    slug: "demo-vs-free-trial-leadclaw",
    title: "LeadClaw Demo vs Free Trial: Which Should You Start With?",
    primaryKeyword: "leadclaw demo or free trial",
    cluster: "lead-conversion",
    industry: "All",
    funnelStage: "BOFU",
    audience: "Ready-to-evaluate buyers",
    pillar: false,
    commercial: 8,
    seo: 5,
    productFit: 9,
    whyItMatters:
      "Bottom-funnel decision helper that captures branded intent and routes to conversion.",
    internalLinks: ["/demo", "/free-trial", "/pricing"],
    recommendedCta: CTA_TRIAL,
  }),
  op({
    slug: "how-to-never-miss-a-customer-call-uk",
    title: "How to Never Miss a Customer Call Again",
    primaryKeyword: "never miss a call",
    cluster: "missed-calls",
    industry: "All",
    funnelStage: "TOFU",
    audience: "Owners frustrated by calls slipping through",
    pillar: false,
    commercial: 8,
    seo: 8,
    productFit: 9,
    whyItMatters:
      "Plain-language TOFU magnet for the core pain; broad volume that funnels into the recovery pillar.",
    internalLinks: ["/seo/missed-call-recovery-uk", "/ai-receptionist-uk"],
    recommendedCta: CTA_TRIAL,
  }),
  op({
    slug: "missed-call-recovery-vs-answerphone",
    title: "Missed Call Recovery vs an Answerphone: What Actually Recovers Leads",
    primaryKeyword: "missed call recovery vs answerphone",
    cluster: "missed-calls",
    industry: "All",
    funnelStage: "MOFU",
    audience: "Owners weighing cheap voicemail against real recovery",
    pillar: false,
    commercial: 8,
    seo: 7,
    productFit: 9,
    whyItMatters:
      "Contrasts the status-quo voicemail with active text-back recovery; clarifies why LeadClaw converts more.",
    internalLinks: ["/seo/missed-call-recovery-uk", "/missed-call-text-back-guide-uk"],
    recommendedCta: CTA_TRIAL,
  }),
  op({
    slug: "ai-receptionist-faqs-uk",
    title: "AI Receptionist FAQs for UK Businesses",
    primaryKeyword: "ai receptionist faqs",
    cluster: "ai-receptionists",
    industry: "All",
    funnelStage: "TOFU",
    audience: "Researchers with common pre-purchase questions",
    pillar: false,
    commercial: 7,
    seo: 7,
    productFit: 8,
    whyItMatters:
      "FAQ asset captures long-tail question queries and earns rich-result visibility around the category term.",
    internalLinks: ["/ai-receptionist-uk", "/how-it-works"],
    recommendedCta: CTA_DEMO,
  }),
];

// ---- Existing-content audit (imported from live registries) ----------------

export type InventoryItem = {
  url: string;
  topic: string;
  industry: string;
  funnelStage: FunnelStage;
  primaryKeyword: string;
  source: string;
};

function titleToKeyword(title: string): string {
  return title
    .replace(/\s*\|\s*LeadClaw\s*$/i, "")
    .trim()
    .toLowerCase();
}

// Build a read-only inventory from the three published-page registries plus the
// known standalone routes. Used for the audit summary and duplicate detection.
export function getExistingInventory(): InventoryItem[] {
  const items: InventoryItem[] = [];

  for (const p of aiReceptionistPages) {
    items.push({
      url: p.canonicalPath,
      topic: p.title.replace(/\s*\|\s*LeadClaw\s*$/i, ""),
      industry: p.niche,
      funnelStage: "BOFU",
      primaryKeyword: titleToKeyword(p.title),
      source: "ai-receptionist-pages",
    });
  }
  for (const p of seoPages) {
    items.push({
      url: p.canonicalPath,
      topic: p.title.replace(/\s*\|\s*LeadClaw\s*$/i, ""),
      industry: p.niche,
      funnelStage: "BOFU",
      primaryKeyword: titleToKeyword(p.title),
      source: "seo-pages",
    });
  }
  for (const p of seoArticlePages) {
    items.push({
      url: p.canonicalPath,
      topic: p.title.replace(/\s*\|\s*LeadClaw\s*$/i, ""),
      industry: "All",
      funnelStage: "MOFU",
      primaryKeyword: titleToKeyword(p.title),
      source: "seo-article-pages",
    });
  }

  // Standalone SEO landing routes not in a registry.
  const standalone: InventoryItem[] = [
    {
      url: "/seo/missed-call-recovery-uk",
      topic: "Missed Call Recovery UK",
      industry: "All",
      funnelStage: "BOFU",
      primaryKeyword: "missed call recovery uk",
      source: "standalone",
    },
    {
      url: "/best-ai-receptionist-uk",
      topic: "Best AI Receptionist UK",
      industry: "All",
      funnelStage: "BOFU",
      primaryKeyword: "best ai receptionist uk",
      source: "standalone",
    },
    {
      url: "/missed-call-statistics-uk",
      topic: "Missed Call Statistics UK",
      industry: "All",
      funnelStage: "TOFU",
      primaryKeyword: "missed call statistics uk",
      source: "standalone",
    },
  ];
  items.push(...standalone);

  return items;
}

// Set of existing path slugs (last path segment) for duplicate detection.
export function getExistingSlugSet(): Set<string> {
  const set = new Set<string>();
  for (const item of getExistingInventory()) {
    const slug = item.url.replace(/^\/+|\/+$/g, "").split("/").pop() || "";
    if (slug) set.add(slug);
  }
  return set;
}

// Any backlog slug that collides with a published page (should be empty — the
// backlog is curated to fill gaps, not duplicate existing pages).
export function findDuplicateSlugs(
  backlog: ContentOpportunity[] = CONTENT_BACKLOG,
): string[] {
  const existing = getExistingSlugSet();
  return backlog.filter((o) => existing.has(o.slug)).map((o) => o.slug);
}

export type InventorySummary = {
  total: number;
  byFunnel: Record<FunnelStage, number>;
  bySource: Record<string, number>;
};

export function summarizeInventory(
  inventory: InventoryItem[] = getExistingInventory(),
): InventorySummary {
  const byFunnel: Record<FunnelStage, number> = { TOFU: 0, MOFU: 0, BOFU: 0 };
  const bySource: Record<string, number> = {};
  for (const i of inventory) {
    byFunnel[i.funnelStage] += 1;
    bySource[i.source] = (bySource[i.source] || 0) + 1;
  }
  return { total: inventory.length, byFunnel, bySource };
}

// ---- Ranking + status merge ------------------------------------------------

export type RankedOpportunity = ContentOpportunity & {
  total: number;
  rank: number;
  status: ContentStatus;
  statusNotes: string | null;
  statusUpdatedAt: string | null;
};

export type StatusRow = {
  slug: string;
  status: string | null;
  notes: string | null;
  updated_at: string | null;
};

// Rank highest-to-lowest by total, then commercial, then product fit, then
// cluster priority, then title (stable). Merges any persisted status overlay.
export function rankOpportunities(
  backlog: ContentOpportunity[] = CONTENT_BACKLOG,
  statusRows: StatusRow[] = [],
): RankedOpportunity[] {
  const statusBySlug = new Map<string, StatusRow>();
  for (const r of statusRows) statusBySlug.set(r.slug, r);

  const withTotals = backlog.map((o) => {
    const row = statusBySlug.get(o.slug);
    const status = isContentStatus(row?.status) ? (row!.status as ContentStatus) : "backlog";
    return {
      ...o,
      total: totalScore(o.scores),
      status,
      statusNotes: row?.notes ?? null,
      statusUpdatedAt: row?.updated_at ?? null,
      rank: 0,
    };
  });

  withTotals.sort(
    (a, b) =>
      b.total - a.total ||
      b.scores.commercial - a.scores.commercial ||
      b.scores.productFit - a.scores.productFit ||
      CLUSTER_PRIORITY[a.cluster] - CLUSTER_PRIORITY[b.cluster] ||
      a.title.localeCompare(b.title),
  );
  withTotals.forEach((o, i) => (o.rank = i + 1));
  return withTotals;
}

// ---- Next-article recommendation -------------------------------------------

export type NextArticleRecommendation = {
  title: string;
  slug: string;
  primaryKeyword: string;
  cluster: ClusterKey;
  clusterLabel: string;
  targetAudience: string;
  funnelStage: FunnelStage;
  total: number;
  scores: Scores;
  whyItMatters: string;
  internalLinksToAdd: string[];
  recommendedCta: string;
} | null;

// The single best next article: highest-ranked opportunity that is not already
// published or in progress (so the recommendation always moves new work forward).
export function recommendNextArticle(
  backlog: ContentOpportunity[] = CONTENT_BACKLOG,
  statusRows: StatusRow[] = [],
): NextArticleRecommendation {
  const ranked = rankOpportunities(backlog, statusRows);
  const next = ranked.find(
    (o) => o.status === "backlog" || o.status === "planned",
  );
  if (!next) return null;
  return {
    title: next.title,
    slug: next.slug,
    primaryKeyword: next.primaryKeyword,
    cluster: next.cluster,
    clusterLabel: CLUSTER_LABELS[next.cluster],
    targetAudience: next.audience,
    funnelStage: next.funnelStage,
    total: next.total,
    scores: next.scores,
    whyItMatters: next.whyItMatters,
    internalLinksToAdd: next.internalLinks,
    recommendedCta: next.recommendedCta,
  };
}

// ---- Topic clusters --------------------------------------------------------

export type ClusterView = {
  key: ClusterKey;
  label: string;
  priority: number;
  pillarPages: { title: string; slug: string; existing: boolean }[];
  supportingArticles: { title: string; slug: string; total: number; status: ContentStatus }[];
  internalLinkingRecommendation: string;
};

const CLUSTER_LINKING: Record<ClusterKey, string> = {
  "missed-calls":
    "Point every supporting article at the Missed Call Recovery pillar (/seo/missed-call-recovery-uk) and the relevant industry page; cross-link the statistics article as the evidence hub.",
  "ai-receptionists":
    "Hub on /ai-receptionist-uk and /best-ai-receptionist-uk; route cost/ROI/comparison articles into /pricing and /compare.",
  dental:
    "Cluster around /seo/ai-agent-for-dental-clinics-uk; link dental missed-call and conversion pieces to /seo/dental-missed-call-recovery-uk and /demo.",
  "aesthetic-clinics":
    "Cluster around /seo/ai-agent-for-aesthetic-clinics-uk; connect response-time and DM-conversion pieces to /ai-receptionist-for-aesthetic-clinics-uk and /demo.",
  trades:
    "Hub on the trades pillar and /seo/missed-call-recovery-uk; link each trade's article to its /ai-receptionist-for-{trade}-uk page and the pilot (/apply).",
  "lead-conversion":
    "Speed-to-lead is the authority pillar; link cluster pillars (missed calls, AI receptionists, dental, aesthetics, trades) back to it and forward to /free-trial.",
};

// Pillars that already exist as published pages (so we don't re-create them).
const EXISTING_PILLARS: Partial<Record<ClusterKey, { title: string; slug: string }[]>> = {
  "missed-calls": [{ title: "Missed Call Recovery UK", slug: "missed-call-recovery-uk" }],
  "ai-receptionists": [
    { title: "AI Receptionist UK", slug: "ai-receptionist-uk" },
    { title: "Best AI Receptionist UK", slug: "best-ai-receptionist-uk" },
  ],
  dental: [{ title: "AI Agent for Dental Clinics UK", slug: "ai-agent-for-dental-clinics-uk" }],
  "aesthetic-clinics": [
    { title: "AI Agent for Aesthetic Clinics UK", slug: "ai-agent-for-aesthetic-clinics-uk" },
  ],
};

export function getClusters(
  backlog: ContentOpportunity[] = CONTENT_BACKLOG,
  statusRows: StatusRow[] = [],
): ClusterView[] {
  const ranked = rankOpportunities(backlog, statusRows);
  const keys = Object.keys(CLUSTER_PRIORITY) as ClusterKey[];

  return keys
    .map((key) => {
      const members = ranked.filter((o) => o.cluster === key);
      const newPillars = members
        .filter((o) => o.pillar)
        .map((o) => ({ title: o.title, slug: o.slug, existing: false }));
      const existingPillars = (EXISTING_PILLARS[key] || []).map((p) => ({
        ...p,
        existing: true,
      }));
      return {
        key,
        label: CLUSTER_LABELS[key],
        priority: CLUSTER_PRIORITY[key],
        pillarPages: [...existingPillars, ...newPillars],
        supportingArticles: members
          .filter((o) => !o.pillar)
          .map((o) => ({
            title: o.title,
            slug: o.slug,
            total: o.total,
            status: o.status,
          })),
        internalLinkingRecommendation: CLUSTER_LINKING[key],
      };
    })
    .sort((a, b) => a.priority - b.priority);
}

// ---- Queue summary ---------------------------------------------------------

export type QueueSummary = {
  totalOpportunities: number;
  backlog: number;
  planned: number;
  inProgress: number;
  published: number;
  byCluster: { cluster: ClusterKey; label: string; count: number; topTotal: number }[];
};

export function computeQueueSummary(
  ranked: RankedOpportunity[],
): QueueSummary {
  const summary: QueueSummary = {
    totalOpportunities: ranked.length,
    backlog: 0,
    planned: 0,
    inProgress: 0,
    published: 0,
    byCluster: [],
  };
  for (const o of ranked) {
    if (o.status === "backlog") summary.backlog += 1;
    else if (o.status === "planned") summary.planned += 1;
    else if (o.status === "in_progress") summary.inProgress += 1;
    else if (o.status === "published") summary.published += 1;
  }
  const keys = Object.keys(CLUSTER_PRIORITY) as ClusterKey[];
  summary.byCluster = keys.map((key) => {
    const members = ranked.filter((o) => o.cluster === key);
    return {
      cluster: key,
      label: CLUSTER_LABELS[key],
      count: members.length,
      topTotal: members.reduce((max, o) => Math.max(max, o.total), 0),
    };
  });
  return summary;
}
