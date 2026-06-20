// Phase 2 — AI Website Audit (V1)
// The check catalogue. Each check is a pure function of the crawl inputs that
// returns a 0..1 score, a weight, and (when imperfect) a recommendation.
// Categories: Website Health, SEO, Trust, Conversion, AI Readiness.

import type {
  AuditCategory,
  CheckEvidence,
  CheckResult,
  CheckSeverity,
} from "./types";
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

type CheckRun = {
  score: number;
  detail: string;
  recommendation?: string;
  evidence?: CheckEvidence;
};

type CheckDef = {
  id: string;
  label: string;
  category: AuditCategory;
  weight: number;
  severity: CheckSeverity;
  run: (i: CheckInput) => CheckRun;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const bool = (
  pass: boolean,
  passDetail: string,
  failDetail: string,
  recommendation: string,
  evidence?: CheckEvidence,
): CheckRun =>
  pass
    ? { score: 1, detail: passDetail, evidence }
    : { score: 0, detail: failDetail, recommendation, evidence };

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
        "Browsers mark sites without HTTPS as “Not secure”, which makes visitors hesitate before sharing contact details. Install a valid SSL certificate and serve every page over HTTPS.",
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
        "If the homepage doesn’t load reliably, visitors and search engines simply leave. Make sure it returns a 200 status every time.",
        { found: i.fetch.status != null ? `HTTP ${i.fetch.status}` : undefined },
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
        "Most visitors browse on a phone. Without a responsive viewport tag the page can render zoomed-out or broken on mobile, and those visitors bounce. Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">.",
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
        "A missing favicon makes the site look unfinished in browser tabs and bookmarks. Add one so your brand is recognisable when visitors keep your tab open.",
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
        "Add a robots.txt so search engines and AI crawlers know which pages to index — it’s the first file they look for.",
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
        "Without a sitemap, newer or deeper pages can go undiscovered by search engines. Publish a sitemap.xml so every page can be found and indexed.",
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
            ? "Slow pages lose visitors before they ever see your services. Speed up response time with caching, image compression, and fewer blocking scripts."
            : undefined,
        evidence: { count: ms },
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
        "A missing lang attribute makes screen readers and search engines guess your content’s language. Add lang=\"en\" (or your language) to the <html> tag.",
        i.signals.langAttr ? { found: `lang="${i.signals.langAttr}"` } : undefined,
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
            "The title is the headline that shows in Google and AI search results — without one, your listing is unclickable. Add a descriptive title of roughly 50–60 characters including your business name and location.",
        };
      }
      const good = t.length >= 20 && t.length <= 65;
      return {
        score: good ? 1 : 0.5,
        detail: `Title is ${t.length} characters: “${t.slice(0, 70)}”.`,
        recommendation: good
          ? undefined
          : "Your title is too short or too long to show well in search results. Aim for roughly 50–60 characters including your service and location.",
        evidence: { snippet: t.slice(0, 120), count: t.length },
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
            "Without a meta description, Google writes its own snippet from random page text — costing you clicks. Add a compelling description of roughly 140–160 characters that gives searchers a reason to choose you.",
        };
      }
      const good = d.length >= 70 && d.length <= 165;
      return {
        score: good ? 1 : 0.5,
        detail: `Meta description is ${d.length} characters.`,
        recommendation: good
          ? undefined
          : "Your meta description is outside the length that displays cleanly in search. Aim for roughly 140–160 characters.",
        evidence: { snippet: d.slice(0, 160), count: d.length },
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
          recommendation:
            "The H1 is the main heading search engines use to understand what a page is about. Add a single, descriptive H1 stating your core service and location.",
          evidence: { count: 0 },
        };
      }
      if (i.signals.h1Count > 1) {
        return {
          score: 0.6,
          detail: `${i.signals.h1Count} H1 headings were found.`,
          recommendation:
            "Multiple H1s dilute the signal of what the page is about. Use exactly one H1 per page and demote the others to H2/H3.",
          evidence: { count: i.signals.h1Count },
        };
      }
      return { score: 1, detail: "Exactly one H1 heading is present.", evidence: { count: 1 } };
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
        "Without subheadings, visitors skim past your content and search engines struggle to parse it. Use H2/H3 subheadings to break content into clear sections.",
        { count: i.signals.headingCount },
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
      const missing = i.signals.imageCount - i.signals.imagesWithAlt;
      return {
        score: clamp01(ratio),
        detail: `${i.signals.imagesWithAlt} of ${i.signals.imageCount} images have alt text.`,
        recommendation:
          ratio < 0.9
            ? "Images without alt text are invisible to screen-reader users and to image search. Add descriptive alt text to every meaningful image."
            : undefined,
        evidence:
          missing > 0
            ? { count: missing, sample: i.signals.imagesMissingAltSample }
            : { count: 0 },
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
        "Few internal links means visitors and crawlers can’t reach your key pages from the homepage. Link out to your services, contact, and about pages.",
        { count: i.signals.internalLinks },
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
        "Without a canonical tag, search engines can split your ranking across duplicate URLs. Add a canonical link tag pointing to the preferred version of each page.",
        i.signals.canonical ? { found: i.signals.canonical } : undefined,
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
            ? "Local searchers looking for a business near them won’t find you without clear location signals. Add LocalBusiness structured data and a visible name, address, and phone number."
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
        "If visitors can’t find how to reach you, they move on to a competitor who makes it easy. Add a clearly linked contact page with email and enquiry options.",
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
        "A visible address reassures visitors you’re a real, local business and feeds local search. Show your business address, ideally in the footer of every page.",
        i.signals.addressMatch ? { snippet: i.signals.addressMatch.trim().slice(0, 120) } : undefined,
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
        "Many prospective customers want to call before they buy — without a visible number, those enquiries are lost. Show a clickable phone number (tel: link) prominently in the header.",
        i.signals.phoneSample ? { found: i.signals.phoneSample.trim() } : undefined,
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
        "Reviews are often the deciding factor for a new customer. Display testimonials and star ratings so visitors can see others trust you.",
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
        "Visitors want proof of your results before they commit. Add a before/after or results gallery to demonstrate outcomes.",
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
        "A privacy policy is required under UK GDPR and signals to visitors that their data is handled responsibly. Publish and link one.",
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
        "Clear terms set expectations and add to your credibility. Add a terms & conditions page.",
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
        "Visitors trust named, real people more than a faceless business. Add an about/team page with names and credentials.",
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
        "If the page doesn’t tell visitors what to do next, most do nothing. Add a prominent primary call to action (e.g. “Get in touch” or “Book now”) above the fold.",
        { count: i.signals.ctaPhrases },
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
        "A form lets interested visitors reach you the moment they’re ready, instead of leaving to think about it. Add a short enquiry form on the page.",
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
        "Many people prefer to book outside office hours rather than phone during the day. Offer online booking so visitors can self-schedule.",
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
        "On a phone, a number that isn’t tappable adds friction — and mobile visitors who’d have called give up. Add a tap-to-call (tel:) button.",
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
        "Most visitors are on phones — if the page isn’t mobile-responsive, they leave before converting. Make sure the site adapts to small screens.",
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
            ? "AI assistants often quote FAQ answers directly when recommending a business. Add an FAQ section, marked up with FAQPage structured data, covering the questions customers actually ask."
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
        "AI tools can only describe and recommend services they can read about. Publish a detailed page for each treatment so your offering is discoverable.",
      ),
  },
  {
    id: "structured_data",
    label: "Structured data",
    category: "ai_readiness",
    weight: 2,
    severity: "high",
    run: (i) => {
      const n = i.signals.structuredDataCount;
      const types = [...new Set(i.signals.structuredDataTypes)];
      return {
        score: n === 0 ? 0 : n === 1 ? 0.7 : 1,
        detail:
          n === 0
            ? "No structured data (JSON-LD or microdata) was found."
            : `${n} structured-data block(s) found (${types.join(", ") || "untyped"}).`,
        recommendation:
          n < 2
            ? "Structured data is how search engines and AI models reliably read your business details. Add JSON-LD markup (LocalBusiness, Service, FAQPage) so they describe you accurately."
            : undefined,
        evidence:
          n === 0 ? { count: 0 } : { count: n, sample: types.length ? types : undefined },
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
        "Search engines and AI models weight named expertise (E-E-A-T) when deciding who to recommend. Show the real people behind your business, with their credentials and experience.",
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
            ? "When AI assistants summarise your reputation, they lean on machine-readable reviews. Publish reviews with Review/AggregateRating structured data."
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
            ? "Thin pages give AI assistants little to draw on when answering questions about your field. Add substantive, helpful content such as treatment explainers and guides."
            : undefined,
        evidence: { count: i.signals.textLength },
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
      evidence: r.evidence,
    };
  });
}
