const PRODUCTION_APP_URL = "https://www.leadclaw.uk";

const FREE_EMAIL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "yahoo.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
];

const SOCIAL_PROFILE_HOSTS = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "x.com",
  "twitter.com",
  "youtube.com",
  "tiktok.com",
];

const BOOKING_PLATFORM_HOSTS = [
  "bookings.gettimely.com",
  "gettimely.com",
  "book.app",
  "fresha.com",
  "treatwell.co.uk",
  "calendly.com",
  "booksy.com",
  "phorest.com",
  "square.site",
  "heygoldie.com",
  "setmore.com",
  "acuityscheduling.com",
  "simplybook.me",
  "vagaro.com",
];

const DIRECTORY_LISTING_HOSTS = [
  "yell.com",
  "cylex-uk.co.uk",
  "find-open.co.uk",
  "nicelocal.co.uk",
  "thomsonlocal.com",
  "192.com",
  "locaji.co.uk",
  "newukmapinfo.top",
  "checkatrade.com",
  "mybuilder.com",
  "ratedpeople.com",
  "trustatrader.com",
  "bark.com",
  "houzz.co.uk",
];

export type WebsiteQuality =
  | "business_website"
  | "social_profile"
  | "booking_platform"
  | "directory_listing"
  | "unknown";

export type LeadEnrichmentRow = {
  id: string;
  company_name: string | null;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  city: string | null;
  niche: string | null;
  source: string | null;
  status: string | null;
  score: number | null;
  lead_score: number | null;
  google_rating: number | string | null;
  review_count: number | null;
  has_live_chat: boolean | null;
  has_contact_form: boolean | null;
  pecr_classification: string | null;
  pecr_reason: string | null;
  company_number: string | null;
  lead_quality_score: number | null;
  lead_quality_reason: string | null;
  outreach_subject: string | null;
  outreach_message: string | null;
};

export type LeadEnrichmentPatch = {
  pecr_classification?: string;
  pecr_reason?: string;
  pecr_classified_at?: string;
  lead_quality_score?: number;
  lead_quality_reason?: string;
  outreach_subject?: string;
  outreach_message?: string;
};

export type LeadEnrichmentBuildResult = {
  patch: LeadEnrichmentPatch;
  skippedReasons: string[];
};

export const LEAD_ENRICHMENT_SELECT =
  "id,company_name,website,contact_email,contact_phone,city,niche,source,status,score,lead_score,google_rating,review_count,has_live_chat,has_contact_form,pecr_classification,pecr_reason,company_number,lead_quality_score,lead_quality_reason,outreach_subject,outreach_message";

function normalizeNiche(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
}

function normalizeEmail(raw: unknown) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^mailto:/, "")
    .replace(/\s+/g, "");
}

function emailDomain(email: string) {
  return email.split("@")[1] || "";
}

function isValidEmail(email: string) {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email);
}

function isFreeEmail(email: string) {
  const domain = emailDomain(email);
  return FREE_EMAIL_DOMAINS.includes(domain);
}

function hasHttpsWebsite(raw: string | null) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .startsWith("https://");
}

function hasPhone(raw: string | null) {
  return Boolean(String(raw || "").trim());
}

function normalizeHost(raw: string) {
  return raw.trim().toLowerCase().replace(/^www\./, "");
}

function hostMatches(host: string, knownHosts: string[]) {
  const normalized = normalizeHost(host);
  return knownHosts.some(
    (knownHost) =>
      normalized === knownHost || normalized.endsWith(`.${knownHost}`),
  );
}

export function classifyWebsiteQuality(raw: string | null | undefined): WebsiteQuality {
  const value = String(raw || "").trim();
  if (!value) return "unknown";

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    try {
      parsed = new URL(`https://${value}`);
    } catch {
      return "unknown";
    }
  }

  if (!["http:", "https:"].includes(parsed.protocol)) return "unknown";

  const host = normalizeHost(parsed.hostname);
  if (!host || !host.includes(".")) return "unknown";

  if (hostMatches(host, SOCIAL_PROFILE_HOSTS)) return "social_profile";
  if (hostMatches(host, BOOKING_PLATFORM_HOSTS)) return "booking_platform";
  if (hostMatches(host, DIRECTORY_LISTING_HOSTS) || host.includes("directory")) {
    return "directory_listing";
  }

  return "business_website";
}

function leadQualityBand(score: number) {
  if (score <= 30) return "Poor";
  if (score <= 60) return "Medium";
  if (score <= 80) return "Good";
  return "Hot";
}

