// Phase 2 — AI Website Audit (V1)
// Extract basic, high-signal facts from raw HTML using lightweight regex.
// Intentionally NOT a full DOM parser — V1 only needs presence/shape signals.
// JS-rendered content is out of scope (documented in the expansion plan).

export type ParsedSignals = {
  // SEO
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  h2Count: number;
  headingCount: number;
  canonical: string | null;
  // Health
  hasFavicon: boolean;
  hasViewportMeta: boolean;
  langAttr: string | null;
  // Links + images
  internalLinks: number;
  externalLinks: number;
  imageCount: number;
  imagesWithAlt: number;
  // Structured data / AI readiness
  jsonLdBlocks: string[];
  jsonLdTypes: string[];
  // Trust + conversion (text/link heuristics)
  hasContactLink: boolean;
  hasPrivacyLink: boolean;
  hasTermsLink: boolean;
  hasAboutLink: boolean;
  hasBookingLink: boolean;
  hasTelLink: boolean;
  hasMailtoLink: boolean;
  hasForm: boolean;
  phoneNumbers: number;
  // Body text for keyword heuristics (FAQ, reviews, address, treatments).
  textLength: number;
  mentionsFaq: boolean;
  mentionsReviews: boolean;
  mentionsAddress: boolean;
  mentionsBeforeAfter: boolean;
  mentionsTeam: boolean;
  mentionsTreatments: boolean;
  ctaPhrases: number;
};

function firstMatch(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m && m[1] ? m[1].trim() : null;
}

function countMatches(html: string, re: RegExp): number {
  const m = html.match(re);
  return m ? m.length : 0;
}

// Strip tags + collapse whitespace for keyword heuristics.
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getHost(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

export function parseHtml(html: string, finalUrl: string | null): ParsedSignals {
  const lower = html.toLowerCase();
  const host = getHost(finalUrl);

  // ---- Title / meta ----
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescription =
    firstMatch(
      html,
      /<meta[^>]+name=["']description["'][^>]*content=["']([\s\S]*?)["']/i,
    ) ||
    firstMatch(
      html,
      /<meta[^>]+content=["']([\s\S]*?)["'][^>]*name=["']description["']/i,
    );

  const canonical = firstMatch(
    html,
    /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i,
  );

  // ---- Headings ----
  const h1Count = countMatches(lower, /<h1[\s>]/g);
  const h2Count = countMatches(lower, /<h2[\s>]/g);
  const headingCount = countMatches(lower, /<h[1-6][\s>]/g);

  // ---- Health signals ----
  const hasFavicon =
    /<link[^>]+rel=["'][^"']*icon[^"']*["']/i.test(html) ||
    /<link[^>]+rel=["']apple-touch-icon["']/i.test(html);
  const hasViewportMeta = /<meta[^>]+name=["']viewport["']/i.test(html);
  const langAttr = firstMatch(html, /<html[^>]+lang=["']([^"']+)["']/i);

  // ---- Links ----
  const anchorHrefs: string[] = [];
  const anchorRe = /<a[^>]+href=["']([^"']+)["']/gi;
  let am: RegExpExecArray | null;
  while ((am = anchorRe.exec(html)) !== null) {
    anchorHrefs.push(am[1]);
  }

  let internalLinks = 0;
  let externalLinks = 0;
  let hasTelLink = false;
  let hasMailtoLink = false;
  for (const href of anchorHrefs) {
    const h = href.toLowerCase();
    if (h.startsWith("tel:")) hasTelLink = true;
    else if (h.startsWith("mailto:")) hasMailtoLink = true;
    else if (h.startsWith("#") || h.startsWith("javascript:")) continue;
    else if (h.startsWith("/") || (host && h.includes(host))) internalLinks++;
    else if (/^https?:\/\//.test(h)) externalLinks++;
    else internalLinks++; // relative path
  }

  const anchorBlob = anchorHrefs.join(" ").toLowerCase() + " " + lower;
  const hasContactLink = /contact/.test(anchorBlob);
  const hasPrivacyLink = /privacy/.test(anchorBlob);
  const hasTermsLink = /terms|t&c|conditions/.test(anchorBlob);
  const hasAboutLink = /about|our team|meet the team/.test(anchorBlob);
  const hasBookingLink = /book|appointment|booking|schedule|reserve/.test(anchorBlob);

  // ---- Images ----
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  const imageCount = imgTags.length;
  const imagesWithAlt = imgTags.filter((t) =>
    /\balt=["'][^"']*["']/i.test(t) && !/\balt=["']\s*["']/i.test(t),
  ).length;

  // ---- Structured data (JSON-LD) ----
  const jsonLdBlocks: string[] = [];
  const ldRe =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let lm: RegExpExecArray | null;
  while ((lm = ldRe.exec(html)) !== null) {
    jsonLdBlocks.push(lm[1].trim());
  }
  const jsonLdTypes: string[] = [];
  for (const block of jsonLdBlocks) {
    const types = block.match(/"@type"\s*:\s*"([^"]+)"/g) || [];
    for (const t of types) {
      const v = t.match(/"@type"\s*:\s*"([^"]+)"/);
      if (v && v[1]) jsonLdTypes.push(v[1]);
    }
  }

  // ---- Forms / CTA ----
  const hasForm = /<form\b/i.test(html);
  const text = visibleText(html);
  const textLower = text.toLowerCase();

  const phoneNumbers = countMatches(
    text,
    /(?:\+?\d[\d\s().-]{7,}\d)/g,
  );

  const ctaPhrases = countMatches(
    textLower,
    /\b(book now|get in touch|contact us|enquire|enquiry|call us|request a callback|free consultation|get a quote|book a consultation|schedule)\b/g,
  );

  return {
    title,
    metaDescription,
    h1Count,
    h2Count,
    headingCount,
    canonical,
    hasFavicon,
    hasViewportMeta,
    langAttr,
    internalLinks,
    externalLinks,
    imageCount,
    imagesWithAlt,
    jsonLdBlocks,
    jsonLdTypes,
    hasContactLink,
    hasPrivacyLink,
    hasTermsLink,
    hasAboutLink,
    hasBookingLink,
    hasTelLink,
    hasMailtoLink,
    hasForm,
    phoneNumbers,
    textLength: text.length,
    mentionsFaq: /\bfaq|frequently asked/.test(textLower),
    mentionsReviews: /\breview|testimonial|rated|google rating|trustpilot|stars\b/.test(textLower),
    mentionsAddress: /\b(street|road|lane|avenue|postcode|[a-z]{1,2}\d{1,2}\s*\d[a-z]{2})\b/i.test(textLower),
    mentionsBeforeAfter: /before\s*(?:&|and|\/)?\s*after|gallery|results/.test(textLower),
    mentionsTeam: /our team|meet the team|our staff|our dentists|our clinicians|founder/.test(textLower),
    mentionsTreatments: /treatment|service|procedure|what we offer|our services/.test(textLower),
    ctaPhrases,
  };
}
