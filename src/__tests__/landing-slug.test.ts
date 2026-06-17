// ClawLabsLocal — Landing Page Builder (Phase A)
// Slug generation + validation (pure; no DB / network).

import { describe, it, expect } from "@jest/globals";
import {
  generateSlug,
  isValidSlug,
  normalizeSlug,
  slugify,
} from "@/lib/landing/slug";

describe("slugify", () => {
  it("lowercases and hyphenates arbitrary text", () => {
    expect(slugify("Aesthetic Clinic")).toBe("aesthetic-clinic");
  });

  it("collapses runs of separators into a single hyphen", () => {
    expect(slugify("dentist   --  leicester")).toBe("dentist-leicester");
  });

  it("trims leading/trailing separators and punctuation", () => {
    expect(slugify("  !!Beauty Salon!! ")).toBe("beauty-salon");
  });

  it("strips accents", () => {
    expect(slugify("Café Málaga")).toBe("cafe-malaga");
  });

  it("returns an empty string for input with no alphanumerics", () => {
    expect(slugify("---")).toBe("");
    expect(slugify("")).toBe("");
  });
});

describe("generateSlug", () => {
  it("joins niche and city", () => {
    expect(generateSlug("aesthetic-clinic", "Nottingham")).toBe(
      "aesthetic-clinic-nottingham",
    );
  });

  it("works with only one part present", () => {
    expect(generateSlug("dentist", null)).toBe("dentist");
    expect(generateSlug(null, "Coventry")).toBe("coventry");
  });

  it("returns empty when both parts are empty", () => {
    expect(generateSlug("", "")).toBe("");
  });
});

describe("isValidSlug", () => {
  it("accepts well-formed slugs", () => {
    expect(isValidSlug("dentist-leicester")).toBe(true);
    expect(isValidSlug("a1-b2-c3")).toBe(true);
  });

  it("rejects malformed slugs", () => {
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("-leading")).toBe(false);
    expect(isValidSlug("trailing-")).toBe(false);
    expect(isValidSlug("Upper-Case")).toBe(false);
    expect(isValidSlug("has space")).toBe(false);
    expect(isValidSlug("double--hyphen")).toBe(false);
    expect(isValidSlug("under_score")).toBe(false);
  });
});

describe("normalizeSlug", () => {
  it("passes through an already-valid slug", () => {
    expect(normalizeSlug("dentist-leicester")).toEqual({
      slug: "dentist-leicester",
      valid: true,
    });
  });

  it("coerces a near-miss into a valid slug", () => {
    expect(normalizeSlug("Dentist Leicester")).toEqual({
      slug: "dentist-leicester",
      valid: true,
    });
  });

  it("reports invalid when nothing usable remains", () => {
    expect(normalizeSlug("***")).toEqual({ slug: "", valid: false });
  });
});
