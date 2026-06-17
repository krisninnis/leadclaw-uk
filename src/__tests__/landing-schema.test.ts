// ClawLabsLocal — Landing Page Builder (Phase A)
// JSON-LD graph builder (pure; no DB / network).

import { describe, it, expect } from "@jest/globals";
import { buildLandingJsonLd, type JsonLd } from "@/lib/landing/schema";
import { emptyLandingContent } from "@/lib/landing/types";

function nodesByType(graph: JsonLd[], type: string) {
  return graph.filter((n) => n["@type"] === type);
}

const baseInput = {
  slug: "aesthetic-clinic-nottingham",
  niche: "aesthetic-clinic",
  city: "Nottingham",
  region: "East Midlands",
  country: "GB",
  canonicalPath: "/lp/aesthetic-clinic-nottingham",
  content: emptyLandingContent(),
};

describe("buildLandingJsonLd — LocalBusiness", () => {
  it("emits LocalBusiness when an address is present", () => {
    const graph = buildLandingJsonLd({
      ...baseInput,
      businessSchema: {
        businessName: "Clinic A",
        address: { locality: "Nottingham", region: "East Midlands" },
        phone: "+44 115 000 0000",
      },
    });
    const lb = nodesByType(graph, "LocalBusiness");
    expect(lb).toHaveLength(1);
    expect(lb[0].name).toBe("Clinic A");
    expect(lb[0].telephone).toBe("+44 115 000 0000");
    expect(lb[0].areaServed).toEqual({ "@type": "City", name: "Nottingham" });
    expect((lb[0].address as JsonLd).addressLocality).toBe("Nottingham");
  });

  it("emits LocalBusiness when only geo is present", () => {
    const graph = buildLandingJsonLd({
      ...baseInput,
      businessSchema: { geo: { lat: 52.95, lng: -1.15 } },
    });
    expect(nodesByType(graph, "LocalBusiness")).toHaveLength(1);
  });

  it("omits LocalBusiness when neither address nor geo is present", () => {
    const graph = buildLandingJsonLd({ ...baseInput, businessSchema: {} });
    expect(nodesByType(graph, "LocalBusiness")).toHaveLength(0);
  });

  it("includes AggregateRating only when a rating is genuinely provided", () => {
    const withRating = buildLandingJsonLd({
      ...baseInput,
      businessSchema: {
        address: { locality: "Nottingham" },
        rating: { value: 4.8, count: 120 },
      },
    });
    const lb = nodesByType(withRating, "LocalBusiness")[0];
    expect(lb.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: 4.8,
      reviewCount: 120,
    });

    const withoutRating = buildLandingJsonLd({
      ...baseInput,
      businessSchema: { address: { locality: "Nottingham" } },
    });
    expect(
      nodesByType(withoutRating, "LocalBusiness")[0].aggregateRating,
    ).toBeUndefined();
  });

  it("never fabricates a business: a rating with no address yields no LocalBusiness", () => {
    const graph = buildLandingJsonLd({
      ...baseInput,
      businessSchema: { rating: { value: 5, count: 99 } },
    });
    expect(nodesByType(graph, "LocalBusiness")).toHaveLength(0);
  });
});

describe("buildLandingJsonLd — Service", () => {
  it("emits one Service per provided service", () => {
    const graph = buildLandingJsonLd({
      ...baseInput,
      businessSchema: { services: ["Botox enquiries", "Filler enquiries"] },
    });
    const services = nodesByType(graph, "Service");
    expect(services).toHaveLength(2);
    expect(services.map((s) => s.serviceType)).toEqual([
      "Botox enquiries",
      "Filler enquiries",
    ]);
    expect(services[0].areaServed).toBe("Nottingham");
  });

  it("emits a single summary Service when none are listed but niche/city exist", () => {
    const graph = buildLandingJsonLd({ ...baseInput, businessSchema: {} });
    expect(nodesByType(graph, "Service")).toHaveLength(1);
  });
});

describe("buildLandingJsonLd — FAQPage", () => {
  it("emits FAQPage from non-empty FAQ items", () => {
    const graph = buildLandingJsonLd({
      ...baseInput,
      content: {
        ...emptyLandingContent(),
        faq: [
          { question: "Q1?", answer: "A1." },
          { question: "Q2?", answer: "A2." },
        ],
      },
      businessSchema: {},
    });
    const faq = nodesByType(graph, "FAQPage");
    expect(faq).toHaveLength(1);
    expect((faq[0].mainEntity as unknown[]).length).toBe(2);
  });

  it("omits FAQPage when there are no complete FAQ items", () => {
    const graph = buildLandingJsonLd({
      ...baseInput,
      content: {
        ...emptyLandingContent(),
        faq: [{ question: "Only a question", answer: "" }],
      },
      businessSchema: {},
    });
    expect(nodesByType(graph, "FAQPage")).toHaveLength(0);
  });
});