function nicheLine(niche?: string | null) {
  const normalized = normalizeNiche(niche);

  if (["plumber", "plumbers", "plumbing"].includes(normalized)) {
    return "For plumbing businesses, emergency callouts, leak enquiries, and quote requests often arrive when you are already on a job, driving, or out of hours.";
  }

  if (["heating", "heating_engineer", "heating_engineers"].includes(normalized)) {
    return "For plumbing and heating businesses, emergency callouts and boiler enquiries often happen when you are already on a job, driving, or out of hours.";
  }

  if (["electrician", "electricians", "electrical"].includes(normalized)) {
    return "For electrical contractors, quote requests and urgent callouts can arrive while you are on-site and unable to respond straight away.";
  }

  if (["roofer", "roofers", "roofing"].includes(normalized)) {
    return "For roofing businesses, storm damage enquiries, repair requests, and quote forms can arrive fast, especially when you are already out on a job.";
  }

  if (["estate_agent", "estate_agents", "estate-agents", "property"].includes(normalized)) {
    return "For estate agents, valuation requests and viewing enquiries can be lost if nobody follows up quickly.";
  }

  if (
    [
      "beauty",
      "aesthetic",
      "aesthetics",
      "aesthetic_clinic",
      "aesthetic_clinics",
      "beauty_clinic",
      "beauty_clinics",
    ].includes(normalized)
  ) {
    return "For clinics, treatment enquiries and consultation requests often arrive while reception is busy or outside opening hours.";
  }

  return "For UK service businesses, missed calls, quote requests, and after-hours enquiries can turn into lost work if nobody replies quickly.";
}

function nicheDescription(niche?: string | null) {
  const normalized = normalizeNiche(niche);

  if (["plumber", "plumbers", "plumbing"].includes(normalized)) return "plumbing business";
  if (["heating", "heating_engineer", "heating_engineers"].includes(normalized)) return "plumbing and heating business";
  if (["electrician", "electricians", "electrical"].includes(normalized)) return "electrical contractor";
  if (["roofer", "roofers", "roofing"].includes(normalized)) return "roofing business";
  if (["estate_agent", "estate_agents", "estate-agents", "property"].includes(normalized)) return "estate agency";

  if (
    [
      "beauty",
      "aesthetic",
      "aesthetics",
      "aesthetic_clinic",
      "aesthetic_clinics",
      "beauty_clinic",
      "beauty_clinics",
    ].includes(normalized)
  ) {
    return "clinic";
  }

  return normalized ? "service business" : "";
}

// Strong, legal-entity-level corporate markers (Ltd / Limited / LLP / PLC).
const CORPORATE_SUFFIX_PATTERN = /\b(ltd|limited|llp|plc)\b/i;

// VAT reference, e.g. "VAT", "VAT No", or a GB VAT number "GB123456789".
const VAT_REFERENCE_PATTERN = /\bvat\b|\bgb\s?\d{9}\b/i;

// UK mobile number: 07xxxxxxxxx or +447xxxxxxxxx (ignoring spaces).
const UK_MOBILE_PATTERN = /^(?:\+?44|0)7\d{9}$/;

