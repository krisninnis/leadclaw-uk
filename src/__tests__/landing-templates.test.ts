// ClawLabsLocal — Landing Page Builder (Phase B)
// Template library + deterministic draft generation + localisation + the fact
// that generated drafts satisfy (never weaken) the existing publish gate.
// Pure functions — no DB / network / AI.

import { describe, it, expect } from "@jest/globals";
import {
  LANDING_TEMPLATES,
  LANDING_TEMPLATE_KEYS,
  LANDING_SECTION_KEYS,
  generateDraftFromTemplate,
  generateSectionDefaults,
  getLandingTemplate,
  summarizeTemplate,
  type GeneratedDraft,
} from "@/lib/landing/templates";
import {
  MIN_FAQ_ITEMS,
  MIN_PUBLISH_WORDS,
  validatePublish,
  type PublishCandidate,
} from "@/lib/landing/validate";

const EXPECTED_KEYS = [
  "aesthetic-clinic",
  "dentist",
  "physiotherapist",
  "chiropractor",
  "electrician",
  "plumber",
  "roofer",
];

function allStrings(draft: GeneratedDraft): string[] {
  const c = draft.content;
  return [
    draft.slug,
    draft.seo_title,
    draft.seo_description,
    draft.canonical_path,
    c.h1,
    c.subheading,
    ...c.pains,
    ...c.benefits,
    ...c.features,
    ...c.useCases,
    ...c.faq.flatMap((f) => [f.question, f.answer]),
    ...draft.services,
  ];
}

function candidateFrom(draft: GeneratedDraft): PublishCandidate {
  return {
    slug: draft.slug,
    city: draft.city,
    seo_title: draft.seo_title,
    seo_description: draft.seo_description,
    content: draft.content,
    business_schema: { services: draft.services },
  };
}

describe("template loading", () => {
  it("exposes exactly the seven starter templates", () => {
    expect(LANDING_TEMPLATES).toHaveLength(7);
    expect(LANDING_TEMPLATE_KEYS.sort()).toEqual([...EXPECTED_KEYS].sort());
  });

  it("every template has the required content sections", () => {
    for (const def of LANDING_TEMPLATES) {
      expect(def.h1.trim()).not.toBe("");
      expect(def.subheading.trim()).not.toBe("");
      expect(def.pains.length).toBeGreaterThanOrEqual(3);
      expect(def.benefits.length).toBeGreaterThanOrEqual(3);
      expect(def.features.length).toBeGreaterThanOrEqual(1);
      expect(def.useCases.length).toBeGreaterThanOrEqual(1);
      expect(def.faq.length).toBeGreaterThanOrEqual(MIN_FAQ_ITEMS);
      expect(def.services.length).toBeGreaterThanOrEqual(1);
      expect(def.seoTitle.trim()).not.toBe("");
      expect(def.metaDescription.trim()).not.toBe("");
    }
  });

  it("getLandingTemplate resolves by key and returns undefined otherwise", () => {
    expect(getLandingTemplate("dentist")?.nicheSlug).toBe("dentist");
    expect(getLandingTemplate("does-not-exist")).toBeUndefined();
    expect(getLandingTemplate(null)).toBeUndefined();
  });
});

describe("draft generation", () => {
  it("produces the documented H1 and slug", () => {
    const def = getLandingTemplate("aesthetic-clinic")!;
    const draft = generateDraftFromTemplate(def, {
      city: "Nottingham",
      region: "East Midlands",
      country: "GB",
    });
    expect(draft.content.h1).toBe("Aesthetic Clinic in Nottingham");
    expect(draft.slug).toBe("aesthetic-clinic-nottingham");
    expect(draft.niche).toBe("aesthetic-clinic");
    expect(draft.canonical_path).toBe("/lp/aesthetic-clinic-nottingham");
    expect(draft.seo_title).toContain("Nottingham");
    expect(draft.country).toBe("GB");
  });

  it("populates every editable content section", () => {
    const draft = generateDraftFromTemplate(getLandingTemplate("dentist")!, {
      city: "Leicester",
    });
    expect(draft.content.subheading.length).toBeGreaterThan(0);
    expect(draft.content.pains.length).toBeGreaterThan(0);
    expect(draft.content.benefits.length).toBeGreaterThan(0);
    expect(draft.content.features.length).toBeGreaterThan(0);
    expect(draft.content.useCases.length).toBeGreaterThan(0);
  });
});

