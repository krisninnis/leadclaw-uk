// ClawLabsLocal — Landing Page Builder (Phase A)
// Two responsibilities:
//   1. Zod parsing of admin create/update payloads (shape + light coercion).
//   2. The publish gate — required fields + a thin-content / local-relevance
//      heuristic that resists doorway-page penalties (planning doc §5, §11).
//
// Slug *uniqueness* is enforced at the API layer (needs a DB round-trip);
// everything here is pure so it is fully unit-testable with no DB/network.

import { z } from "zod";
import {
  emptyLandingContent,
  normalizeBusinessSchema,
  normalizeContent,
  type LandingBusinessSchema,
  type LandingContent,
} from "./types";
import { generateSlug, isValidSlug, normalizeSlug } from "./slug";

export const MIN_PUBLISH_WORDS = 250;
export const MIN_FAQ_ITEMS = 3;
export const MIN_SERVICES = 1;
export const SEO_TITLE_MAX = 70;
export const SEO_DESCRIPTION_MAX = 200;

// -------------------------------------------------------------------
// Zod payload schemas
// -------------------------------------------------------------------
const faqItemSchema = z.object({
  question: z.string().max(300),
  answer: z.string().max(2000),
});

const relatedLinkSchema = z.object({
  href: z.string().max(500),
  label: z.string().max(200),
});

const contentSchema = z
  .object({
    h1: z.string().max(300).optional(),
    subheading: z.string().max(600).optional(),
    pains: z.array(z.string().max(600)).optional(),
    benefits: z.array(z.string().max(600)).optional(),
    features: z.array(z.string().max(600)).optional(),
    useCases: z.array(z.string().max(600)).optional(),
    faq: z.array(faqItemSchema).optional(),
    relatedLinks: z.array(relatedLinkSchema).optional(),
  })
  .optional();

const addressSchema = z
  .object({
    street: z.string().max(300).optional(),
    locality: z.string().max(200).optional(),
    region: z.string().max(200).optional(),
    postalCode: z.string().max(40).optional(),
    country: z.string().max(80).optional(),
  })
  .optional();

const businessSchemaSchema = z
  .object({
    businessName: z.string().max(300).optional(),
    address: addressSchema,
    phone: z.string().max(60).optional(),
    geo: z
      .object({ lat: z.number(), lng: z.number() })
      .optional(),
    services: z.array(z.string().max(200)).optional(),
    rating: z
      .object({ value: z.number(), count: z.number() })
      .optional(),
  })
  .optional();

const baseFields = {
  slug: z.string().trim().max(200).optional(),
  template_id: z.string().trim().min(1).max(64).optional().nullable(),
  niche: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  region: z.string().trim().max(120).optional().nullable(),
  country: z.string().trim().max(80).optional(),
  seo_title: z.string().max(300).optional().nullable(),
  seo_description: z.string().max(600).optional().nullable(),
  canonical_path: z.string().max(300).optional().nullable(),
  og_image_path: z.string().max(500).optional().nullable(),
  noindex: z.coerce.boolean().optional(),
  content: contentSchema,
  business_schema: businessSchemaSchema,
};

export const landingCreateSchema = z.object(baseFields);
export const landingUpdateSchema = z.object(baseFields);

export type CreateLandingInput = {
  slug: string;
  template_id: string | null;
  niche: string | null;
  city: string | null;
  region: string | null;
  country: string;
  seo_title: string | null;
  seo_description: string | null;
  canonical_path: string;
  og_image_path: string | null;
  noindex: boolean;
  content: LandingContent;
  business_schema: LandingBusinessSchema;
};

export type UpdateLandingInput = Partial<
  Omit<CreateLandingInput, "content" | "business_schema">
> & {
  content?: LandingContent;
  business_schema?: LandingBusinessSchema;
};

// Parse + normalise a create payload. Throws on invalid input (ZodError or a
// plain Error with a stable code message the API maps to a 400).
export function parseCreateInput(raw: unknown): CreateLandingInput {
  const parsed = landingCreateSchema.parse(raw ?? {});

  const niche = parsed.niche?.trim() || null;
  const city = parsed.city?.trim() || null;

  let slug: string;
  if (parsed.slug && parsed.slug.trim()) {
    const norm = normalizeSlug(parsed.slug);
    if (!norm.valid) throw new Error("invalid_slug");
    slug = norm.slug;
  } else {
    slug = generateSlug(niche, city);
    if (!slug) throw new Error("slug_required");
  }

  const content = normalizeContent(parsed.content ?? emptyLandingContent());
  const business_schema = normalizeBusinessSchema(parsed.business_schema ?? {});

  return {
    slug,
    template_id: parsed.template_id ?? null,
    niche,
    city,
    region: parsed.region?.trim() || null,
    country: parsed.country?.trim() || "GB",
    seo_title: parsed.seo_title ?? null,
    seo_description: parsed.seo_description ?? null,
    canonical_path: parsed.canonical_path?.trim() || `/lp/${slug}`,
    og_image_path: parsed.og_image_path ?? null,
    noindex: parsed.noindex ?? false,
    content,
    business_schema,
  };
}

