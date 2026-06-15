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

const PLATFORM_EMAIL_DOMAINS = [
  "wix.com",
  "wixpress.com",
  "squarespace.com",
  "wordpress.com",
  "shopify.com",
  "mailchimp.com",
  "sendgrid.net",
  "amazonses.com",
];

const CORPORATE_NAME_PATTERN =
  /\b(ltd|limited|llp|plc|group|holdings|services ltd|contractors ltd)\b/i;

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

function rootDomain(host: string) {
  const parts = host
    .replace(/^www\./, "")
    .split(".")
    .filter(Boolean);

  return parts.length >= 2 ? parts.slice(-2).join(".") : parts.join(".");
}

function websiteHost(raw: string | null) {
  if (!raw) return "";

  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    try {
      return new URL(`https://${raw}`).hostname.toLowerCase();
    } catch {
      return "";
    }
  }
}

function isValidEmail(email: string) {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email);
}

function isFreeEmail(email: string) {
  const domain = emailDomain(email);
  return FREE_EMAIL_DOMAINS.includes(domain);
}

function isPlatformEmail(email: string) {
  const domain = emailDomain(email);
  return PLATFORM_EMAIL_DOMAINS.some((platform) => domain.includes(platform));
}

function isBusinessEmail(email: string) {
  return isValidEmail(email) && !isFreeEmail(email) && !isPlatformEmail(email);
}

function domainMismatch(website: string | null, email: string) {
  const host = websiteHost(website);
  if (!host || !email) return false;

  const siteRoot = rootDomain(host);
  const emailRoot = rootDomain(emailDomain(email));

  return Boolean(siteRoot && emailRoot && siteRoot !== emailRoot);
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

export function classifyPecrConservatively(lead: LeadEnrichmentRow) {
  const companyName = String(lead.company_name || "").trim();
  const email = normalizeEmail(lead.contact_email);

  if (lead.company_number) {
    return {
      classification: "corporate",
      reason: `Corporate company number present (${lead.company_number}).`,
    };
  }

  if (CORPORATE_NAME_PATTERN.test(companyName)) {
    return {
      classification: "corporate",
      reason: "Corporate marker present in business name; backfill did not verify Companies House.",
    };
  }

  if (!email) {
    return {
      classification: "unknown",
      reason: "No contact email available; conservative backfill cannot assess recipient type.",
    };
  }

  if (isFreeEmail(email)) {
    return {
      classification: "unknown",
      reason: "Free email domain; conservative backfill avoids corporate classification.",
    };
  }

  return {
    classification: "unknown",
    reason: "No strong corporate marker; conservative backfill keeps classification unknown.",
  };
}

export function scoreLeadQualityConservatively(
  lead: LeadEnrichmentRow,
  classification: string | null,
  reason: string | null,
) {
  const email = normalizeEmail(lead.contact_email);
  const reasons: string[] = [];
  let score = 0;

  if (classification === "corporate") {
    score += 20;
    reasons.push("+20 corporate classification");
  }

  if (email && isBusinessEmail(email)) {
    score += 15;
    reasons.push("+15 business email");
  }

  if (lead.has_contact_form && !email) {
    score += 15;
    reasons.push("+15 contact-form-only site");
  } else if (lead.has_contact_form && email) {
    score += 10;
    reasons.push("+10 contact form present");
  }

  if (lead.has_live_chat === false) {
    score += 20;
    reasons.push("+20 no live chat");
  }

  const reviewCount = Number(lead.review_count);
  if (Number.isFinite(reviewCount) && reviewCount >= 20 && reviewCount <= 500) {
    score += 15;
    reasons.push("+15 review count 20-500");
  }

  if (lead.website) {
    score += 10;
    reasons.push("+10 website present");
  } else {
    score -= 15;
    reasons.push("-15 no website");
  }

  if (email && isFreeEmail(email)) {
    score -= 10;
    reasons.push("-10 free email provider");
  }

  if (email && domainMismatch(lead.website, email)) {
    score -= 30;
    reasons.push("-30 domain mismatch");
  }

  if (String(reason || "").toLowerCase().includes("dissolved")) {
    score -= 20;
    reasons.push("-20 dissolved company signal");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reason: reasons.join("; ") || "No strong quality signals found",
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
