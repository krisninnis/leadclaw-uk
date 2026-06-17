import { describe, expect, it } from "@jest/globals";
import { buildOutreachDraft } from "@/lib/outreach-drafts";
import type { OutreachTemplate } from "@/lib/outreach-templates";

const activeTemplate: OutreachTemplate = {
  id: "template-1",
  name: "Default",
  status: "active",
  subject_template: "Quick idea for {{company_name}}",
  body_template: "Hi {{company_name}}, I saw your website {{website}} in {{city}}.",
};

const archivedTemplate: OutreachTemplate = {
  ...activeTemplate,
  status: "archived",
};

describe("buildOutreachDraft", () => {
  it("builds an eligible draft for a likely corporate lead", () => {
    const result = buildOutreachDraft(
      {
        id: "lead-1",
        company_name: "Acme Clinic",
        contact_email: "info@acmeclinic.co.uk",
        website: "https://acmeclinic.co.uk",
        city: "Cardiff",
        niche: "clinic",
        pecr_classification: "likely_corporate",
      },
      activeTemplate,
    );

    expect(result.eligible).toBe(true);
    expect(result.subject).toBe("Quick idea for Acme Clinic");
    expect(result.body).toBe(
      "Hi Acme Clinic, I saw your website https://acmeclinic.co.uk in Cardiff.",
    );
    expect(result.eligibility.reasons).toEqual([]);
  });

  it("renders a draft even when the lead is not eligible", () => {
    const result = buildOutreachDraft(
      {
        company_name: "Solo Beauty",
        contact_email: "solo@gmail.com",
        website: "https://solo.example",
        city: "Derby",
        pecr_classification: "likely_sole_trader",
      },
      activeTemplate,
    );

    expect(result.eligible).toBe(false);
    expect(result.subject).toBe("Quick idea for Solo Beauty");
    expect(result.eligibility.reasons).toContain("not_likely_corporate");
    expect(result.eligibility.reasons).toContain("low_quality_email");
  });

  it("blocks archived templates", () => {
    const result = buildOutreachDraft(
      {
        company_name: "Acme Clinic",
        contact_email: "info@acmeclinic.co.uk",
        website: "https://acmeclinic.co.uk",
        city: "Cardiff",
        pecr_classification: "likely_corporate",
      },
      archivedTemplate,
    );

    expect(result.eligible).toBe(false);
    expect(result.eligibility.reasons).toContain("template_archived");
  });

  it("honours suppressed email addresses", () => {
    const result = buildOutreachDraft(
      {
        company_name: "Acme Clinic",
        contact_email: "info@acmeclinic.co.uk",
        website: "https://acmeclinic.co.uk",
        city: "Cardiff",
        pecr_classification: "likely_corporate",
      },
      activeTemplate,
      ["info@acmeclinic.co.uk"],
    );

    expect(result.eligible).toBe(false);
    expect(result.eligibility.reasons).toContain("suppressed");
  });
});