// Parse + normalise an update payload. Only the keys present in `raw` are
// returned, so callers can do a partial patch.
export function parseUpdateInput(raw: unknown): UpdateLandingInput {
  const parsed = landingUpdateSchema.parse(raw ?? {});
  const out: UpdateLandingInput = {};
  const obj = (raw ?? {}) as Record<string, unknown>;
  const has = (k: string) => Object.prototype.hasOwnProperty.call(obj, k);

  if (has("slug")) {
    const norm = normalizeSlug(parsed.slug ?? "");
    if (!norm.valid) throw new Error("invalid_slug");
    out.slug = norm.slug;
    if (!has("canonical_path")) out.canonical_path = `/lp/${norm.slug}`;
  }
  if (has("template_id")) out.template_id = parsed.template_id ?? null;
  if (has("niche")) out.niche = parsed.niche?.trim() || null;
  if (has("city")) out.city = parsed.city?.trim() || null;
  if (has("region")) out.region = parsed.region?.trim() || null;
  if (has("country")) out.country = parsed.country?.trim() || "GB";
  if (has("seo_title")) out.seo_title = parsed.seo_title ?? null;
  if (has("seo_description")) out.seo_description = parsed.seo_description ?? null;
  if (has("canonical_path")) {
    out.canonical_path = parsed.canonical_path?.trim() || undefined;
  }
  if (has("og_image_path")) out.og_image_path = parsed.og_image_path ?? null;
  if (has("noindex")) out.noindex = parsed.noindex ?? false;
  if (has("content")) {
    out.content = normalizeContent(parsed.content ?? emptyLandingContent());
  }
  if (has("business_schema")) {
    out.business_schema = normalizeBusinessSchema(parsed.business_schema ?? {});
  }
  return out;
}

// -------------------------------------------------------------------
// Publish gate
// -------------------------------------------------------------------
export type PublishIssueCode =
  | "slug_invalid"
  | "seo_title_missing"
  | "seo_description_missing"
  | "h1_missing"
  | "city_missing"
  | "service_missing"
  | "faq_too_few"
  | "thin_content"
  | "local_relevance";

export type PublishIssue = {
  code: PublishIssueCode;
  field: string;
  message: string;
};

export type PublishCandidate = {
  slug: string;
  city: string | null;
  seo_title: string | null;
  seo_description: string | null;
  content: LandingContent;
  business_schema: LandingBusinessSchema;
};

export type PublishValidation = {
  ok: boolean;
  issues: PublishIssue[];
  wordCount: number;
};

function countWords(content: LandingContent): number {
  const parts: string[] = [
    content.h1,
    content.subheading,
    ...content.pains,
    ...content.benefits,
    ...content.features,
    ...content.useCases,
    ...content.faq.flatMap((f) => [f.question, f.answer]),
  ];
  return parts
    .join(" ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean).length;
}

function contentText(content: LandingContent): string {
  return [
    content.h1,
    content.subheading,
    ...content.pains,
    ...content.benefits,
    ...content.features,
    ...content.useCases,
    ...content.faq.flatMap((f) => [f.question, f.answer]),
  ]
    .join(" ")
    .toLowerCase();
}

// The publish-time gate. Returns every failing requirement (the UI shows them
// all at once) plus the computed word count for display.
export function validatePublish(page: PublishCandidate): PublishValidation {
  const issues: PublishIssue[] = [];
  const content = page.content;

  if (!isValidSlug(page.slug)) {
    issues.push({
      code: "slug_invalid",
      field: "slug",
      message: "Slug must be lowercase letters, numbers and single hyphens.",
    });
  }

  if (!page.seo_title?.trim()) {
    issues.push({
      code: "seo_title_missing",
      field: "seo_title",
      message: "Add an SEO title.",
    });
  }

  if (!page.seo_description?.trim()) {
    issues.push({
      code: "seo_description_missing",
      field: "seo_description",
      message: "Add a meta description.",
    });
  }

  if (!content.h1?.trim()) {
    issues.push({
      code: "h1_missing",
      field: "content.h1",
      message: "Add an H1 heading.",
    });
  }

  if (!page.city?.trim()) {
    issues.push({
      code: "city_missing",
      field: "city",
      message: "Set the target city.",
    });
  }

  const services = page.business_schema.services ?? [];
  if (services.length < MIN_SERVICES) {
    issues.push({
      code: "service_missing",
      field: "business_schema.services",
      message: `Add at least ${MIN_SERVICES} service.`,
    });
  }

  const faq = content.faq.filter(
    (item) => item.question.trim() && item.answer.trim(),
  );
  if (faq.length < MIN_FAQ_ITEMS) {
    issues.push({
      code: "faq_too_few",
      field: "content.faq",
      message: `Add at least ${MIN_FAQ_ITEMS} FAQ items (have ${faq.length}).`,
    });
  }

  const wordCount = countWords(content);
  if (wordCount < MIN_PUBLISH_WORDS) {
    issues.push({
      code: "thin_content",
      field: "content",
      message: `Body is too thin: ${wordCount}/${MIN_PUBLISH_WORDS} words. Add genuine local detail.`,
    });
  }

  // Local-relevance heuristic: the page body must actually mention its target
  // city. This is the cheap, Phase-A guard against near-duplicate templated
  // pages that only differ by a column value.
  if (page.city?.trim()) {
    const city = page.city.trim().toLowerCase();
    if (!contentText(content).includes(city)) {
      issues.push({
        code: "local_relevance",
        field: "content",
        message: `Mention "${page.city.trim()}" in the page body so it carries genuine local relevance.`,
      });
    }
  }

  return { ok: issues.length === 0, issues, wordCount };
}
