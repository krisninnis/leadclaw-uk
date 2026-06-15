// Phase 2 — AI Website Audit (V1)
// The check catalogue. Each check is a pure function of the crawl inputs that
// returns a 0..1 score, a weight, and (when imperfect) a recommendation.
// Categories: Website Health, SEO, Trust, Conversion, AI Readiness.

import type { AuditCategory, CheckResult, CheckSeverity } from "./types";
import type { ParsedSignals } from "./parse-html";
import type { SiteFetchResult } from "./fetch-site";

export type CheckInput = {
  origin: string;
  inputUrl: string;
  httpsOk: boolean; // https request succeeded
  fetch: SiteFetchResult;
  signals: ParsedSignals;
  robotsFound: boolean;
  sitemapFound: boolean;
};

type CheckDef = {
  id: string;
  label: string;
  category: AuditCategory;
  weight: number;
  severity: CheckSeverity;
  run: (i: CheckInput) => { score: number; detail: string; recommendation?: string };
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const bool = (
  pass: boolean,
  passDetail: string,
  failDetail: string,
  recommendation: string,
) =>
  pass
    ? { score: 1, detail: passDetail }
    : { score: 0, detail: failDetail, recommendation };

// ---------------------------------------------------------------------------
// WEBSITE HEALTH
// ---------------------------------------------------------------------------
const HEALTH_CHECKS: CheckDef[] = [
  {
    id: "https",
    label: "HTTPS enabled",
    category: "health",
    weight: 3,
    severity: "high",
    run: (i) =>
      bool(
        i.httpsOk,
        "The site is served securely over HTTPS.",
        "The site did not respond securely over HTTPS.",
        "Install a valid SSL certificate and serve all pages over HTTPS.",
      ),
  },
  {
    id: "reachable",
    label: "Site reachable",
    category: "health",
    weight: 3,
    severity: "high",
    run: (i) =>
      bool(
        i.fetch.ok,
        `The homepage returned status ${i.fetch.status ?? "?"}.`,
        i.fetch.error || "The homepage could not be loaded.",
        "Ensure the homepage loads reliably and returns a 200 status.",
      ),
  },
  {
    id: "mobile_friendly",
    label: "Mobile friendly",
    category: "health",
    weight: 2,
    severity: "high",
    run: (i) =>
      bool(
        i.signals.hasViewportMeta,
        "A responsive viewport meta tag is present.",
        "No responsive viewport meta tag was found.",
        'Add <meta name="viewport" content="width=device-width, initial-scale=1"> so the site renders well on phones.',
      ),
  },
  {
    id: "favicon",
    label: "Has favicon",
    category: "health",
    weight: 1,
    severity: "low",
    run: (i) =>
      bool(
        i.signals.hasFavicon,
        "A favicon / touch icon is declared.",
        "No favicon was found.",
        "Add a favicon so the site looks polished in browser tabs and bookmarks.",
      ),
  },
  {
    id: "robots",
    label: "Has robots.txt",
    category: "health",
    weight: 1,
    severity: "medium",
    run: (i) =>
      bool(
        i.robotsFound,
        "robots.txt is present.",
        "No robots.txt was found.",
        "Add a robots.txt to guide search engine and AI crawlers.",
      ),
  },
  {
    id: "sitemap",
    label: "Has sitemap.xml",
    category: "health",
    weight: 1,
    severity: "medium",
    run: (i) =>
      bool(
        i.sitemapFound,
        "sitemap.xml is present.",
        "No sitemap.xml was found.",
        "Publish a sitemap.xml so every page is discoverable by crawlers.",
      ),
  },
  {
    id: "response_speed",
    label: "Response speed",
    category: "health",
    weight: 2,
    severity: "medium",
    run: (i) => {
      const ms = i.fetch.responseMs;
      // Full credit < 800ms, zero by 4000ms, linear between.
      const score = clamp01((4000 - ms) / (4000 - 800));
      return {
        score,
        detail: `The homepage responded in ${ms} ms.`,
        recommendation:
          score < 1
            ? "Improve server/page response time (caching, image compression, fewer blocking resources)."
            : undefined,
      };
    },
  },
  {
    id: "lang_attr",
    label: "Accessibility basics (lang attribute)",
    category: "health",
    weight: 1,
    severity: "low",
    run: (i) =>
      bool(
        Boolean(i.signals.langAttr),
        `The page declares a language (lang="${i.signals.langAttr}").`,
        "The <html> element has no lang attribute.",
        'Add a lang attribute (e.g. lang="en") to the <html> tag for accessibility and SEO.',
      ),
  },
];

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------
const SEO_CHECKS: CheckDef[] = [
  {
    id: "title_tag",
    label: "Title tag",
    category: "seo",
    weight: 3,
    severity: "high",
    run: (i) => {
      const t = i.signals.title || "";
      if (!t) {
        return {
          score: 0,
          detail: "No <title> tag was found.",
          recommendation:
            "Add a descriptive <title> of roughly 50–60 characters including your clinic name and location.",
        };
      }
      const good = t.length >= 20 && t.length <= 65;
      return {
        score: good ? 1 : 0.5,
        detail: `Title is ${t.length} characters: “${t.slice(0, 70)}”.`,
        recommendation: good
          ? undefined
          : "Aim for a title of roughly 50–60 characters that includes your service and location.",
      };
    },
  },
  {
    id: "meta_description",
    label: "Meta description",
    category: "seo",
    weight: 2,
    severity: "high",
    run: (i) => {
      const d = i.signals.metaDescription || "";
      if (!d) {
        return {
          score: 0,
          detail: "No meta description was found.",
          recommendation:
            "Add a compelling meta description of roughly 140–160 characters to improve click-through from search.",
        };
      }
      const good = d.length >= 70 && d.length <= 165;
      return {
        score: good ? 1 : 0.5,
        detail: `Meta description is ${d.length} characters.`,
        recommendation: good
          ? undefined
          : "Aim for a meta description of roughly 140–160 characters.",
      };
    },
  },
  {
    id: "h1_present",
    label: "H1 present",
    category: "seo",
    weight: 2,
    severity: "high",
    run: (i) => {
      if (i.signals.h1Count === 0) {
        return {
          score: 0,
          detail: "No H1 heading was found.",
          recommendation: "Add a single, descriptive H1 heading to the page.",
        };
      }
      if (i.signals.h1Count > 1) {
        return {
          score: 0.6,
          detail: `${i.signals.h1Count} H1 headings were found.`,
          recommendation: "Use exactly one H1 per page; demote the others to H2/H3.",
        };
      }
      return { score: 1, detail: "Exactly one H1 heading is present." };
    },
  },
  {
    id: "structured_headings",
    label: "Structured headings",
    category: "seo",
    weight: 1,
    severity: "medium",
    run: (i) =>
      bool(
        i.signals.h2Count >= 2,
        `The page uses a heading hierarchy (${i.signals.headingCount} headings).`,
        "The page has little heading structure.",
        "Use H2/H3 subheadings to structure content for readers and search engines.",
      ),
  },
  {
    id: "image_alt",
    label: "Image alt text",
    category: "seo",
    weight: 1,
    severity: "medium",
    run: (i) => {
      if (i.signals.imageCount === 0) {
        return { score: 1, detail: "No images requiring alt text were found." };
      }
      const ratio = i.signals.imagesWithAlt / i.signals.imageCount;
      return {
        score: clamp01(ratio),
        detail: `${i.signals.imagesWithAlt} of ${i.signals.imageCount} images have alt text.`,
        recommendation:
          ratio < 0.9
            ? "Add descriptive alt text to all meaningful images for accessibility and image SEO."
            : undefined,
      };
    },
  },
  {
    id: "internal_linking",
    label: "Internal linking",
    category: "seo",
    weight: 1,
    severity: "low",
    run: (i) =>
      bool(
        i.signals.internalLinks >= 3,
        `The homepage has ${i.signals.internalLinks} internal links.`,
        "The homepage has very few internal links.",
        "Link to your key pages (services, contact, about) from the homepage.",
      ),
  },
  {
    id: "canonical",
    label: "Canonical tag",
    category: "seo",
    weight: 1,
    severity: "low",
    run: (i) =>
      bool(
        Boolean(i.signals.canonical),
        "A canonical tag is present.",
        "No canonical tag was found.",
        "Add a canonical link tag to prevent duplicate-content issues.",
      ),
  },
  {
    id: "local_seo",
    label: "Local SEO signals",
    category: "seo",
    weight: 1,
    severity: "medium",
    run: (i) => {
      const hasLocalSchema = i.signals.jsonLdTypes.some((t) =>
        /LocalBusiness|MedicalClinic|Dentist|Physician|HealthAndBeautyBusiness/i.test(t),
      );
      const hasAddress = i.signals.mentionsAddress;
      const score = (hasLocalSchema ? 0.6 : 0) + (hasAddress ? 0.4 : 0);
      return {
        score: clamp01(score),
        detail: `Local signals — schema: ${hasLocalSchema ? "yes" : "no"}, address on page: ${hasAddress ? "yes" : "no"}.`,
        recommendation:
          score < 1
            ? "Add LocalBusiness structured data and a visible NAP (name, address, phone) for local search."
            : undefined,
      };
    },
  },
];

// ---------------------------------------------------------------------------
// TRUST
// ---------------------------------------------------------------------------
const TRUST_CHECKS: CheckDef[] = [
  {
    id: "contact_info",
    label: "Contact information",
    category: "trust",
    weight: 2,
    severity: "high",
    run: (i) =>
      bool(
        i.signals.hasContactLink || i.signals.hasMailtoLink,
        "Contact information / a contact route is present.",
        "No clear contact information was found.",
        "Add a clearly linked contact page with email and enquiry options.",
      ),
  },
  {
    id: "address",
    label: "Address shown",
    category: "trust",
    weight: 1,
    severity: "medium",
    run: (i) =>
      bool(
        i.signals.mentionsAddress,
        "A physical address appears on the page.",
        "No physical address was detected.",
        "Display your clinic address (ideally in the footer on every page).",
      ),
  },
  {
    id: "phone",
    label: "Phone number",
    category: "trust",
    weight: 2,
    severity: "high",
    run: (i) =>
      bool(
        i.signals.hasTelLink || i.signals.phoneNumbers > 0,
        "A phone number is shown.",
        "No phone number was found.",
        "Show a clickable phone number (tel: link) prominently in the header.",
      ),
  },
  {
    id: "reviews",
    label: "Reviews displayed",
    category: "trust",
    weight: 1,
    severity: "medium",
    run: (i) =>
      bool(
        i.signals.mentionsReviews,
        "Reviews or testimonials are referenced on the page.",
        "No reviews or testimonials were detected.",
        "Display patient reviews/testimonials (and star ratings) to build trust.",
      ),
  },
  {
    id: "gallery",
    label: "Before/after or results gallery",
    category: "trust",
    weight: 1,
    severity: "low",
    run: (i) =>
      bool(
        i.signals.mentionsBeforeAfter,
        "A results / before-and-after gallery is referenced.",
        "No before/after or results gallery was detected.",
        "Add a before/after or results gallery to demonstrate outcomes.",
      ),
  },
  {
    id: "privacy",
    label: "Privacy policy",
    category: "trust",
    weight: 1,
    severity: "medium",
    run: (i) =>
      bool(
        i.signals.hasPrivacyLink,
        "A privacy policy is linked.",
        "No privacy policy link was found.",
        "Publish and link a privacy policy (required under UK GDPR).",
      ),
  },
  {
    id: "terms",
    label: "Terms page",
    category: "trust",
    weight: 1,
    severity: "low",
    run: (i) =>
      bool(
        i.signals.hasTermsLink,
        "A terms / conditions page is linked.",
        "No terms or conditions page was found.",
        "Add a terms & conditions page for clarity and credibility.",
      ),
  },
  {
    id: "about",
    label: "Team / about page",
    category: "trust",
    weight: 1,
    severity: "medium",
    run: (i) =>
      bool(
        i.signals.hasAboutLink || i.signals.mentionsTeam,
        "An about / team presence was found.",
        "No about or team page was detected.",
        "Add an about/team page with practitioner names and credentials.",
      ),
  },
];

// ---------------------------------------------------------------------------
// CONVERSION
// ---------------------------------------------------------------------------
const CONVERSION_CHECKS: CheckDef[] = [
  {
    id: "clear_cta",
    label: "Clear call to action",
    category: "conversion",
    weight: 3,
    severity: "high",
    run: (i) =>
      bool(
        i.signals.ctaPhrases > 0,
        `Call-to-action language is present (${i.signals.ctaPhrases} CTA phrases).`,
        "No obvious call to action was detected.",
        'Add a prominent primary CTA (e.g. "Book a consultation") above the fold.',
      ),
  },
  {
    id: "contact_form",
    label: "Contact / enquiry form",
    category: "conversion",
    weight: 2,
    severity: "high",
    run: (i) =>
      bool(
        i.signals.hasForm,
        "A form is present for capturing enquiries.",
        "No enquiry form was found on the page.",
        "Add a short enquiry form to capture leads directly on the page.",
      ),
  },
  {
    id: "online_booking",
    label: "Online booking",
    category: "conversion",
    weight: 2,
    severity: "medium",
    run: (i) =>
      bool(
        i.signals.hasBookingLink,
        "An online booking / appointment route is present.",
        "No online booking option was detected.",
        "Offer online booking so visitors can self-schedule appointments.",
      ),
  },
  {
    id: "call_button",
    label: "Click-to-call button",
    category: "conversion",
    weight: 2,
    severity: "high",
    run: (i) =>
      bool(
        i.signals.hasTelLink,
        "A click-to-call (tel:) link is present.",
        "No click-to-call link was found.",
        "Add a tap-to-call (tel:) button so mobile visitors can call instantly.",
      ),
  },
  {
    id: "mobile_usability",
    label: "Mobile usability",
    category: "conversion",
    weight: 1,
    severity: "medium",
    run: (i) =>
      bool(
        i.signals.hasViewportMeta,
        "The page is configured for mobile devices.",
        "The page is not configured for mobile devices.",
        "Ensure the site is mobile-responsive — most clinic visitors are on phones.",
      ),
  },
];

// ---------------------------------------------------------------------------
// AI READINESS (signals only — no LLM ranking yet)
// ---------------------------------------------------------------------------
const AI_CHECKS: CheckDef[] = [
  {
    id: "faq_content",
    label: "FAQ content",
    category: "ai_readiness",
    weight: 2,
    severity: "medium",
    run: (i) => {
      const hasFaqSchema = i.signals.jsonLdTypes.some((t) => /FAQPage|Question/i.test(t));
      const score = hasFaqSchema ? 1 : i.signals.mentionsFaq ? 0.6 : 0;
      return {
        score,
        detail: `FAQ — schema: ${hasFaqSchema ? "yes" : "no"}, FAQ text: ${i.signals.mentionsFaq ? "yes" : "no"}.`,
        recommendation:
          score < 1
            ? "Add an FAQ section with FAQPage structured data — AI assistants quote FAQ answers directly."
            : undefined,
      };
    },
  },
  {
    id: "treatment_pages",
    label: "Treatment / service content",
    category: "ai_readiness",
    weight: 2,
    severity: "medium",
    run: (i) =>
      bool(
        i.signals.mentionsTreatments,
        "Treatment / service content is present.",
        "No clear treatment or service content was detected.",
        "Publish detailed pages for each treatment/service so AI tools can describe what you offer.",
      ),
  },
  {
    id: "structured_data",
    label: "Structured data",
    category: "ai_readiness",
    weight: 2,
    severity: "high",
    run: (i) => {
      const n = i.signals.jsonLdBlocks.length;
      return {
        score: n === 0 ? 0 : n === 1 ? 0.7 : 1,
        detail:
          n === 0
            ? "No JSON-LD structured data was found."
            : `${n} JSON-LD block(s) found (${[...new Set(i.signals.jsonLdTypes)].join(", ") || "untyped"}).`,
        recommendation:
          n < 2
            ? "Add JSON-LD structured data (LocalBusiness, Service, FAQPage) to help AI models understand your site."
            : undefined,
      };
    },
  },
  {
    id: "author_info",
    label: "Author / expertise information",
    category: "ai_readiness",
    weight: 1,
    severity: "low",
    run: (i) =>
      bool(
        i.signals.mentionsTeam,
        "Practitioner / author information is present.",
        "No author or practitioner expertise information was detected.",
        "Show named clinicians with credentials — AI models weight expertise (E-E-A-T) signals.",
      ),
  },
  {
    id: "review_content",
    label: "Review content",
    category: "ai_readiness",
    weight: 1,
    severity: "low",
    run: (i) => {
      const hasReviewSchema = i.signals.jsonLdTypes.some((t) => /Review|AggregateRating/i.test(t));
      const score = hasReviewSchema ? 1 : i.signals.mentionsReviews ? 0.6 : 0;
      return {
        score,
        detail: `Reviews — schema: ${hasReviewSchema ? "yes" : "no"}, review text: ${i.signals.mentionsReviews ? "yes" : "no"}.`,
        recommendation:
          score < 1
            ? "Publish reviews with Review/AggregateRating structured data so AI tools can cite your reputation."
            : undefined,
      };
    },
  },
  {
    id: "knowledge_content",
    label: "Knowledge content depth",
    category: "ai_readiness",
    weight: 1,
    severity: "low",
    run: (i) => {
      // Use body text length as a rough proxy for substantive content.
      const score = clamp01(i.signals.textLength / 2500);
      return {
        score,
        detail: `Approx. ${i.signals.textLength} characters of body content.`,
        recommendation:
          score < 1
            ? "Add substantive, helpful content (guides, treatment explainers) for AI assistants to draw on."
            : undefined,
      };
    },
  },
];

export const ALL_CHECKS: CheckDef[] = [
  ...HEALTH_CHECKS,
  ...SEO_CHECKS,
  ...TRUST_CHECKS,
  ...CONVERSION_CHECKS,
  ...AI_CHECKS,
];

export function runChecks(input: CheckInput): CheckResult[] {
  return ALL_CHECKS.map((def) => {
    const r = def.run(input);
    const score = clamp01(r.score);
    return {
      id: def.id,
      label: def.label,
      category: def.category,
      weight: def.weight,
      severity: def.severity,
      score,
      passed: score >= 0.999,
      detail: r.detail,
      recommendation: score < 0.999 ? r.recommendation : undefined,
    };
  });
}
