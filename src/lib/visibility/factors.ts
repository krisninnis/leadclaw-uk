// Phase 3 — AI Visibility (Foundation)
// The factor catalogue. Each factor reads exactly one signal that already
// exists in a website_audits row (by audit check id) and reframes it for AI
// visibility. This is why the engine needs no new crawler: it is a second,
// AI-focused *lens* over data the Phase 2 audit already gathered.
//
// score: read straight from the source audit check (0..1, partial credit).
// recommendation: AI-visibility-framed action shown when the factor is weak.

import type { VisibilityCategory, VisibilitySeverity } from "./types";

export type VisibilityFactorDef = {
  id: string;
  label: string;
  category: VisibilityCategory;
  weight: number;
  severity: VisibilitySeverity;
  // The website_audits check id this factor reads its 0..1 score from.
  sourceCheckId: string;
  // Shown (with the audit's own detail) when the factor scores below 1.
  recommendation: string;
};

export const VISIBILITY_FACTORS: VisibilityFactorDef[] = [
  // -------------------------------------------------------------------------
  // CONTENT — can an AI assistant understand and summarise what you offer?
  // -------------------------------------------------------------------------
  {
    id: "content_depth",
    label: "Substantive content",
    category: "content",
    weight: 2,
    severity: "medium",
    sourceCheckId: "knowledge_content",
    recommendation:
      "Publish more substantive, helpful content (treatment explainers, guides). AI assistants can only describe and recommend what your pages actually say.",
  },
  {
    id: "service_content",
    label: "Service / treatment pages",
    category: "content",
    weight: 2,
    severity: "medium",
    sourceCheckId: "treatment_pages",
    recommendation:
      "Add a clear page for each service or treatment so AI tools can answer specific questions about what you offer.",
  },
  {
    id: "faq_content",
    label: "FAQ answers",
    category: "content",
    weight: 2,
    severity: "high",
    sourceCheckId: "faq_content",
    recommendation:
      "Add an FAQ section that answers real customer questions in plain language — AI assistants frequently quote FAQ answers verbatim.",
  },
  {
    id: "scannable_structure",
    label: "Scannable structure",
    category: "content",
    weight: 1,
    severity: "low",
    sourceCheckId: "structured_headings",
    recommendation:
      "Break content into clear H2/H3 sections. Well-structured pages are easier for AI systems to parse into accurate summaries.",
  },
  {
    id: "clear_naming",
    label: "Clear page title",
    category: "content",
    weight: 1,
    severity: "medium",
    sourceCheckId: "title_tag",
    recommendation:
      "Use a descriptive page title that states your service and location, so AI systems associate you with the right queries.",
  },

  // -------------------------------------------------------------------------
  // AUTHORITY — does the AI have reasons to trust and recommend you (E-E-A-T)?
  // -------------------------------------------------------------------------
  {
    id: "named_expertise",
    label: "Named expertise",
    category: "authority",
    weight: 2,
    severity: "high",
    sourceCheckId: "author_info",
    recommendation:
      "Show named practitioners with their credentials. AI models weight expertise and authorship signals (E-E-A-T) when deciding who to recommend.",
  },
  {
    id: "reputation",
    label: "Reputation signals",
    category: "authority",
    weight: 2,
    severity: "high",
    sourceCheckId: "review_content",
    recommendation:
      "Publish reviews and testimonials (ideally with Review/AggregateRating data) so AI tools can cite your reputation, not just your claims.",
  },
  {
    id: "about_credentials",
    label: "About / team page",
    category: "authority",
    weight: 1,
    severity: "medium",
    sourceCheckId: "about",
    recommendation:
      "Add an about/team page describing who you are and your qualifications — this is a primary trust signal for AI recommendations.",
  },
  {
    id: "business_legitimacy",
    label: "Verifiable contact details",
    category: "authority",
    weight: 1,
    severity: "low",
    sourceCheckId: "contact_info",
    recommendation:
      "Show clear, consistent contact details. Verifiable NAP (name, address, phone) helps AI systems confirm you are a real, trustworthy business.",
  },

  // -------------------------------------------------------------------------
  // CITATION — can AI systems crawl, reach, and cite your pages at all?
  // -------------------------------------------------------------------------
  {
    id: "sitemap",
    label: "Sitemap discoverability",
    category: "citation",
    weight: 2,
    severity: "medium",
    sourceCheckId: "sitemap",
    recommendation:
      "Publish a sitemap.xml so AI and search crawlers can find every page worth citing.",
  },
  {
    id: "crawler_rules",
    label: "Crawler guidance (robots.txt)",
    category: "citation",
    weight: 1,
    severity: "medium",
    sourceCheckId: "robots",
    recommendation:
      "Add a robots.txt that welcomes legitimate crawlers — blocking or omitting it can keep AI systems from indexing you.",
  },
  {
    id: "internal_links",
    label: "Internal linking",
    category: "citation",
    weight: 1,
    severity: "low",
    sourceCheckId: "internal_linking",
    recommendation:
      "Link to your key pages from the homepage so crawlers can discover and weigh your most important content.",
  },
  {
    id: "canonical",
    label: "Canonical URLs",
    category: "citation",
    weight: 1,
    severity: "low",
    sourceCheckId: "canonical",
    recommendation:
      "Add canonical tags so AI systems attribute citations to a single, correct URL instead of splitting signals across duplicates.",
  },
  {
    id: "secure_access",
    label: "Secure, reachable site",
    category: "citation",
    weight: 1,
    severity: "medium",
    sourceCheckId: "https",
    recommendation:
      "Serve every page over HTTPS. Crawlers and AI systems deprioritise or skip sites that are insecure or unreachable.",
  },
  {
    id: "response_speed",
    label: "Fast responses",
    category: "citation",
    weight: 1,
    severity: "low",
    sourceCheckId: "response_speed",
    recommendation:
      "Speed up your pages. Slow responses reduce how thoroughly crawlers index your content.",
  },

  // -------------------------------------------------------------------------
  // SCHEMA — is your business machine-readable as structured facts?
  // -------------------------------------------------------------------------
  {
    id: "structured_data",
    label: "Structured data (JSON-LD)",
    category: "schema",
    weight: 3,
    severity: "high",
    sourceCheckId: "structured_data",
    recommendation:
      "Add JSON-LD structured data. It turns your pages into machine-readable facts AI systems can ingest directly, rather than guessing from prose.",
  },
  {
    id: "localbusiness_schema",
    label: "LocalBusiness schema + NAP",
    category: "schema",
    weight: 2,
    severity: "high",
    sourceCheckId: "local_seo",
    recommendation:
      "Add LocalBusiness structured data with a visible name, address and phone. This is how AI assistants confirm what you do and where.",
  },
  {
    id: "faq_schema",
    label: "FAQPage schema",
    category: "schema",
    weight: 1,
    severity: "medium",
    sourceCheckId: "faq_content",
    recommendation:
      "Mark up your FAQ with FAQPage structured data so AI systems can lift exact question-and-answer pairs.",
  },
  {
    id: "review_schema",
    label: "Review / rating schema",
    category: "schema",
    weight: 1,
    severity: "medium",
    sourceCheckId: "review_content",
    recommendation:
      "Add Review/AggregateRating structured data so your ratings are readable as data, letting AI tools cite your reputation precisely.",
  },
];