// Personal-name branding, e.g. "John Smith", "Dave Jones Plumbing".
const PERSONAL_NAME_PATTERN = /^[A-Z][a-z]+(?:'s)?\s+[A-Z][a-z]+/;

function isUkMobile(raw: string | null) {
  const digits = String(raw || "").replace(/[\s()-]/g, "");
  return UK_MOBILE_PATTERN.test(digits);
}

function looksLikePersonalName(companyName: string) {
  if (!companyName) return false;
  if (CORPORATE_SUFFIX_PATTERN.test(companyName)) return false;
  return PERSONAL_NAME_PATTERN.test(companyName.trim());
}

function hasVatReference(companyName: string) {
  return VAT_REFERENCE_PATTERN.test(companyName);
}

export type PecrClassification =
  | "likely_corporate"
  | "likely_sole_trader"
  | "manual_review";

export type PecrClassificationResult = {
  classification: PecrClassification;
  reason: string;
};

/**
 * Confidence-based PECR classifier.
 *
 * Weighs corporate signals against sole-trader signals and only commits to a
 * confident classification when one side clearly dominates. Anything ambiguous,
 * conflicting, or under-evidenced falls back to manual_review.
 *
 * Signals (corporate): Ltd/Limited/LLP/PLC in the name, a registered company
 * number, a VAT reference, a business-domain email, a company website, and a
 * discovered contact page.
 *
 * Signals (sole trader): a free email domain (Gmail/Outlook/Hotmail/Yahoo/etc.),
 * personal-name branding, a mobile-only phone number, and an overall absence of
 * any company details.
 */
export function classifyPecrConservatively(
  lead: LeadEnrichmentRow,
): PecrClassificationResult {
  const companyName = String(lead.company_name || "").trim();
  const email = normalizeEmail(lead.contact_email);
  const validEmail = email && isValidEmail(email) ? email : "";
  const websiteQuality = classifyWebsiteQuality(lead.website);
  const hasBusinessWebsite = websiteQuality === "business_website";

  const hasCorporateSuffix = CORPORATE_SUFFIX_PATTERN.test(companyName);
  const hasCompanyNumber = Boolean(String(lead.company_number || "").trim());
  const hasVat = hasVatReference(companyName);
  const hasBusinessEmail = Boolean(validEmail) && !isFreeEmail(validEmail);

  const hasAnyCompanyDetail =
    hasCorporateSuffix || hasCompanyNumber || hasVat || hasBusinessWebsite;

  // --- Corporate signals -------------------------------------------------
  const corporateSignals: string[] = [];
  let corporateScore = 0;

  if (hasCompanyNumber) {
    corporateScore += 3;
    corporateSignals.push(`registered company number (${lead.company_number})`);
  }
  if (hasCorporateSuffix) {
    corporateScore += 3;
    corporateSignals.push("Ltd/LLP/PLC company name");
  }
  if (hasVat) {
    corporateScore += 3;
    corporateSignals.push("VAT reference");
  }
  if (hasBusinessEmail) {
    corporateScore += 2;
    corporateSignals.push("business-domain email");
  }
  if (hasBusinessWebsite) {
    corporateScore += 1;
    corporateSignals.push("company website");
  }
  if (lead.has_contact_form === true) {
    corporateScore += 1;
    corporateSignals.push("contact page present");
  }

  // --- Sole-trader signals ----------------------------------------------
  const soleSignals: string[] = [];
  let soleScore = 0;

  if (validEmail && isFreeEmail(validEmail)) {
    soleScore += 2;
    soleSignals.push("free/personal email domain");
  }
  if (looksLikePersonalName(companyName)) {
    soleScore += 1;
    soleSignals.push("personal-name branding");
  }
  if (isUkMobile(lead.contact_phone)) {
    soleScore += 1;
    soleSignals.push("mobile phone only");
  }
  if (!hasAnyCompanyDetail && (companyName || validEmail || lead.contact_phone)) {
    soleScore += 1;
    soleSignals.push("no registered company details");
  }

  // --- Decision ----------------------------------------------------------
  // Confident corporate: strong corporate evidence that clearly outweighs any
  // sole-trader signals (avoids mislabelling mixed-signal leads).
  if (corporateScore >= 3 && soleScore <= corporateScore - 2) {
    return {
      classification: "likely_corporate",
      reason: `Likely corporate: ${corporateSignals.join(" + ")}.`,
    };
  }

  // Confident sole trader: sole-trader evidence with no corporate signals at all.
  if (soleScore >= 2 && corporateScore === 0) {
    return {
      classification: "likely_sole_trader",
      reason: `Likely sole trader: ${soleSignals.join(" + ")}.`,
    };
  }

  // Everything else is ambiguous, conflicting, or under-evidenced.
  if (corporateScore === 0 && soleScore === 0) {
    return {
      classification: "manual_review",
      reason: "Insufficient confidence: no corporate or sole-trader signals found.",
    };
  }

  const mixedSignals = [
    corporateSignals.length
      ? `corporate (${corporateSignals.join(", ")})`
      : "",
    soleSignals.length ? `sole trader (${soleSignals.join(", ")})` : "",
  ].filter(Boolean);

  return {
    classification: "manual_review",
    reason: `Insufficient confidence: mixed or weak signals — ${mixedSignals.join("; ")}.`,
  };
}

export function scoreLeadQualityConservatively(
  lead: LeadEnrichmentRow,
  classification: string | null,
  reason: string | null,
) {
  void classification;
  void reason;

  const email = normalizeEmail(lead.contact_email);
  const reasons: string[] = [];
  let score = 0;
  const websiteQuality = classifyWebsiteQuality(lead.website);

  if (websiteQuality === "business_website") {
    score += 20;
    reasons.push("+20 business website");
  } else if (websiteQuality === "booking_platform") {
    score += 10;
    reasons.push("+10 booking platform website");
  } else if (websiteQuality === "social_profile") {
    score += 5;
    reasons.push("+5 social profile");
  } else if (websiteQuality === "directory_listing") {
    reasons.push("+0 directory listing");
  } else if (lead.website) {
    reasons.push("+0 unknown website quality");
  }

  if (email && isValidEmail(email)) {
    score += 25;
    reasons.push("+25 valid email found");
  }

  if (hasPhone(lead.contact_phone)) {
    score += 15;
    reasons.push("+15 phone present");
  }

  if (hasHttpsWebsite(lead.website)) {
    score += 10;
    reasons.push("+10 HTTPS website");
  }

  if (lead.has_contact_form === true) {
    score += 10;
    reasons.push("+10 contact page discovered");
  }

  const rating = Number(lead.google_rating);
  if (Number.isFinite(rating) && rating >= 4.5) {
    score += 10;
    reasons.push("+10 Google rating >= 4.5");
  }

  const reviewCount = Number(lead.review_count);
  if (Number.isFinite(reviewCount) && reviewCount >= 20) {
    score += 10;
    reasons.push("+10 review count >= 20");
  }

  const finalScore = Math.max(0, Math.min(100, score));
  const band = leadQualityBand(finalScore);

  return {
    score: finalScore,
    reason:
      reasons.length > 0
        ? `${band} lead quality (${finalScore}): ${reasons.join("; ")}`
        : `${band} lead quality (${finalScore}): No scoring signals found`,
  };
}

export function buildOutreachSubject(companyName: string) {
  return `Quick idea for ${companyName}`;
}

export function buildOutreachMessage(lead: LeadEnrichmentRow) {
  const company = String(lead.company_name || "").trim();
  const normalizedEmail = normalizeEmail(lead.contact_email);
  const email = isValidEmail(normalizedEmail) ? normalizedEmail : "";
  const city = String(lead.city || "").trim();
  const industry = nicheDescription(lead.niche);
  const locationText = city ? ` in ${city}` : "";
  const industryText = industry ? ` as a ${industry}` : "";
  const demoUrl = `${PRODUCTION_APP_URL}/demo?source=outreach&lead=${encodeURIComponent(lead.id)}`;
  const unsubscribeUrl = email
    ? `${PRODUCTION_APP_URL}/api/unsubscribe?email=${encodeURIComponent(email)}`
    : `${PRODUCTION_APP_URL}/api/unsubscribe`;

  return `Hi ${company} team,

A quick idea for ${company}${locationText}${industryText}.

For many service businesses, missed calls, quote requests, and after-hours enquiries are easy to lose when nobody replies quickly. Often the next thing a customer does is try another local business.

${nicheLine(lead.niche)}

LeadClaw is an AI receptionist for UK service businesses. It can answer common website enquiries, capture quote requests, collect callback details, and help turn visitors into booked jobs. It works 24/7 when the business is busy, on-site, or closed.

I put together a personalised demo for ${company}:
${demoUrl}

If it looks useful, you can try LeadClaw without a long setup and see whether it helps ${company} respond faster.

LeadClaw is built by Claw Labs, a UK software and automation company.

Best,
Kris Ninnis
Founder, LeadClaw

---
Lead Claw Ltd (Company No. 13546017)
206 Whitechapel Road, London, E1 1AA
We found your business on Google Maps.
Privacy policy: ${PRODUCTION_APP_URL}/legal/privacy
Data rights: privacy@leadclaw.uk
Unsubscribe: ${unsubscribeUrl}`;
}

export function buildLeadEnrichmentPatch(
  lead: LeadEnrichmentRow,
  now = new Date().toISOString(),
): LeadEnrichmentBuildResult {
  const patch: LeadEnrichmentPatch = {};
  const skippedReasons: string[] = [];
  const companyName = String(lead.company_name || "").trim();
  const email = normalizeEmail(lead.contact_email);
  const hasWebsiteOrPhone = Boolean(
    String(lead.website || "").trim() || String(lead.contact_phone || "").trim(),
  );

  const pecr = lead.pecr_classification
    ? {
        classification: lead.pecr_classification,
        reason: lead.pecr_reason || "Existing PECR classification preserved.",
      }
    : classifyPecrConservatively(lead);

  if (!lead.pecr_classification) {
    patch.pecr_classification = pecr.classification;
    patch.pecr_reason = pecr.reason;
    patch.pecr_classified_at = now;
  }

  const quality = scoreLeadQualityConservatively(
    lead,
    pecr.classification,
    pecr.reason,
  );

  if (lead.lead_quality_score === null || lead.lead_quality_score === undefined) {
    patch.lead_quality_score = quality.score;
    patch.lead_quality_reason = quality.reason;
  }

  if (!companyName) {
    skippedReasons.push("missing_company_name");
  }

  if (email && !isValidEmail(email)) {
    skippedReasons.push("invalid_contact_email");
  }

  if (!hasWebsiteOrPhone) {
    skippedReasons.push("missing_website_or_phone");
  }

  if (companyName && hasWebsiteOrPhone) {
    if (!lead.outreach_subject) {
      patch.outreach_subject = buildOutreachSubject(companyName);
    }

    if (!lead.outreach_message) {
      patch.outreach_message = buildOutreachMessage(lead);
    }
  }

  return { patch, skippedReasons };
}
