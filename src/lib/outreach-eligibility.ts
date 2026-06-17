export type EmailQuality = "high" | "medium" | "low" | "invalid";

export type OutreachEligibilityLead = {
  contact_email?: string | null;
  pecr_classification?: string | null;
  outreach_status?: string | null;
  status?: string | null;
  unsubscribed_at?: string | null;
  do_not_contact?: boolean | null;
};

export type OutreachEligibilityResult = {
  eligible: boolean;
  reasons: string[];
  email_quality: EmailQuality;
};

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

const PLACEHOLDER_EMAILS = new Set([
  "user@domain.com",
  "info@example.com",
  "hello@example.com",
  "test@example.com",
  "admin@example.com",
]);

const INVALID_LOCAL_PARTS = [
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "example",
  "test",
  "admin",
  "webmaster",
];

const ROLE_BASED_LOCAL_PARTS = [
  "info",
  "hello",
  "contact",
  "enquiries",
  "enquiry",
  "sales",
  "reception",
  "office",
  "bookings",
  "booking",
  "team",
];

function normaliseEmail(email: string | null | undefined): string {
  return (email || "").trim().toLowerCase();
}

function getEmailParts(email: string): { local: string; domain: string } | null {
  const match = email.match(/^([^@\s]+)@([^@\s]+\.[^@\s]+)$/);
  if (!match) return null;

  return {
    local: match[1],
    domain: match[2],
  };
}

export function classifyEmailQuality(email: string | null | undefined): EmailQuality {
  const cleanEmail = normaliseEmail(email);

  if (!cleanEmail) return "invalid";
  if (PLACEHOLDER_EMAILS.has(cleanEmail)) return "invalid";
  if (cleanEmail.includes("%20")) return "invalid";

  const parts = getEmailParts(cleanEmail);
  if (!parts) return "invalid";

  const { local, domain } = parts;

  if (INVALID_LOCAL_PARTS.some((part) => local === part || local.startsWith(`${part}.`) || local.startsWith(`${part}-`))) {
    return "invalid";
  }

  if (domain.endsWith(".png") || domain.endsWith(".jpg") || domain.endsWith(".jpeg") || domain.endsWith(".webp")) {
    return "invalid";
  }

  if (FREE_EMAIL_DOMAINS.has(domain)) {
    return "low";
  }

  if (ROLE_BASED_LOCAL_PARTS.includes(local)) {
    return "high";
  }

  return "medium";
}

export function isLeadEligibleForOutreach(
  lead: OutreachEligibilityLead,
  suppressedEmails: string[] = [],
): OutreachEligibilityResult {
  const reasons: string[] = [];
  const cleanEmail = normaliseEmail(lead.contact_email);
  const emailQuality = classifyEmailQuality(cleanEmail);

  if (!cleanEmail) {
    reasons.push("missing_email");
  }

  if (emailQuality === "invalid") {
    reasons.push("invalid_email");
  }

  if (emailQuality === "low") {
    reasons.push("low_quality_email");
  }

  if (lead.pecr_classification !== "likely_corporate") {
    reasons.push("not_likely_corporate");
  }

  if (lead.unsubscribed_at) {
    reasons.push("unsubscribed");
  }

  if (lead.do_not_contact) {
    reasons.push("do_not_contact");
  }

  const status = (lead.outreach_status || lead.status || "").toLowerCase();
  if (["sent", "contacted", "replied", "unsubscribed", "do_not_contact"].includes(status)) {
    reasons.push("already_contacted");
  }

  const suppressed = new Set(suppressedEmails.map(normaliseEmail));
  if (cleanEmail && suppressed.has(cleanEmail)) {
    reasons.push("suppressed");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    email_quality: emailQuality,
  };
}
