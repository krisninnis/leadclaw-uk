// ClawLabsLocal — Landing Page Builder (Phase B)
// Deterministic, template-driven draft generation. NO AI / no external APIs:
// generation is pure string substitution over hand-authored templates, so the
// output is identical for identical inputs and fully unit-testable.
//
// The DB table landing_page_templates is the selectable *catalogue* (key, name,
// description). The actual content patterns + generation live here in code, so
// drafts are versioned, reviewable, and deterministic. Generated drafts are
// always editable and never auto-saved/published (the admin reviews first).
//
// Localisation rule (planning doc §B.3): generated copy references the city and
// region only. It NEVER invents addresses, reviews, ratings, awards, clinic
// names, or opening hours.

import { generateSlug } from "./slug";
import type { LandingContent, LandingFaqItem } from "./types";

export type TemplateCategory = "clinic" | "trade";

export type LandingTemplateDef = {
  key: string; // matches landing_page_templates.key
  name: string;
  description: string;
  category: TemplateCategory;
  nicheSlug: string; // default niche value, e.g. "aesthetic-clinic"
  nicheLabel: string; // "Aesthetic Clinic"
  nicheLabelPlural: string; // "Aesthetic clinics"
  schemaTypes: string[];
  services: string[];
  // Pattern strings. Supported tokens (literal braces):
  //   {city} {area} {regionClause}
  //   {nicheLabel} {nicheLabelLower} {nicheLabelPlural} {nicheLabelPluralLower}
  h1: string;
  subheading: string;
  pains: string[];
  benefits: string[];
  features: string[];
  useCases: string[];
  faq: LandingFaqItem[];
  seoTitle: string;
  metaDescription: string;
};

export type GenerateDraftInput = {
  city: string;
  region?: string | null;
  country?: string | null;
};

export type GeneratedDraft = {
  niche: string;
  city: string;
  region: string;
  country: string;
  slug: string;
  seo_title: string;
  seo_description: string;
  canonical_path: string;
  content: LandingContent;
  services: string[];
};

type FillContext = {
  city: string;
  area: string;
  regionClause: string;
  nicheLabel: string;
  nicheLabelLower: string;
  nicheLabelPlural: string;
  nicheLabelPluralLower: string;
};

// Replace every supported token. Each regex requires the closing brace, so the
// order of replacements does not matter (no token is a prefix-with-brace of
// another).
export function fillTemplate(text: string, ctx: FillContext): string {
  return text
    .replace(/\{city\}/g, ctx.city)
    .replace(/\{area\}/g, ctx.area)
    .replace(/\{regionClause\}/g, ctx.regionClause)
    .replace(/\{nicheLabelPluralLower\}/g, ctx.nicheLabelPluralLower)
    .replace(/\{nicheLabelPlural\}/g, ctx.nicheLabelPlural)
    .replace(/\{nicheLabelLower\}/g, ctx.nicheLabelLower)
    .replace(/\{nicheLabel\}/g, ctx.nicheLabel);
}

function buildContext(def: LandingTemplateDef, input: GenerateDraftInput): FillContext {
  const city = (input.city || "").trim();
  const region = (input.region || "").trim();
  const area = region ? `${city}, ${region}` : city;
  const regionClause = region ? ` and the wider ${region} region` : "";
  return {
    city,
    area,
    regionClause,
    nicheLabel: def.nicheLabel,
    nicheLabelLower: def.nicheLabel.toLowerCase(),
    nicheLabelPlural: def.nicheLabelPlural,
    nicheLabelPluralLower: def.nicheLabelPlural.toLowerCase(),
  };
}

// Deterministically expand a template into an editable draft for a city/region.
export function generateDraftFromTemplate(
  def: LandingTemplateDef,
  input: GenerateDraftInput,
): GeneratedDraft {
  const city = (input.city || "").trim();
  const region = (input.region || "").trim();
  const country = (input.country || "GB").trim() || "GB";
  const ctx = buildContext(def, input);
  const f = (s: string) => fillTemplate(s, ctx);
  const slug = generateSlug(def.nicheSlug, city);

  const content: LandingContent = {
    h1: f(def.h1),
    subheading: f(def.subheading),
    pains: def.pains.map(f),
    benefits: def.benefits.map(f),
    features: def.features.map(f),
    useCases: def.useCases.map(f),
    faq: def.faq.map((item) => ({
      question: f(item.question),
      answer: f(item.answer),
    })),
    relatedLinks: [],
  };

  return {
    niche: def.nicheSlug,
    city,
    region,
    country,
    slug,
    seo_title: f(def.seoTitle),
    seo_description: f(def.metaDescription),
    canonical_path: slug ? `/lp/${slug}` : "",
    content,
    services: def.services.map(f),
  };
}

export type TemplateSummary = {
  pains: number;
  benefits: number;
  features: number;
  useCases: number;
  faqs: number;
  services: number;
};

export function summarizeTemplate(def: LandingTemplateDef): TemplateSummary {
  return {
    pains: def.pains.length,
    benefits: def.benefits.length,
    features: def.features.length,
    useCases: def.useCases.length,
    faqs: def.faq.length,
    services: def.services.length,
  };
}

