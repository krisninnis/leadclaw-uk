// ClawLabsLocal — Landing Page Builder (Phase A)
// Store-level guarantee that the public loader serves ONLY published rows.
// We mock the service-role client with a chainable builder that records the
// filters applied and returns a canned result.

import { describe, it, expect, jest, beforeEach } from "@jest/globals";

let mockNextResult: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};
const mockEqCalls: Array<[string, unknown]> = [];

function mockMakeBuilder() {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  for (const m of [
    "from",
    "select",
    "insert",
    "update",
    "upsert",
    "delete",
    "neq",
    "or",
    "in",
    "is",
    "not",
    "gte",
    "lte",
    "order",
    "limit",
    "maybeSingle",
    "single",
  ]) {
    b[m] = chain;
  }
  b.eq = (column: string, value: unknown) => {
    mockEqCalls.push([column, value]);
    return b;
  };
  b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(mockNextResult).then(resolve, reject);
  return b;
}

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(() => mockMakeBuilder()),
}));

import { getPublishedLandingPage } from "@/lib/landing/store";

beforeEach(() => {
  mockEqCalls.length = 0;
  mockNextResult = { data: null, error: null };
});

describe("getPublishedLandingPage", () => {
  it("filters by slug AND status='published'", async () => {
    mockNextResult = {
      data: {
        id: "1",
        slug: "dentist-leicester",
        status: "published",
        niche: "dentist",
        city: "Leicester",
        region: null,
        country: "GB",
        seo_title: "t",
        seo_description: "d",
        canonical_path: "/lp/dentist-leicester",
        og_image_path: null,
        noindex: false,
        content: {},
        business_schema: {},
        published_at: "2026-06-17T00:00:00.000Z",
        updated_at: "2026-06-17T00:00:00.000Z",
      },
      error: null,
    };

    const page = await getPublishedLandingPage("dentist-leicester");
    expect(page).not.toBeNull();
    expect(page?.status).toBe("published");
    // The published filter is always applied — drafts/archived can't leak.
    expect(mockEqCalls).toEqual(
      expect.arrayContaining([
        ["slug", "dentist-leicester"],
        ["status", "published"],
      ]),
    );
  });

  it("returns null for an unknown / non-published slug", async () => {
    mockNextResult = { data: null, error: null };
    const page = await getPublishedLandingPage("missing");
    expect(page).toBeNull();
    expect(mockEqCalls).toEqual(
      expect.arrayContaining([["status", "published"]]),
    );
  });

  it("hydrates the content/business_schema into full shapes", async () => {
    mockNextResult = {
      data: {
        id: "2",
        slug: "x",
        status: "published",
        content: { h1: "Hi", pains: ["p"] },
        business_schema: { services: ["s"] },
      },
      error: null,
    };
    const page = await getPublishedLandingPage("x");
    expect(page?.content.h1).toBe("Hi");
    expect(page?.content.faq).toEqual([]); // missing arrays filled in
    expect(page?.business_schema.services).toEqual(["s"]);
  });
});
