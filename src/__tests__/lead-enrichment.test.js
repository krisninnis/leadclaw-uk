const {
  buildLeadEnrichmentPatch,
  scoreLeadQualityConservatively,
} = require("@/lib/lead-enrichment");

function makeLead(overrides = {}) {
  return {
    id: "lead_1",
    company_name: "Example Services Ltd",
    website: null,
    contact_email: null,
    contact_phone: null,
    city: "Leeds",
    niche: "plumber",
    source: "google-places",
    status: "new",
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

describe("lead quality scoring", () => {
  it("scores all requested signals as a hot 100 lead", () => {
    const result = scoreLeadQualityConservatively(
      makeLead({
        website: "https://example-services.co.uk",
        contact_email: "info@example-services.co.uk",
        contact_phone: "0113 000 0000",
        has_contact_form: true,
        google_rating: 4.8,
        review_count: 42,
      }),
      "corporate",
      "Existing PECR classification preserved.",
    );

    expect(result.score).toBe(100);
    expect(result.reason).toContain("Hot lead quality (100)");
    expect(result.reason).toContain("+20 website present");
    expect(result.reason).toContain("+25 valid email found");
    expect(result.reason).toContain("+15 phone present");
    expect(result.reason).toContain("+10 HTTPS website");
    expect(result.reason).toContain("+10 contact page discovered");
    expect(result.reason).toContain("+10 Google rating >= 4.5");
    expect(result.reason).toContain("+10 review count >= 20");
  });

  it("scores website, email, and phone as medium without extra signals", () => {
    const result = scoreLeadQualityConservatively(
      makeLead({
        website: "http://example-services.co.uk",
        contact_email: "hello@example-services.co.uk",
        contact_phone: "0113 000 0000",
      }),
      null,
      null,
    );

    expect(result.score).toBe(60);
    expect(result.reason).toContain("Medium lead quality (60)");
  });

  it("scores website and phone above zero even when email is missing", () => {
    const result = scoreLeadQualityConservatively(
      makeLead({
        website: "https://example-services.co.uk",
        contact_phone: "0113 000 0000",
      }),
      null,
      null,
    );

    expect(result.score).toBe(45);
    expect(result.reason).toContain("Medium lead quality (45)");
    expect(result.reason).not.toContain("valid email found");
  });

  it("does not award email points for invalid addresses", () => {
    const result = scoreLeadQualityConservatively(
      makeLead({
        website: "https://example-services.co.uk",
        contact_email: "not-an-email",
        contact_phone: "0113 000 0000",
      }),
      null,
      null,
    );

    expect(result.score).toBe(45);
    expect(result.reason).not.toContain("+25 valid email found");
  });

  it.each([
    [makeLead({ contact_phone: "0113 000 0000" }), 15, "Poor"],
    [
      makeLead({
        website: "https://example-services.co.uk",
        contact_phone: "0113 000 0000",
        has_contact_form: true,
      }),
      55,
      "Medium",
    ],
    [
      makeLead({
        website: "https://example-services.co.uk",
        contact_email: "info@example-services.co.uk",
        contact_phone: "0113 000 0000",
      }),
      70,
      "Good",
    ],
    [
      makeLead({
        website: "https://example-services.co.uk",
        contact_email: "info@example-services.co.uk",
        contact_phone: "0113 000 0000",
        has_contact_form: true,
        google_rating: 4.5,
        review_count: 20,
      }),
      100,
      "Hot",
    ],
  ])("labels score %s as %s", (lead, expectedScore, expectedBand) => {
    const result = scoreLeadQualityConservatively(lead, null, null);

    expect(result.score).toBe(expectedScore);
    expect(result.reason).toContain(`${expectedBand} lead quality (${expectedScore})`);
  });

  it("puts the upgraded score and reason into the enrichment patch", () => {
    const { patch } = buildLeadEnrichmentPatch(
      makeLead({
        website: "https://example-services.co.uk",
        contact_email: "info@example-services.co.uk",
        contact_phone: "0113 000 0000",
        has_contact_form: true,
        google_rating: "4.9",
        review_count: 120,
      }),
      "2026-06-15T12:00:00.000Z",
    );

    expect(patch.lead_quality_score).toBe(100);
    expect(patch.lead_quality_reason).toContain("Hot lead quality (100)");
    expect(patch.outreach_subject).toBe("Quick idea for Example Services Ltd");
  });
});
