// Phase 1 — PECR Classification V2
// Unit tests for the confidence-based PECR classifier (pure, no DB / network).

import { classifyPecrConservatively } from "@/lib/lead-enrichment";
import type { LeadEnrichmentRow } from "@/lib/lead-enrichment";

// Build a LeadEnrichmentRow with sensible empty defaults; override per test.
function leadFrom(overrides: Partial<LeadEnrichmentRow> = {}): LeadEnrichmentRow {
  return {
    id: "lead-1",
    company_name: null,
    website: null,
    contact_email: null,
    contact_phone: null,
    city: null,
    niche: null,
    source: null,
    status: null,
    score: null,
    lead_score: null,
    google_rating: null,
    review_count: null,
    has_live_chat: null,
    has_contact_form: null,
    pecr_classification: null,
    pecr_reason: null,
    company_number: null,
    lead_quality_score: null,
    lead_quality_reason: null,
    outreach_subject: null,
    outreach_message: null,
    ...overrides,
  };
}

const allowedClassifications = [
  "likely_corporate",
  "likely_sole_trader",
  "manual_review",
];

function expectAllowed(classification: string) {
  expect(allowedClassifications).toContain(classification);
  expect(classification).not.toBe("corporate");
  expect(classification).not.toBe("unknown");
}

describe("classifyPecrConservatively", () => {
  it("classifies an Ltd company with business signals as likely_corporate", () => {
    const result = classifyPecrConservatively(
      leadFrom({
        company_name: "Smith & Sons Plumbing Ltd",
        contact_email: "info@smithplumbing.co.uk",
        website: "https://smithplumbing.co.uk",
      }),
    );

    expect(result.classification).toBe("likely_corporate");
    expect(result.reason).toContain("Ltd/LLP/PLC company name");
  });

  it("classifies a business-email lead as likely_corporate", () => {
    const result = classifyPecrConservatively(
      leadFrom({
        company_name: "Acme Heating Services",
        contact_email: "contact@acmeheating.co.uk",
        website: "https://acmeheating.co.uk",
        has_contact_form: true,
      }),
    );

    expect(result.classification).toBe("likely_corporate");
    expect(result.reason).toContain("business-domain email");
  });

  it("classifies a Gmail-using business as likely_sole_trader", () => {
    const result = classifyPecrConservatively(
      leadFrom({
        company_name: "Dave's Mobile Mechanics",
        contact_email: "davesmechanics@gmail.com",
        contact_phone: "07700900123",
      }),
    );

    expect(result.classification).toBe("likely_sole_trader");
    expect(result.reason).toContain("free/personal email domain");
  });

  it("classifies a mobile-only business with a personal name as likely_sole_trader", () => {
    const result = classifyPecrConservatively(
      leadFrom({
        company_name: "John Smith Joinery",
        contact_phone: "07911 123456",
      }),
    );

    expect(result.classification).toBe("likely_sole_trader");
    expect(result.reason).toContain("mobile phone only");
  });

  it("falls back to manual_review when data is missing", () => {
    const result = classifyPecrConservatively(leadFrom());

    expect(result.classification).toBe("manual_review");
    expect(result.reason).toContain("Insufficient confidence");
  });

  it("falls back to manual_review on conflicting (mixed) signals", () => {
    const result = classifyPecrConservatively(
      leadFrom({
        company_name: "Bright Spark Electrical Ltd",
        contact_email: "brightspark@gmail.com",
        contact_phone: "07700900456",
      }),
    );

    expect(result.classification).toBe("manual_review");
    expect(result.reason).toContain("mixed or weak signals");
  });

  it("treats a VAT reference as a corporate signal", () => {
    const result = classifyPecrConservatively(
      leadFrom({
        company_name: "Northgate Builders VAT GB123456789",
        contact_email: "office@northgatebuilders.co.uk",
      }),
    );

    expect(result.classification).toBe("likely_corporate");
    expect(result.reason).toContain("VAT reference");
  });

  it("uses a registered company number as a corporate signal", () => {
    const result = classifyPecrConservatively(
      leadFrom({
        company_name: "Riverside Roofing",
        company_number: "09876543",
        contact_email: "hello@riversideroofing.co.uk",
      }),
    );

    expect(result.classification).toBe("likely_corporate");
    expect(result.reason).toContain("registered company number");
  });

  it("falls back to heuristic classification when Companies House key is missing", () => {
    const result = classifyPecrConservatively(
      leadFrom({
        company_name: "Form Clinics",
        website: "https://formclinics.co.uk",
        contact_email: "hello@formclinics.co.uk",
        pecr_reason: "No Companies House API key configured",
      }),
    );

    expectAllowed(result.classification);
    expect(result.classification).toBe("likely_corporate");
    expect(result.classification).not.toBe("unknown");
  });

  it("sends dissolved company matches to manual_review", () => {
    const result = classifyPecrConservatively(
      leadFrom({
        company_name: "Example Beauty Ltd",
        company_number: "01234567",
        contact_email: "info@examplebeauty.co.uk",
        pecr_reason: "Company found but status is dissolved",
      }),
    );

    expectAllowed(result.classification);
    expect(result.classification).toBe("manual_review");
  });

  it("sends liquidation company matches to manual_review", () => {
    const result = classifyPecrConservatively(
      leadFrom({
        company_name: "Example Salon Ltd",
        company_number: "07654321",
        contact_email: "info@examplesalon.co.uk",
        pecr_reason: "Company found but status is liquidation",
      }),
    );

    expectAllowed(result.classification);
    expect(result.classification).toBe("manual_review");
  });

  it("classifies active Ltd company evidence as likely_corporate", () => {
    const result = classifyPecrConservatively(
      leadFrom({
        company_name: "Active Clinic Ltd",
        company_number: "12345678",
        contact_email: "info@activeclinic.co.uk",
        website: "https://activeclinic.co.uk",
        pecr_reason: "Companies House active company match.",
      }),
    );

    expectAllowed(result.classification);
    expect(result.classification).toBe("likely_corporate");
  });

  it("classifies Gmail personal-name business as likely_sole_trader", () => {
    const result = classifyPecrConservatively(
      leadFrom({
        company_name: "Sarah Jones Beauty",
        contact_email: "sarahjonesbeauty@gmail.com",
        contact_phone: "07700 900123",
      }),
    );

    expectAllowed(result.classification);
    expect(result.classification).toBe("likely_sole_trader");
  });

  it("keeps website and phone only leads inside allowed labels", () => {
    const result = classifyPecrConservatively(
      leadFrom({
        company_name: "Antonacci Hair & Aesthetic",
        website: "https://antonacci.example",
        contact_phone: "0113 000 0000",
      }),
    );

    expectAllowed(result.classification);
    expect(result.classification).toBe("manual_review");
  });
});
