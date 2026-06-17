import { describe, it, expect } from "@jest/globals";
import { renderOutreachTemplate, type OutreachTemplateLead } from "../lib/outreach-templates";

describe("renderOutreachTemplate", () => {
  const mockLead: OutreachTemplateLead = {
    company_name: "Acme Corp",
    city: "London",
    website: "https://acme.example",
    niche: "clinic",
    contact_email: "info@acme.example",
    lead_quality_score: 95,
    pecr_classification: "likely_corporate",
  };

  it("replaces all supported variables successfully", () => {
    const subjectTpl = "Quick check for {{company_name}}";
    const bodyTpl = "Hello,\n\nWe found {{company_name}} located in {{city}}. We checked your site at {{website}} and noticed you are a {{niche}} business. Emailing you at {{contact_email}} since you have a quality score of {{lead_quality_score}} and PECR class of {{pecr_classification}}.";

    const { subject, body } = renderOutreachTemplate(subjectTpl, bodyTpl, mockLead);

    expect(subject).toBe("Quick check for Acme Corp");
    expect(body).toBe("Hello,\n\nWe found Acme Corp located in London. We checked your site at https://acme.example and noticed you are a clinic business. Emailing you at info@acme.example since you have a quality score of 95 and PECR class of likely_corporate.");
  });

  it("handles whitespace variations inside braces", () => {
    const subjectTpl = "Check {{  company_name  }}";
    const bodyTpl = "Hello {{city}} and niche {{ niche}}.";

    const { subject, body } = renderOutreachTemplate(subjectTpl, bodyTpl, mockLead);

    expect(subject).toBe("Check Acme Corp");
    expect(body).toBe("Hello London and niche clinic.");
  });

  it("uses fallback empty strings for missing/null lead details", () => {
    const emptyLead: OutreachTemplateLead = {
      company_name: null,
      city: undefined,
    };

    const subjectTpl = "Check {{company_name}}";
    const bodyTpl = "From {{city}}.";

    const { subject, body } = renderOutreachTemplate(subjectTpl, bodyTpl, emptyLead);

    expect(subject).toBe("Check ");
    expect(body).toBe("From .");
  });

  it("does not replace unsupported variables", () => {
    const subjectTpl = "Quick hello {{unsupported_var}}";
    const bodyTpl = "Body {{another_var}}";

    const { subject, body } = renderOutreachTemplate(subjectTpl, bodyTpl, mockLead);

    expect(subject).toBe("Quick hello {{unsupported_var}}");
    expect(body).toBe("Body {{another_var}}");
  });
});
