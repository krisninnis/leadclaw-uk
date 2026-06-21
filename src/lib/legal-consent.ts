// Single source of truth for legal-acceptance versions + consent UI copy.
//
// Pure, isomorphic module: NO server-only imports. It is consumed by client
// components (signup, onboarding wizard, settings), server API routes, and the
// widget bootstrap string builder, so it must stay safe to import anywhere.
//
// UK GDPR role recap (see LEGAL-COMPLIANCE-AUDIT.md):
//   * Customer account/billing data .......... LeadClaw = Controller
//   * Enquiry data via the widget ............ Customer = Controller, LeadClaw = Processor
//   * Cold-outreach scraped prospect data .... LeadClaw = Controller (LIA/PECR)

// Bump these when the corresponding legal document materially changes. They are
// stored alongside each acceptance so we always know which version was agreed.
export const TERMS_VERSION = "2026-02-22";
export const PRIVACY_VERSION = "2026-02-22";
export const WEBSITE_PRIVACY_ACK_VERSION = "2026-06-21";

export const LEGAL_TERMS_URL = "/legal/terms";
export const LEGAL_PRIVACY_URL = "/legal/privacy";
export const LEGAL_DPA_URL = "/legal/dpa";

// Optional marketing consent (Part 2). Kept strictly separate from legal
// acceptance: unticked by default, never required to sign up, changeable later.
export const MARKETING_CONSENT_LABEL =
  "Send me product updates, feature announcements and marketing emails";

// Shown beneath the public widget submit button (Part 3). Enquirer-facing.
export const WIDGET_CONSENT_NOTICE =
  "By submitting this enquiry you agree that the business may contact you regarding your request.";

// Customer (account holder) acknowledgement on the install/setup flow (Part 4).
// Informational only — it does NOT block product usage.
export const WEBSITE_PRIVACY_ACK_LABEL =
  "I have updated my website privacy policy to disclose LeadClaw enquiry processing, and — where I handle health-context enquiries — I understand I may need to explicitly disclose AI processing of that data to my own clients/patients.";

// AI reliability disclaimer (Part 5). Plain-language. Placed in legal/settings/
// help locations only — deliberately NOT in the primary capture UX.
export const AI_DISCLAIMER_TITLE = "About LeadClaw's AI-assisted capture";
export const AI_DISCLAIMER_POINTS: string[] = [
  "LeadClaw provides AI-assisted lead capture and response tools to help you collect and respond to website enquiries.",
  "Automated capture and AI-assisted responses may occasionally contain errors or miss an enquiry. LeadClaw must not be relied on as the sole capture mechanism for anything safety-critical, including medically urgent requests.",
  "You remain responsible for your enquiries, communications, bookings, and customer interactions, including reviewing captured enquiries and following up appropriately.",
];

// Shape returned by GET /api/account/consent and surfaced to the UI.
export type ConsentRecord = {
  acceptedTermsAt: string | null;
  acceptedPrivacyAt: string | null;
  termsVersion: string | null;
  privacyVersion: string | null;
  marketingConsent: boolean;
  marketingConsentUpdatedAt: string | null;
  websitePrivacyAckAt: string | null;
  websitePrivacyAckVersion: string | null;
};