describe("localisation replacement", () => {
  it("substitutes city and region and leaves no unresolved tokens", () => {
    const draft = generateDraftFromTemplate(getLandingTemplate("plumber")!, {
      city: "Coventry",
      region: "West Midlands",
    });
    for (const s of allStrings(draft)) {
      expect(s.includes("{")).toBe(false); // no leftover {token}
    }
    expect(draft.content.h1).toContain("Coventry");
    expect(draft.content.subheading).toContain("Coventry");
    expect(draft.content.subheading).toContain("West Midlands");
  });

  it("degrades gracefully when no region is supplied", () => {
    const draft = generateDraftFromTemplate(getLandingTemplate("roofer")!, {
      city: "Derby",
    });
    for (const s of allStrings(draft)) {
      expect(s.includes("{")).toBe(false);
    }
    expect(draft.content.h1).toBe("Roofer in Derby");
    // No region => no "wider ... region" clause is left dangling.
    expect(draft.seo_description).not.toContain("wider");
  });

  it("never fabricates addresses, ratings, phone numbers or names", () => {
    const draft = generateDraftFromTemplate(getLandingTemplate("dentist")!, {
      city: "Leicester",
      region: "East Midlands",
    });
    const candidate = candidateFrom(draft);
    expect(candidate.business_schema.address).toBeUndefined();
    expect(candidate.business_schema.rating).toBeUndefined();
    expect(candidate.business_schema.phone).toBeUndefined();
    expect(candidate.business_schema.businessName).toBeUndefined();
  });
});

describe("FAQ and service generation", () => {
  it("generates at least the minimum FAQ items, fully localised", () => {
    const draft = generateDraftFromTemplate(
      getLandingTemplate("physiotherapist")!,
      { city: "Nottingham", region: "East Midlands" },
    );
    expect(draft.content.faq.length).toBeGreaterThanOrEqual(MIN_FAQ_ITEMS);
    for (const item of draft.content.faq) {
      expect(item.question.trim()).not.toBe("");
      expect(item.answer.trim()).not.toBe("");
      expect(item.question.includes("{")).toBe(false);
      expect(item.answer.includes("{")).toBe(false);
    }
  });

  it("generates a non-empty service list from the template", () => {
    const def = getLandingTemplate("electrician")!;
    const draft = generateDraftFromTemplate(def, { city: "Coventry" });
    expect(draft.services.length).toBeGreaterThanOrEqual(1);
    expect(draft.services).toEqual(def.services);
  });
});

describe("summarizeTemplate", () => {
  it("counts the sections for the UX preview", () => {
    const def = getLandingTemplate("aesthetic-clinic")!;
    const summary = summarizeTemplate(def);
    expect(summary.benefits).toBe(def.benefits.length);
    expect(summary.faqs).toBe(def.faq.length);
    expect(summary.services).toBe(def.services.length);
    expect(summary.pains).toBe(def.pains.length);
    expect(summary.features).toBe(def.features.length);
    expect(summary.useCases).toBe(def.useCases.length);
  });
});

describe("section-level defaults", () => {
  it("exposes the six list-style section keys", () => {
    expect(LANDING_SECTION_KEYS).toEqual([
      "pains",
      "benefits",
      "features",
      "useCases",
      "faq",
      "services",
    ]);
  });

  it("returns localised defaults matching a full draft, per section", () => {
    const def = getLandingTemplate("electrician")!;
    const input = { city: "Coventry", region: "West Midlands", country: "GB" };
    const draft = generateDraftFromTemplate(def, input);
    const sections = generateSectionDefaults(def, input);

    expect(sections.pains).toEqual(draft.content.pains);
    expect(sections.benefits).toEqual(draft.content.benefits);
    expect(sections.features).toEqual(draft.content.features);
    expect(sections.useCases).toEqual(draft.content.useCases);
    expect(sections.faq).toEqual(draft.content.faq);
    expect(sections.services).toEqual(draft.services);

    // Localised, no leftover tokens.
    expect(sections.pains.join(" ")).toContain("Coventry");
    for (const item of [
      ...sections.pains,
      ...sections.benefits,
      ...sections.services,
    ]) {
      expect(item.includes("{")).toBe(false);
    }
  });

  it("never produces fabricated business fields", () => {
    const sections = generateSectionDefaults(getLandingTemplate("dentist")!, {
      city: "Leicester",
    });
    // Only the editable list sections exist — nothing here is an address,
    // phone, rating, or business name.
    expect(Object.keys(sections).sort()).toEqual(
      ["benefits", "faq", "features", "pains", "services", "useCases"].sort(),
    );
  });
});

describe("validation preservation (gate not weakened)", () => {
  it("every generated draft passes the existing publish gate", () => {
    for (const def of LANDING_TEMPLATES) {
      const draft = generateDraftFromTemplate(def, {
        city: "Nottingham",
        region: "East Midlands",
        country: "GB",
      });
      const result = validatePublish(candidateFrom(draft));
      expect(result.ok).toBe(true);
      expect(result.wordCount).toBeGreaterThanOrEqual(MIN_PUBLISH_WORDS);
    }
  });

  it("still rejects a draft once a required field is removed", () => {
    const draft = generateDraftFromTemplate(getLandingTemplate("dentist")!, {
      city: "Leicester",
    });
    const candidate = candidateFrom(draft);
    // Blank the SEO title — the gate must still fail.
    candidate.seo_title = "";
    const result = validatePublish(candidate);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain("seo_title_missing");
  });

  it("still rejects when the service list is emptied", () => {
    const draft = generateDraftFromTemplate(getLandingTemplate("plumber")!, {
      city: "Coventry",
    });
    const candidate = candidateFrom(draft);
    candidate.business_schema = { services: [] };
    const result = validatePublish(candidate);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain("service_missing");
  });
});
