// ClawLabsLocal — Landing Page Builder (Phase A)
// Admin API: auth gating + create/update + publish-gate enforcement. The store,
// auth, rate-limiter and cache are mocked so these exercise route logic only.

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextResponse } from "next/server";

jest.mock("@/lib/api-auth", () => ({ requireAdmin: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(),
  landingAdminRateLimit: {},
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/landing/store", () => ({
  listLandingPages: jest.fn(),
  createLandingPage: jest.fn(),
  slugExists: jest.fn(),
  getLandingPageById: jest.fn(),
  updateLandingPage: jest.fn(),
  setLandingPageStatus: jest.fn(),
}));

import { requireAdmin } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import * as store from "@/lib/landing/store";
import { GET, POST } from "@/app/api/admin/landing-pages/route";
import { PATCH } from "@/app/api/admin/landing-pages/[id]/route";
import { POST as PUBLISH } from "@/app/api/admin/landing-pages/[id]/publish/route";
import { emptyLandingContent, type LandingPageRow } from "@/lib/landing/types";

const mockedRequireAdmin = jest.mocked(requireAdmin);
const mockedCheckRateLimit = jest.mocked(checkRateLimit);
const mockedStore = jest.mocked(store);

function adminOk() {
  mockedRequireAdmin.mockResolvedValue({
    ok: true,
    user: { id: "admin-1", email: "admin@leadclaw.uk" },
  });
}

function adminForbidden() {
  mockedRequireAdmin.mockResolvedValue({
    ok: false,
    response: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }),
  });
}

function makeRow(over: Partial<LandingPageRow> = {}): LandingPageRow {
  return {
    id: "p1",
    slug: "x",
    template_id: null,
    created_by: null,
    updated_by: null,
    status: "draft",
    niche: null,
    city: null,
    region: null,
    country: "GB",
    seo_title: null,
    seo_description: null,
    canonical_path: "/lp/x",
    og_image_path: null,
    noindex: false,
    content: emptyLandingContent(),
    business_schema: {},
    meta: {},
    published_at: null,
    created_at: "2026-06-17T00:00:00.000Z",
    updated_at: "2026-06-17T00:00:00.000Z",
    ...over,
  };
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedCheckRateLimit.mockResolvedValue(true);
});

describe("admin auth gate", () => {
  it("returns 403 to non-admins on create", async () => {
    adminForbidden();
    const res = await POST(
      jsonRequest("http://localhost/api/admin/landing-pages", "POST", {
        niche: "dentist",
        city: "Leicester",
      }),
    );
    expect(res.status).toBe(403);
    expect(mockedStore.createLandingPage).not.toHaveBeenCalled();
  });

  it("returns 403 to non-admins on list", async () => {
    adminForbidden();
    const res = await GET(
      jsonRequest("http://localhost/api/admin/landing-pages", "GET"),
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/admin/landing-pages (create)", () => {
  it("creates a draft and derives the slug from niche + city", async () => {
    adminOk();
    mockedStore.slugExists.mockResolvedValue(false);
    mockedStore.createLandingPage.mockResolvedValue(
      makeRow({ id: "p1", slug: "dentist-leicester" }),
    );

    const res = await POST(
      jsonRequest("http://localhost/api/admin/landing-pages", "POST", {
        niche: "dentist",
        city: "Leicester",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.page.slug).toBe("dentist-leicester");
    expect(mockedStore.createLandingPage).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "dentist-leicester" }),
      "admin-1",
    );
  });

  it("rejects a duplicate slug with 409", async () => {
    adminOk();
    mockedStore.slugExists.mockResolvedValue(true);

    const res = await POST(
      jsonRequest("http://localhost/api/admin/landing-pages", "POST", {
        slug: "dentist-leicester",
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error).toBe("slug_taken");
    expect(mockedStore.createLandingPage).not.toHaveBeenCalled();
  });

  it("rejects a payload with no derivable slug (400)", async () => {
    adminOk();
    const res = await POST(
      jsonRequest("http://localhost/api/admin/landing-pages", "POST", {}),
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/admin/landing-pages/[id] (update)", () => {
  it("updates an existing draft", async () => {
    adminOk();
    mockedStore.getLandingPageById.mockResolvedValue(
      makeRow({ id: "p1", slug: "old", status: "draft" }),
    );
    mockedStore.updateLandingPage.mockResolvedValue(
      makeRow({ id: "p1", slug: "old", status: "draft", seo_title: "New" }),
    );

    const res = await PATCH(
      jsonRequest("http://localhost/api/admin/landing-pages/p1", "PATCH", {
        seo_title: "New",
      }),
      { params: Promise.resolve({ id: "p1" }) },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockedStore.updateLandingPage).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ seo_title: "New" }),
      "admin-1",
    );
  });

  it("404s when the page does not exist", async () => {
    adminOk();
    mockedStore.getLandingPageById.mockResolvedValue(null);
    const res = await PATCH(
      jsonRequest("http://localhost/api/admin/landing-pages/missing", "PATCH", {
        seo_title: "New",
      }),
      { params: Promise.resolve({ id: "missing" }) },
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/admin/landing-pages/[id]/publish (gate)", () => {
  it("blocks publish with 422 when the page is thin/incomplete", async () => {
    adminOk();
    mockedStore.slugExists.mockResolvedValue(false);
    mockedStore.getLandingPageById.mockResolvedValue(
      makeRow({ id: "p1", slug: "dentist-leicester", status: "draft" }),
    );

    const res = await PUBLISH(
      jsonRequest(
        "http://localhost/api/admin/landing-pages/p1/publish",
        "POST",
      ),
      { params: Promise.resolve({ id: "p1" }) },
    );
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.error).toBe("validation_failed");
    expect(Array.isArray(body.issues)).toBe(true);
    expect(mockedStore.setLandingPageStatus).not.toHaveBeenCalled();
  });

  it("publishes a complete page", async () => {
    adminOk();
    mockedStore.slugExists.mockResolvedValue(false);
    const fatContent = {
      ...emptyLandingContent(),
      h1: "Dentist enquiry handling in Leicester",
      subheading: `Leicester ${Array.from({ length: 300 }, () => "service").join(" ")}`,
      faq: [
        { question: "Q1?", answer: "A1." },
        { question: "Q2?", answer: "A2." },
        { question: "Q3?", answer: "A3." },
      ],
    };
    mockedStore.getLandingPageById.mockResolvedValue(
      makeRow({
        id: "p1",
        slug: "dentist-leicester",
        status: "draft",
        city: "Leicester",
        seo_title: "Dentist Leicester",
        seo_description: "Local enquiry handling.",
        content: fatContent,
        business_schema: { services: ["Enquiry handling"] },
      }),
    );
    mockedStore.setLandingPageStatus.mockResolvedValue(
      makeRow({ id: "p1", slug: "dentist-leicester", status: "published" }),
    );

    const res = await PUBLISH(
      jsonRequest(
        "http://localhost/api/admin/landing-pages/p1/publish",
        "POST",
      ),
      { params: Promise.resolve({ id: "p1" }) },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockedStore.setLandingPageStatus).toHaveBeenCalledWith(
      "p1",
      "published",
      "admin-1",
    );
  });
});
