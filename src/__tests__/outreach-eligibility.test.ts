import { describe, expect, it } from "@jest/globals";
import {
  classifyEmailQuality,
  isLeadEligibleForOutreach,
} from "@/lib/outreach-eligibility";

describe("classifyEmailQuality", () => {
  it("classifies business role emails as high", () => {
    expect(classifyEmailQuality("info@company.co.uk")).toBe("high");
  });

  it("classifies named business emails as medium", () => {
    expect(classifyEmailQuality("kris@company.co.uk")).toBe("medium");
  });

  it("classifies gmail as low", () => {
    expect(classifyEmailQuality("person@gmail.com")).toBe("low");
  });

  it("rejects placeholder emails", () => {
    expect(classifyEmailQuality("user@domain.com")).toBe("invalid");
  });

  it("rejects malformed emails", () => {
    expect(classifyEmailQuality("not-an-email")).toBe("invalid");
  });

  it("rejects noreply emails", () => {
    expect(classifyEmailQuality("noreply@company.co.uk")).toBe("invalid");
  });
});

describe("isLeadEligibleForOutreach", () => {
  it("allows likely corporate with valid email", () => {
    const result = isLeadEligibleForOutreach({
      contact_email: "info@company.co.uk",
      pecr_classification: "likely_corporate",
    });

    expect(result.eligible).toBe(true);
    expect(result.email_quality).toBe("high");
    expect(result.reasons).toEqual([]);
  });

  it("blocks manual review", () => {
    const result = isLeadEligibleForOutreach({
      contact_email: "info@company.co.uk",
      pecr_classification: "manual_review",
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("not_likely_corporate");
  });

  it("blocks sole trader", () => {
    const result = isLeadEligibleForOutreach({
      contact_email: "info@company.co.uk",
      pecr_classification: "likely_sole_trader",
    });

    expect(result.eligible).toBe(false);
  });

  it("blocks missing email", () => {
    const result = isLeadEligibleForOutreach({
      pecr_classification: "likely_corporate",
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("missing_email");
  });

  it("blocks gmail", () => {
    const result = isLeadEligibleForOutreach({
      contact_email: "person@gmail.com",
      pecr_classification: "likely_corporate",
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("low_quality_email");
  });

  it("blocks suppressed emails", () => {
    const result = isLeadEligibleForOutreach(
      {
        contact_email: "info@company.co.uk",
        pecr_classification: "likely_corporate",
      },
      ["info@company.co.uk"],
    );

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("suppressed");
  });

  it("blocks do not contact", () => {
    const result = isLeadEligibleForOutreach({
      contact_email: "info@company.co.uk",
      pecr_classification: "likely_corporate",
      do_not_contact: true,
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("do_not_contact");
  });

  it("blocks already contacted", () => {
    const result = isLeadEligibleForOutreach({
      contact_email: "info@company.co.uk",
      pecr_classification: "likely_corporate",
      outreach_status: "sent",
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("already_contacted");
  });
});