// -------------------------------------------------------------------
// Template builders — keep the 7 starter templates DRY while still giving each
// its own niche-specific wording via the niche labels + services.
// -------------------------------------------------------------------
type BuildOpts = {
  key: string;
  nicheSlug: string;
  nicheLabel: string;
  nicheLabelPlural: string;
  description: string;
  services: string[];
};

const SCHEMA_TYPES = ["LocalBusiness", "Service", "FAQPage"];

function clinicTemplate(opts: BuildOpts): LandingTemplateDef {
  return {
    key: opts.key,
    name: `${opts.nicheLabel} (local)`,
    description: opts.description,
    category: "clinic",
    nicheSlug: opts.nicheSlug,
    nicheLabel: opts.nicheLabel,
    nicheLabelPlural: opts.nicheLabelPlural,
    schemaTypes: SCHEMA_TYPES,
    services: opts.services,
    h1: "{nicheLabel} in {city}",
    subheading:
      "Capture enquiries from people looking for {nicheLabelPluralLower} in {city}{regionClause}, qualify each one with a consistent intake, and keep follow-up moving so no enquiry slips through. Your team stays in control of advice and clinical decisions throughout.",
    pains: [
      "Enquiries arrive by phone, web form, and social at all hours, and busy {nicheLabelPluralLower} in {city} can miss them during appointments.",
      "People ask the same questions about availability, pricing, and what to expect before they are ready to book.",
      "Manual follow-up is inconsistent when reception is juggling the front desk and day-to-day admin.",
      "High-intent enquiries sit too long before someone has time to qualify and route them.",
      "There is no simple record of where {city} enquiries come from or which ones converted.",
    ],
    benefits: [
      "Respond to {city} enquiries quickly with a consistent, structured intake.",
      "Keep every enquiry, callback, and follow-up visible in one place.",
      "Reduce repetitive first-response admin for your reception team.",
      "Give people across {area} clear next steps without pulling staff off clinical work.",
      "See which {city} enquiry sources and services convert best.",
      "Keep advice, suitability, and clinical decisions firmly with your team.",
    ],
    features: [
      "Enquiry capture from web and phone",
      "Structured intake and qualification",
      "Follow-up reminders and routing",
      "Weekly enquiry summary",
    ],
    useCases: [
      "Capture new client enquiries for {nicheLabelPluralLower} from a website widget in {city}.",
      "Route enquiry details to the right team member to review and respond.",
      "Send polite follow-up prompts when someone in {area} has not replied.",
      "Summarise weekly enquiry volume and sources for {city}.",
    ],
    faq: [
      {
        question: "Do you cover {city} and nearby areas?",
        answer:
          "Yes. This page targets {nicheLabelPluralLower} in {area}, and the enquiry handling works wherever your {city} clients are based.",
      },
      {
        question: "Will this replace my reception team?",
        answer:
          "No. It supports reception by organising enquiries and reducing repetitive first-response admin. Your team keeps handling advice and decisions.",
      },
      {
        question: "Can it answer clinical or treatment questions?",
        answer:
          "It is designed for intake, routing, and follow-up. Clinical and treatment advice should stay with your trained staff.",
      },
      {
        question: "How quickly are {city} enquiries handled?",
        answer:
          "Enquiries are captured immediately and organised for your team to review and respond, so fewer leads go cold.",
      },
      {
        question: "Is this suitable for a small {nicheLabelLower}?",
        answer:
          "Yes. Smaller {city} practices can start with basic enquiry capture and add more support as volume grows.",
      },
    ],
    seoTitle: "{nicheLabel} in {city} | LeadClaw",
    metaDescription:
      "Enquiry handling for {nicheLabelPluralLower} in {city}{regionClause}. Capture calls and web enquiries, qualify them, and follow up so no enquiry is missed.",
  };
}

