// ClawLabsLocal — Landing Page Builder (Phase A)
// JSON-LD graph builder. Turns a page's business_schema + content into an
// array of schema.org objects (LocalBusiness / Service / FAQPage), omitting any
// block whose inputs are missing. We NEVER synthesise an address, geo, or a
// rating — emitting structured data for something that isn't really there is a
// trust/policy risk (planning doc §11).

import type {
  LandingBusinessSchema,
  LandingContent,
} from "./types";

export const SITE_URL = "https://www.leadclaw.uk";
export const SITE_NAME = "LeadClaw";

// JSON-LD nodes are open-ended; this keeps the builder readable without `any`.
export type JsonLd = Record<string, unknown>;

type BuildInput = {
  slug: string;
  niche: string | null;
  city: string | null;
  region: string | null;
  country: string;
  canonicalPath: string | null;
  content: LandingContent;
  businessSchema: LandingBusinessSchema;
};

export function pageUrl(slug: string, canonicalPath: string | null): string {
  const path = canonicalPath || `/lp/${slug}`;
  return `${SITE_URL}${path}`;
}

function hasAddress(bs: LandingBusinessSchema): boolean {
  const a = bs.address;
  return !!(a && (a.locality || a.region || a.postalCode || a.street));
}

// LocalBusiness — only when an address or geo is present.
function buildLocalBusiness(input: BuildInput): JsonLd | null {
  const bs = input.businessSchema;
  if (!hasAddress(bs) && !bs.geo) return null;

  const name =
    bs.businessName ||
    [input.niche, input.city].filter(Boolean).join(" in ") ||
    input.slug;

  const node: JsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name,
    url: pageUrl(input.slug, input.canonicalPath),
  };

  if (input.city) {
    node.areaServed = { "@type": "City", name: input.city };
  }

  if (hasAddress(bs)) {
    const a = bs.address!;
    const address: JsonLd = { "@type": "PostalAddress" };
    if (a.street) address.streetAddress = a.street;
    if (a.locality || input.city) address.addressLocality = a.locality || input.city;
    if (a.region || input.region) address.addressRegion = a.region || input.region;
    if (a.postalCode) address.postalCode = a.postalCode;
    address.addressCountry = a.country || input.country || "GB";
    node.address = address;
  }

  if (bs.geo) {
    node.geo = {
      "@type": "GeoCoordinates",
      latitude: bs.geo.lat,
      longitude: bs.geo.lng,
    };
  }

  if (bs.phone) node.telephone = bs.phone;

  // AggregateRating only when genuinely sourced.
  if (bs.rating && bs.rating.count > 0) {
    node.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: bs.rating.value,
      reviewCount: bs.rating.count,
    };
  }

  return node;
}

// Service — one per business_schema.services[], else a single summary Service
// derived from the niche/city when those are present.
function buildServices(input: BuildInput): JsonLd[] {
  const bs = input.businessSchema;
  const url = pageUrl(input.slug, input.canonicalPath);
  const provider = { "@type": "Organization", name: SITE_NAME, url: SITE_URL };
  const areaServed = input.city || input.region || undefined;

  if (bs.services && bs.services.length > 0) {
    return bs.services.map((service) => {
      const node: JsonLd = {
        "@context": "https://schema.org",
        "@type": "Service",
        serviceType: service,
        provider,
        url,
      };
      if (areaServed) node.areaServed = areaServed;
      return node;
    });
  }

  // Summary service when no explicit services but we still have local context.
  if (input.niche || input.city) {
    const serviceType = [input.niche, input.city]
      .filter(Boolean)
      .join(" — ") || "Local enquiry handling";
    const node: JsonLd = {
      "@context": "https://schema.org",
      "@type": "Service",
      serviceType,
      provider,
      url,
    };
    if (areaServed) node.areaServed = areaServed;
    return [node];
  }

  return [];
}

// FAQPage — from content.faq[]. Only emitted when at least one Q/A is present.
function buildFaq(input: BuildInput): JsonLd | null {
  const faq = (input.content.faq || []).filter(
    (item) => item.question.trim() && item.answer.trim(),
  );
  if (faq.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

// Build the full JSON-LD graph for a page. Returns an array of nodes; each is
// rendered as its own <script type="application/ld+json"> tag.
export function buildLandingJsonLd(input: BuildInput): JsonLd[] {
  const nodes: JsonLd[] = [];

  const localBusiness = buildLocalBusiness(input);
  if (localBusiness) nodes.push(localBusiness);

  nodes.push(...buildServices(input));

  const faq = buildFaq(input);
  if (faq) nodes.push(faq);

  return nodes;
}
