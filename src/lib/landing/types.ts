// ClawLabsLocal — Landing Page Builder (Phase A)
// Core types for the landing page builder. The `content` body is deliberately
// compatible with the existing SeoPage shape (src/lib/seo-pages.ts) so the
// public renderer reuses the proven SeoLandingPage component family, and so
// the scoring/visibility work in later phases can read the same fields.

export const LANDING_ENGINE_VERSION = "v1";

export type LandingStatus = "draft" | "published" | "archived";

export const LANDING_STATUSES: LandingStatus[] = [
  "draft",
  "published",
  "archived",
];

export type LandingFaqItem = {
  question: string;
  answer: string;
};

export type LandingRelatedLink = {
  href: string;
  label: string;
};

// Body content — same shape as SeoPage so the public renderer is shared.
export type LandingContent = {
  h1: string;
  subheading: string;
  pains: string[];
  benefits: string[];
  features: string[];
  useCases: string[];
  faq: LandingFaqItem[];
  relatedLinks: LandingRelatedLink[];
};

export type LandingAddress = {
  street?: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  country?: string;
};

export type LandingGeo = {
  lat: number;
  lng: number;
};

export type LandingRating = {
  value: number;
  count: number;
};

// Structured-data inputs the JSON-LD builder reads. Every field is optional;
// any block whose inputs are missing is omitted from the emitted schema (never
// synthesise an address or a rating — see planning doc §11).
export type LandingBusinessSchema = {
  businessName?: string;
  address?: LandingAddress;
  phone?: string;
  geo?: LandingGeo;
  services?: string[];
  rating?: LandingRating;
};

// Provenance / future-link metadata. Empty in Phase A; populated in Phase D
// without a schema change.
export type LandingMeta = {
  sourceAuditId?: string;
  visibilityFactorIds?: string[];
  competitorComparisonId?: string;
  notes?: string[];
};

// Full row as returned to admin surfaces.
export type LandingPageRow = {
  id: string;
  slug: string;
  template_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  status: LandingStatus;
  niche: string | null;
  city: string | null;
  region: string | null;
  country: string;
  seo_title: string | null;
  seo_description: string | null;
  canonical_path: string | null;
  og_image_path: string | null;
  noindex: boolean;
  content: LandingContent;
  business_schema: LandingBusinessSchema;
  meta: LandingMeta;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

// Safe subset served to the public route (no authorship/provenance columns).
export type PublicLandingPage = {
  id: string;
  slug: string;
  status: LandingStatus;
  niche: string | null;
  city: string | null;
  region: string | null;
  country: string;
  seo_title: string | null;
  seo_description: string | null;
  canonical_path: string | null;
  og_image_path: string | null;
  noindex: boolean;
  content: LandingContent;
  business_schema: LandingBusinessSchema;
  published_at: string | null;
  updated_at: string;
};

// Compact shape for the admin list table.
export type LandingPageListItem = {
  id: string;
  slug: string;
  status: LandingStatus;
  niche: string | null;
  city: string | null;
  region: string | null;
  seo_title: string | null;
  noindex: boolean;
  published_at: string | null;
  updated_at: string;
};

export type LandingTemplate = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  default_content: Partial<LandingContent>;
  schema_types: string[];
  status: "active" | "archived";
};

export type LandingEventType = "view" | "cta_click" | "enquiry" | "scroll_50";

export const LANDING_EVENT_TYPES: LandingEventType[] = [
  "view",
  "cta_click",
  "enquiry",
  "scroll_50",
];

// An empty, well-formed content body. Used as the merge base so every page
// always has the full set of arrays present (no undefined access in the UI).
export function emptyLandingContent(): LandingContent {
  return {
    h1: "",
    subheading: "",
    pains: [],
    benefits: [],
    features: [],
    useCases: [],
    faq: [],
    relatedLinks: [],
  };
}

// Coerce an arbitrary jsonb value into a fully-populated LandingContent.
export function normalizeContent(value: unknown): LandingContent {
  const base = emptyLandingContent();
  if (!value || typeof value !== "object") return base;
  const v = value as Record<string, unknown>;

  const strArray = (input: unknown): string[] =>
    Array.isArray(input)
      ? input.filter((x): x is string => typeof x === "string")
      : [];

  const faq = Array.isArray(v.faq)
    ? (v.faq as unknown[])
        .filter(
          (item): item is LandingFaqItem =>
            !!item &&
            typeof item === "object" &&
            typeof (item as LandingFaqItem).question === "string" &&
            typeof (item as LandingFaqItem).answer === "string",
        )
        .map((item) => ({ question: item.question, answer: item.answer }))
    : [];

  const relatedLinks = Array.isArray(v.relatedLinks)
    ? (v.relatedLinks as unknown[])
        .filter(
          (item): item is LandingRelatedLink =>
            !!item &&
            typeof item === "object" &&
            typeof (item as LandingRelatedLink).href === "string" &&
            typeof (item as LandingRelatedLink).label === "string",
        )
        .map((item) => ({ href: item.href, label: item.label }))
    : [];

  return {
    h1: typeof v.h1 === "string" ? v.h1 : base.h1,
    subheading: typeof v.subheading === "string" ? v.subheading : base.subheading,
    pains: strArray(v.pains),
    benefits: strArray(v.benefits),
    features: strArray(v.features),
    useCases: strArray(v.useCases),
    faq,
    relatedLinks,
  };
}

// Coerce an arbitrary jsonb value into a LandingBusinessSchema, dropping any
// field that is not genuinely present/typed.
export function normalizeBusinessSchema(value: unknown): LandingBusinessSchema {
  if (!value || typeof value !== "object") return {};
  const v = value as Record<string, unknown>;
  const out: LandingBusinessSchema = {};

  if (typeof v.businessName === "string" && v.businessName.trim()) {
    out.businessName = v.businessName.trim();
  }
  if (typeof v.phone === "string" && v.phone.trim()) {
    out.phone = v.phone.trim();
  }
  if (Array.isArray(v.services)) {
    const services = v.services
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter(Boolean);
    if (services.length) out.services = services;
  }
  if (v.address && typeof v.address === "object") {
    const a = v.address as Record<string, unknown>;
    const address: LandingAddress = {};
    for (const key of [
      "street",
      "locality",
      "region",
      "postalCode",
      "country",
    ] as const) {
      const raw = a[key];
      if (typeof raw === "string" && raw.trim()) address[key] = raw.trim();
    }
    if (Object.keys(address).length) out.address = address;
  }
  if (v.geo && typeof v.geo === "object") {
    const g = v.geo as Record<string, unknown>;
    if (typeof g.lat === "number" && typeof g.lng === "number") {
      out.geo = { lat: g.lat, lng: g.lng };
    }
  }
  if (v.rating && typeof v.rating === "object") {
    const r = v.rating as Record<string, unknown>;
    if (
      typeof r.value === "number" &&
      typeof r.count === "number" &&
      r.count > 0
    ) {
      out.rating = { value: r.value, count: r.count };
    }
  }
  return out;
}