function tradeTemplate(opts: BuildOpts): LandingTemplateDef {
  return {
    key: opts.key,
    name: `${opts.nicheLabel} (local)`,
    description: opts.description,
    category: "trade",
    nicheSlug: opts.nicheSlug,
    nicheLabel: opts.nicheLabel,
    nicheLabelPlural: opts.nicheLabelPlural,
    schemaTypes: SCHEMA_TYPES,
    services: opts.services,
    h1: "{nicheLabel} in {city}",
    subheading:
      "Capture quote requests and callout enquiries for {nicheLabelLower} work across {area}, qualify the job details up front, and follow up so no lead goes cold — while you stay focused on the work itself.",
    pains: [
      "Calls and quote requests come in while you are on a job, and a missed call in {city} often goes straight to a competitor.",
      "People want a rough price and availability before they will commit to booking.",
      "Following up on quotes you have already sent is easy to forget when the work piles up.",
      "Urgent callouts need triaging quickly, but you cannot always answer the phone.",
      "There is no clear record of which {city} jobs came from where.",
    ],
    benefits: [
      "Capture every {city} call and quote request, even when you are on the tools.",
      "Qualify job details up front so you quote the right work.",
      "Keep quotes, callbacks, and follow-ups visible in one place.",
      "Follow up on pending quotes across {area} without extra admin.",
      "Respond to urgent callouts faster with a structured intake.",
      "See which {city} job sources actually convert into work.",
    ],
    features: [
      "Call and web enquiry capture",
      "Job detail qualification",
      "Quote follow-up reminders",
      "Weekly enquiry summary",
    ],
    useCases: [
      "Capture quote requests for {nicheLabelLower} work from your website in {city}.",
      "Triage urgent callouts across {area} with a structured intake.",
      "Chase pending quotes so {city} leads do not go cold.",
      "Summarise weekly enquiry volume and sources for {city}.",
    ],
    faq: [
      {
        question: "Do you cover {city} and the surrounding area?",
        answer:
          "Yes. This page targets {nicheLabelLower} work in {area}, and enquiry handling works across your {city} service area.",
      },
      {
        question: "Will I still control my quotes and pricing?",
        answer:
          "Yes. It captures and qualifies the job; you decide on pricing, scheduling, and the work itself.",
      },
      {
        question: "Can it handle emergency callouts?",
        answer:
          "It captures and triages urgent enquiries with a structured intake so you can prioritise quickly. It does not dispatch on your behalf.",
      },
      {
        question: "How fast are {city} enquiries captured?",
        answer:
          "Calls and quote requests are captured immediately and organised for you to action, so fewer leads go cold.",
      },
      {
        question: "Is this useful for a one-person {nicheLabelLower}?",
        answer:
          "Yes. Sole traders in {city} benefit most, since missed calls and slow follow-up cost the most jobs.",
      },
    ],
    seoTitle: "{nicheLabel} in {city} | LeadClaw",
    metaDescription:
      "Enquiry handling for {nicheLabelLower} work in {city}{regionClause}. Capture calls and quote requests, qualify jobs, and follow up so no lead is missed.",
  };
}

export const LANDING_TEMPLATES: LandingTemplateDef[] = [
  clinicTemplate({
    key: "aesthetic-clinic",
    nicheSlug: "aesthetic-clinic",
    nicheLabel: "Aesthetic Clinic",
    nicheLabelPlural: "Aesthetic clinics",
    description: "Local landing page for an aesthetic clinic in a specific city.",
    services: [
      "Consultation enquiry handling",
      "Treatment booking enquiries",
      "New client intake",
      "Follow-up reminders",
    ],
  }),
  clinicTemplate({
    key: "dentist",
    nicheSlug: "dentist",
    nicheLabel: "Dentist",
    nicheLabelPlural: "Dentists",
    description: "Local landing page for a dental practice in a specific city.",
    services: [
      "New patient enquiries",
      "Appointment booking enquiries",
      "Treatment plan follow-ups",
      "Emergency enquiry intake",
    ],
  }),
  clinicTemplate({
    key: "physiotherapist",
    nicheSlug: "physiotherapist",
    nicheLabel: "Physiotherapist",
    nicheLabelPlural: "Physiotherapists",
    description: "Local landing page for a physiotherapy clinic in a specific city.",
    services: [
      "Initial assessment enquiries",
      "Appointment booking enquiries",
      "Treatment follow-up reminders",
      "Self-pay and insurance enquiry handling",
    ],
  }),
  clinicTemplate({
    key: "chiropractor",
    nicheSlug: "chiropractor",
    nicheLabel: "Chiropractor",
    nicheLabelPlural: "Chiropractors",
    description: "Local landing page for a chiropractic clinic in a specific city.",
    services: [
      "New patient enquiries",
      "Appointment booking enquiries",
      "Care plan follow-ups",
      "Consultation reminders",
    ],
  }),
  tradeTemplate({
    key: "electrician",
    nicheSlug: "electrician",
    nicheLabel: "Electrician",
    nicheLabelPlural: "Electricians",
    description: "Local landing page for an electrician in a specific city.",
    services: [
      "Quote request handling",
      "Emergency callout intake",
      "Job booking enquiries",
      "Follow-up on pending quotes",
    ],
  }),
  tradeTemplate({
    key: "plumber",
    nicheSlug: "plumber",
    nicheLabel: "Plumber",
    nicheLabelPlural: "Plumbers",
    description: "Local landing page for a plumber in a specific city.",
    services: [
      "Quote request handling",
      "Emergency callout intake",
      "Job booking enquiries",
      "Follow-up reminders",
    ],
  }),
  tradeTemplate({
    key: "roofer",
    nicheSlug: "roofer",
    nicheLabel: "Roofer",
    nicheLabelPlural: "Roofers",
    description: "Local landing page for a roofer in a specific city.",
    services: [
      "Roof inspection enquiries",
      "Quote request handling",
      "Job scheduling enquiries",
      "Follow-up on estimates",
    ],
  }),
];

export const LANDING_TEMPLATE_KEYS: string[] = LANDING_TEMPLATES.map(
  (t) => t.key,
);

export function getLandingTemplate(
  key: string | null | undefined,
): LandingTemplateDef | undefined {
  if (!key) return undefined;
  return LANDING_TEMPLATES.find((t) => t.key === key);
}
