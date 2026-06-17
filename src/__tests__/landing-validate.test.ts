// ClawLabsLocal — Landing Page Builder (Phase A)
// Payload parsing + the publish gate (pure; no DB / network).

import { describe, it, expect } from "@jest/globals";
import {
  MIN_PUBLISH_WORDS,
  parseCreateInput,
  parseUpdateInput,
  validatePublish,
  type PublishCandidate,
} from "@/lib/landing/validate";
import {
  emptyLandingContent,
  normalizeContent,
  type LandingContent,
} from "@/lib/landing/types";

// Build a body string with at least `words` words, guaranteed to mention the
// city (for the local-relevance heuristic).
function bigText(words: number, city: string): string {
  const filler = Array.from({ length: words - 1 }, () => "service").join(" ");
  return `${city} ${filler}`;
}

function validContent(city: string): LandingContent {
  return {
    ...emptyLandingContent(),
    h1: `Aesthetic clinic enquiry handling in ${city}`,
    subheading: bigText(MIN_PUBLISH_WORDS + 20, city),
    faq: [
      { question: "Q1?", answer: "A1." },
      { question: "Q2?", answer: "A2." },
      { question: "Q3?", answer: "A3." },
    ],
  };
}

function validCandidate(city = "Nottingham"): PublishCandidate {
  return {
    slug: "aesthetic-clinic-nottingham",
    city,
    seo_title: `Aesthetic clinic ${city}`,
    seo_description: "Capture and handle local enquiries.",
    content: validContent(city),
    business_schema: { services: ["Enquiry handling"] },
  };
}

describe("parseCreateInput", () => {
  it("derives a slug from niche + city when no slug is given", () => {
    const input = parseCreateInput({ niche: "dentist", city: "Leicester" });
    expect(input.slug).toBe("dentist-leicester");
    expect(input.canonical_path).toBe("/lp/dentist-leicester");
    expect(input.country).toBe("GB");
    expect(input.noindex).toBe(false);
  });

  it("accepts and normalises an explicit slug", () => {
    const input = parseCreateInput({ slug: "Custom Slug" });
    expect(input.slug).toBe("custom-slug");
  });

  it("throws when no slug can be derived", () => {
    expect(() => parseCreateInput({})).toThrow("slug_required");
  });

  it("preserves valid content arrays and fills missing ones", () => {
    const input = parseCreateInput({
      niche: "dentist",
      city: "Leicester",
      content: { h1: "Hello", pains: ["a", "b"] },
    });
    expect(input.content.h1).toBe("Hello");
    expect(input.content.pains).toEqual(["a", "b"]);
    expect(Array.isArray(input.content.faq)).toBe(true);
    expect(input.content.benefits).toEqual([]);
  });

  it("drops a fabricated rating with a zero count", () => {
    const input = parseCreateInput({
      niche: "dentist",
      city: "Leicester",
      business_schema: { rating: { value: 5, count: 0 } },
    });
    expect(input.business_schema.rating).toBeUndefined();
  });
});

describe("parseUpdateInput", () => {
  it("only returns keys present in the payload", () => {
    const patch = parseUpdateInput({ seo_title: "New title" });
    expect(patch).toEqual({ seo_title: "New title" });
  });

  it("sets canonical_path when slug changes and no canonical given", () => {
    const patch = parseUpdateInput({ slug: "new-slug" });
    expect(patch.slug).toBe("new-slug");
    expect(patch.canonical_path).toBe("/lp/new-slug");
  });

  it("throws on an unusable slug", () => {
    expect(() => parseUpdateInput({ slug: "***" })).toThrow("invalid_slug");
  });
});

describe("validatePublish", () => {
  it("passes a complete, locally-relevant page", () => {
    const result = validatePublish(validCandidate());
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.wordCount).toBeGreaterThanOrEqual(MIN_PUBLISH_WORDS);
  });

  it("flags missing SEO title and description", () => {
    const candidate = validCandidate();
    candidate.seo_title = "";
    candidate.seo_description = "  ";
    const codes = validatePublish(candidate).issues.map((i) => i.code);
    expect(codes).toContain("seo_title_missing");
    expect(codes).toContain("seo_description_missing");
  });

  it("flags fewer than three FAQ items", () => {
    const candidate = validCandidate();
    candidate.content.faq = [{ question: "Q", answer: "A" }];
    const codes = validatePublish(candidate).issues.map((i) => i.code);
    expect(codes).toContain("faq_too_few");
  });

  it("flags a missing service", () => {
    const candidate = validCandidate();
    candidate.business_schema = {};
    const codes = validatePublish(candidate).issues.map((i) => i.code);
    expect(codes).toContain("service_missing");
  });

  it("flags thin content", () => {
    const candidate = validCandidate();
    candidate.content.subheading = "Nottingham short body";
    const codes = validatePublish(candidate).issues.map((i) => i.code);
    expect(codes).toContain("thin_content");
  });

  it("flags a page that never mentions its target city", () => {
    const candidate = validCandidate("Nottingham");
    // Long body, but it talks about Leicester, not the target city.
    candidate.content.subheading = bigText(MIN_PUBLISH_WORDS + 20, "Leicester");
    candidate.content.h1 = "Aesthetic clinic enquiry handling";
    const codes = validatePublish(candidate).issues.map((i) => i.code);
    expect(codes).toContain("local_relevance");
  });

  it("flags a malformed slug", () => {
    const candidate = validCandidate();
    candidate.slug = "Bad Slug";
    const codes = validatePublish(candidate).issues.map((i) => i.code);
    expect(codes).toContain("slug_invalid");
  });
});

describe("normalizeContent (DB jsonb hydration)", () => {
  it("drops non-string entries and fills missing arrays", () => {
    const content = normalizeContent({
      h1: "Hi",
      pains: ["ok", 5, null],
      faq: [{ question: "Q", answer: "A" }, { question: "bad" }],
    });
    expect(content.pains).toEqual(["ok"]);
    expect(content.benefits).toEqual([]);
    expect(content.faq).toEqual([{ question: "Q", answer: "A" }]);
  });

  it("returns a fully-formed empty body for junk input", () => {
    const content = normalizeContent(null);
    expect(content).toEqual(emptyLandingContent());
  });
});
