// ClawLabsLocal — Landing Page Builder (Phase A)
// Structured-field editor (NOT a visual/WYSIWYG editor) shared by the create
// and edit screens. Handles save (POST/PATCH), publish, unpublish, and a live
// validation panel that mirrors the server publish gate exactly.

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RepeatableField from "@/components/landing/repeatable-field";
import { generateSlug } from "@/lib/landing/slug";
import {
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  validatePublish,
} from "@/lib/landing/validate";
import type {
  LandingBusinessSchema,
  LandingContent,
  LandingPageRow,
  LandingStatus,
} from "@/lib/landing/types";
import {
  generateDraftFromTemplate,
  getLandingTemplate,
  summarizeTemplate,
} from "@/lib/landing/templates";

type EditorTemplate = {
  id: string;
  key: string;
  name: string;
  default_content?: Partial<LandingContent> | null;
};

type Props = {
  mode: "create" | "edit";
  initialPage: LandingPageRow | null;
  templates: EditorTemplate[];
};

type FaqRow = { question: string; answer: string };
type RelatedRow = { href: string; label: string };

type FormState = {
  template_id: string;
  slug: string;
  niche: string;
  city: string;
  region: string;
  country: string;
  seo_title: string;
  seo_description: string;
  canonical_path: string;
  og_image_path: string;
  noindex: boolean;
  h1: string;
  subheading: string;
  pains: string[];
  benefits: string[];
  features: string[];
  useCases: string[];
  faq: FaqRow[];
  relatedLinks: RelatedRow[];
  businessName: string;
  street: string;
  locality: string;
  addrRegion: string;
  postalCode: string;
  addrCountry: string;
  phone: string;
  services: string[];
  ratingValue: string;
  ratingCount: string;
};

function initialForm(page: LandingPageRow | null): FormState {
  const c = page?.content;
  const bs = page?.business_schema;
  return {
    template_id: page?.template_id || "",
    slug: page?.slug || "",
    niche: page?.niche || "",
    city: page?.city || "",
    region: page?.region || "",
    country: page?.country || "GB",
    seo_title: page?.seo_title || "",
    seo_description: page?.seo_description || "",
    canonical_path: page?.canonical_path || "",
    og_image_path: page?.og_image_path || "",
    noindex: page?.noindex ?? false,
    h1: c?.h1 || "",
    subheading: c?.subheading || "",
    pains: c?.pains || [],
    benefits: c?.benefits || [],
    features: c?.features || [],
    useCases: c?.useCases || [],
    faq: c?.faq?.length ? c.faq.map((f) => ({ ...f })) : [],
    relatedLinks: c?.relatedLinks?.length
      ? c.relatedLinks.map((l) => ({ ...l }))
      : [],
    businessName: bs?.businessName || "",
    street: bs?.address?.street || "",
    locality: bs?.address?.locality || "",
    addrRegion: bs?.address?.region || "",
    postalCode: bs?.address?.postalCode || "",
    addrCountry: bs?.address?.country || "",
    phone: bs?.phone || "",
    services: bs?.services || [],
    ratingValue: bs?.rating ? String(bs.rating.value) : "",
    ratingCount: bs?.rating ? String(bs.rating.count) : "",
  };
}

const clean = (arr: string[]) => arr.map((s) => s.trim()).filter(Boolean);

function buildContent(form: FormState): LandingContent {
  return {
    h1: form.h1.trim(),
    subheading: form.subheading.trim(),
    pains: clean(form.pains),
    benefits: clean(form.benefits),
    features: clean(form.features),
    useCases: clean(form.useCases),
    faq: form.faq
      .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }))
      .filter((f) => f.question || f.answer),
    relatedLinks: form.relatedLinks
      .map((l) => ({ href: l.href.trim(), label: l.label.trim() }))
      .filter((l) => l.href && l.label),
  };
}

function buildBusinessSchema(form: FormState): LandingBusinessSchema {
  const out: LandingBusinessSchema = {};
  if (form.businessName.trim()) out.businessName = form.businessName.trim();
  if (form.phone.trim()) out.phone = form.phone.trim();

  const services = clean(form.services);
  if (services.length) out.services = services;

  const address: Record<string, string> = {};
  if (form.street.trim()) address.street = form.street.trim();
  if (form.locality.trim()) address.locality = form.locality.trim();
  if (form.addrRegion.trim()) address.region = form.addrRegion.trim();
  if (form.postalCode.trim()) address.postalCode = form.postalCode.trim();
  if (form.addrCountry.trim()) address.country = form.addrCountry.trim();
  if (Object.keys(address).length) out.address = address;

  const ratingValue = Number(form.ratingValue);
  const ratingCount = Number(form.ratingCount);
  if (
    form.ratingValue.trim() &&
    form.ratingCount.trim() &&
    Number.isFinite(ratingValue) &&
    Number.isFinite(ratingCount) &&
    ratingCount > 0
  ) {
    out.rating = { value: ratingValue, count: ratingCount };
  }
  return out;
}

function buildPayload(form: FormState) {
  return {
    template_id: form.template_id || null,
    slug: form.slug.trim() || undefined,
    niche: form.niche.trim() || null,
    city: form.city.trim() || null,
    region: form.region.trim() || null,
    country: form.country.trim() || "GB",
    seo_title: form.seo_title,
    seo_description: form.seo_description,
    canonical_path: form.canonical_path.trim() || null,
    og_image_path: form.og_image_path.trim() || null,
    noindex: form.noindex,
    content: buildContent(form),
    business_schema: buildBusinessSchema(form),
  };
}

export default function LandingPageEditor({ mode, initialPage, templates }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialForm(initialPage));
  const [pageId, setPageId] = useState<string | null>(initialPage?.id || null);
  const [status, setStatus] = useState<LandingStatus>(
    initialPage?.status || "draft",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "save" | "publish" | "unpublish">(
    null,
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  // Live mirror of the server publish gate.
  const validation = useMemo(
    () =>
      validatePublish({
        slug: form.slug.trim() || generateSlug(form.niche, form.city),
        city: form.city.trim() || null,
        seo_title: form.seo_title,
        seo_description: form.seo_description,
        content: buildContent(form),
        business_schema: buildBusinessSchema(form),
      }),
    [form],
  );

  function autoSlug() {
    set("slug", generateSlug(form.niche, form.city));
  }

  const selectedTemplate =
    templates.find((t) => t.id === form.template_id) || null;
  const templateDef = selectedTemplate
    ? getLandingTemplate(selectedTemplate.key)
    : undefined;
  const templateSummary = templateDef ? summarizeTemplate(templateDef) : null;

  // Selecting a template sets it and pre-fills the niche when empty. It does
  // NOT overwrite content — use "Generate draft" for that.
  function selectTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    const def = tpl ? getLandingTemplate(tpl.key) : undefined;
    setForm((current) => ({
      ...current,
      template_id: templateId,
      niche: current.niche || def?.nicheSlug || "",
    }));
  }

  // Deterministically expand the selected template into editable fields for the
  // current city/region. No save, no publish — the admin reviews first.
  function runGeneration(successMessage: string) {
    if (!templateDef) {
      setMessage("Choose a template first.");
      return;
    }
    if (!form.city.trim()) {
      setMessage("Enter a city before generating a draft.");
      return;
    }
    const draft = generateDraftFromTemplate(templateDef, {
      city: form.city,
      region: form.region,
      country: form.country,
    });
    setForm((current) => ({
      ...current,
      niche: draft.niche,
      slug: draft.slug,
      seo_title: draft.seo_title,
      seo_description: draft.seo_description,
      canonical_path: draft.canonical_path,
      h1: draft.content.h1,
      subheading: draft.content.subheading,
      pains: draft.content.pains,
      benefits: draft.content.benefits,
      features: draft.content.features,
      useCases: draft.content.useCases,
      faq: draft.content.faq.map((item) => ({ ...item })),
      relatedLinks: draft.content.relatedLinks.map((link) => ({ ...link })),
      services: draft.services,
    }));
    setMessage(successMessage);
  }

  function generateDraft() {
    runGeneration(
      "Draft generated from the template — review and edit every field before publishing. Nothing has been saved.",
    );
  }

  function resetToTemplate() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Replace all content fields with the template defaults? Your current edits will be lost.",
      )
    ) {
      return;
    }
    runGeneration("Reset to template defaults — review before publishing.");
  }

  // Save: POST on create (then route to the edit screen), PATCH on edit.
  async function save(): Promise<string | null> {
    setBusy("save");
    setMessage(null);
    try {
      const url =
        mode === "create" || !pageId
          ? "/api/admin/landing-pages"
          : `/api/admin/landing-pages/${pageId}`;
      const method = mode === "create" || !pageId ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(form)),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error || "Save failed");

      const id: string = body.page.id;
      setPageId(id);
      setStatus(body.page.status);
      setMessage("Saved.");
      if (mode === "create") {
        router.push(`/admin/landing-pages/${id}`);
        router.refresh();
      }
      return id;
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Save failed");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    if (!validation.ok) {
      setMessage("Resolve the validation issues before publishing.");
      return;
    }
    setBusy("publish");
    setMessage(null);
    try {
      // Persist current edits first so we publish what is on screen.
      const id =
        pageId ??
        (await (async () => {
          const saved = await save();
          return saved;
        })());
      if (!id) return;

      const res = await fetch(`/api/admin/landing-pages/${id}/publish`, {
        method: "POST",
      });
      const body = await res.json();
      if (res.status === 422) {
        const issues = (body.issues || [])
          .map((i: { message: string }) => i.message)
          .join(" ");
        setMessage(`Publish blocked: ${issues}`);
        return;
      }
      if (!res.ok || !body.ok) throw new Error(body.error || "Publish failed");
      setStatus("published");
      setMessage("Published.");
      router.refresh();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Publish failed");
    } finally {
      setBusy(null);
    }
  }

  async function unpublish() {
    if (!pageId) return;
    setBusy("unpublish");
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/landing-pages/${pageId}/unpublish`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error || "Unpublish failed");
      setStatus("draft");
      setMessage("Unpublished — now a draft.");
      router.refresh();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Unpublish failed");
    } finally {
      setBusy(null);
    }
  }

  const titleLen = form.seo_title.length;
  const descLen = form.seo_description.length;
  const previewHref = pageId
    ? `/admin/landing-pages/${pageId}/preview`
    : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)]">
      <div className="space-y-6">
        {/* Targeting + template */}
        <section className="card-premium p-6 md:p-8">
          <h2 className="text-lg font-semibold text-foreground">Targeting</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-3 md:col-span-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-foreground">
                  Template
                </span>
                <select
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={form.template_id}
                  onChange={(e) => selectTemplate(e.target.value)}
                >
                  <option value="">No template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>

              {templateDef && templateSummary ? (
                <div className="rounded-xl border border-border bg-surface-2/50 p-3 text-xs text-muted">
                  <p className="font-medium text-foreground">
                    Template includes
                  </p>
                  <p className="mt-1 leading-5">
                    {templateSummary.benefits} benefits · {templateSummary.pains}{" "}
                    pain points · {templateSummary.features} features ·{" "}
                    {templateSummary.useCases} use cases · {templateSummary.faqs}{" "}
                    FAQs · {templateSummary.services} services
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted">
                  Pick a template and enter a city, then Generate draft to
                  pre-fill every field. You review and edit before publishing.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="button-primary"
                  disabled={busy !== null || !templateDef}
                  onClick={generateDraft}
                >
                  Generate draft
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={busy !== null || !templateDef}
                  onClick={resetToTemplate}
                >
                  Reset to template
                </button>
              </div>
            </div>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">Niche</span>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="aesthetic-clinic"
                value={form.niche}
                onChange={(e) => set("niche", e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">City</span>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="Nottingham"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">Region</span>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="East Midlands"
                value={form.region}
                onChange={(e) => set("region", e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">Country</span>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
              />
            </label>

            <label className="space-y-1.5 md:col-span-2">
              <span className="text-sm font-medium text-foreground">Slug</span>
              <div className="flex gap-2">
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="aesthetic-clinic-nottingham"
                  value={form.slug}
                  onChange={(e) => set("slug", e.target.value)}
                />
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2"
                  onClick={autoSlug}
                >
                  Auto
                </button>
              </div>
              <span className="block text-xs text-muted">
                Public URL: /lp/{form.slug || generateSlug(form.niche, form.city) || "…"}
              </span>
            </label>
          </div>
        </section>

        {/* SEO */}
        <section className="card-premium p-6 md:p-8">
          <h2 className="text-lg font-semibold text-foreground">SEO metadata</h2>
          <div className="mt-4 space-y-4">
            <label className="space-y-1.5">
              <span className="flex items-center justify-between text-sm font-medium text-foreground">
                <span>SEO title</span>
                <span
                  className={
                    titleLen > SEO_TITLE_MAX ? "text-rose-600" : "text-muted-2"
                  }
                >
                  {titleLen}/{SEO_TITLE_MAX}
                </span>
              </span>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={form.seo_title}
                onChange={(e) => set("seo_title", e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="flex items-center justify-between text-sm font-medium text-foreground">
                <span>Meta description</span>
                <span
                  className={
                    descLen > SEO_DESCRIPTION_MAX
                      ? "text-rose-600"
                      : "text-muted-2"
                  }
                >
                  {descLen}/{SEO_DESCRIPTION_MAX}
                </span>
              </span>
              <textarea
                className="w-full rounded-xl border px-3 py-2 text-sm"
                rows={2}
                value={form.seo_description}
                onChange={(e) => set("seo_description", e.target.value)}
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-foreground">
                  Canonical path
                </span>
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder={`/lp/${form.slug || "slug"}`}
                  value={form.canonical_path}
                  onChange={(e) => set("canonical_path", e.target.value)}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-foreground">
                  OG image path
                </span>
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="/brand/…"
                  value={form.og_image_path}
                  onChange={(e) => set("og_image_path", e.target.value)}
                />
              </label>
            </div>
            <label className="flex items-center gap-3 rounded-xl border p-3">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={form.noindex}
                onChange={(e) => set("noindex", e.target.checked)}
              />
              <span className="text-sm text-foreground">
                noindex (keep out of search even when published)
              </span>
            </label>
          </div>
        </section>

        {/* Content */}
        <section className="card-premium p-6 md:p-8">
          <h2 className="text-lg font-semibold text-foreground">Content</h2>
          <div className="mt-4 space-y-4">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">H1</span>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={form.h1}
                onChange={(e) => set("h1", e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">
                Subheading
              </span>
              <textarea
                className="w-full rounded-xl border px-3 py-2 text-sm"
                rows={2}
                value={form.subheading}
                onChange={(e) => set("subheading", e.target.value)}
              />
            </label>

            <RepeatableField
              label="Pain points"
              values={form.pains}
              onChange={(v) => set("pains", v)}
              placeholder="A locally-specific problem this page addresses"
              multiline
            />
            <RepeatableField
              label="Benefits"
              values={form.benefits}
              onChange={(v) => set("benefits", v)}
              multiline
            />
            <RepeatableField
              label="Features / steps"
              values={form.features}
              onChange={(v) => set("features", v)}
            />
            <RepeatableField
              label="Use cases"
              values={form.useCases}
              onChange={(v) => set("useCases", v)}
              multiline
            />

            {/* FAQ pairs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  FAQ (min 3 to publish)
                </span>
                <span className="text-xs text-muted-2">{form.faq.length}</span>
              </div>
              {form.faq.map((row, index) => (
                <div key={index} className="space-y-2 rounded-xl border p-3">
                  <input
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Question"
                    value={row.question}
                    onChange={(e) => {
                      const faq = [...form.faq];
                      faq[index] = { ...faq[index], question: e.target.value };
                      set("faq", faq);
                    }}
                  />
                  <textarea
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Answer"
                    value={row.answer}
                    onChange={(e) => {
                      const faq = [...form.faq];
                      faq[index] = { ...faq[index], answer: e.target.value };
                      set("faq", faq);
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:border-rose-300 hover:text-rose-600"
                    onClick={() =>
                      set(
                        "faq",
                        form.faq.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove question
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
                onClick={() => set("faq", [...form.faq, { question: "", answer: "" }])}
              >
                + Add FAQ
              </button>
            </div>

            {/* Related links */}
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">
                Related links
              </span>
              {form.relatedLinks.map((row, index) => (
                <div key={index} className="flex flex-wrap gap-2">
                  <input
                    className="min-w-[140px] flex-1 rounded-lg border px-3 py-2 text-sm"
                    placeholder="/lp/other-page"
                    value={row.href}
                    onChange={(e) => {
                      const links = [...form.relatedLinks];
                      links[index] = { ...links[index], href: e.target.value };
                      set("relatedLinks", links);
                    }}
                  />
                  <input
                    className="min-w-[140px] flex-1 rounded-lg border px-3 py-2 text-sm"
                    placeholder="Link label"
                    value={row.label}
                    onChange={(e) => {
                      const links = [...form.relatedLinks];
                      links[index] = { ...links[index], label: e.target.value };
                      set("relatedLinks", links);
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:border-rose-300 hover:text-rose-600"
                    onClick={() =>
                      set(
                        "relatedLinks",
                        form.relatedLinks.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
                onClick={() =>
                  set("relatedLinks", [...form.relatedLinks, { href: "", label: "" }])
                }
              >
                + Add link
              </button>
            </div>
          </div>
        </section>

        {/* Local business schema */}
        <section className="card-premium p-6 md:p-8">
          <h2 className="text-lg font-semibold text-foreground">
            Local business schema (optional)
          </h2>
          <p className="mt-1 text-xs text-muted">
            Only emitted when genuinely provided — never synthesise an address or
            rating.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 md:col-span-2">
              <span className="text-sm font-medium text-foreground">
                Business name
              </span>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={form.businessName}
                onChange={(e) => set("businessName", e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">Street</span>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={form.street}
                onChange={(e) => set("street", e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">Locality</span>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={form.locality}
                onChange={(e) => set("locality", e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">
                Address region
              </span>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={form.addrRegion}
                onChange={(e) => set("addrRegion", e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">Postcode</span>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={form.postalCode}
                onChange={(e) => set("postalCode", e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">Phone</span>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">
                Address country
              </span>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="GB"
                value={form.addrCountry}
                onChange={(e) => set("addrCountry", e.target.value)}
              />
            </label>

            <div className="md:col-span-2">
              <RepeatableField
                label="Services"
                values={form.services}
                onChange={(v) => set("services", v)}
                placeholder="e.g. Consultation enquiry handling"
                hint="At least one service is required to publish."
              />
            </div>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">
                Rating value
              </span>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="4.8"
                value={form.ratingValue}
                onChange={(e) => set("ratingValue", e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">
                Rating count
              </span>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="126"
                value={form.ratingCount}
                onChange={(e) => set("ratingCount", e.target.value)}
              />
            </label>
          </div>
        </section>
      </div>

      {/* Sticky action / validation panel */}
      <aside className="space-y-4">
        <div className="card-premium sticky top-6 space-y-4 p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Status</span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                status === "published"
                  ? "bg-emerald-100 text-emerald-700"
                  : status === "archived"
                    ? "bg-slate-200 text-slate-700"
                    : "bg-amber-100 text-amber-800"
              }`}
            >
              {status}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="button-secondary"
              disabled={busy !== null}
              onClick={save}
            >
              {busy === "save" ? "Saving…" : "Save draft"}
            </button>
            {previewHref ? (
              <a
                href={previewHref}
                target="_blank"
                rel="noreferrer"
                className="button-secondary text-center"
              >
                Preview ↗
              </a>
            ) : (
              <span className="text-center text-xs text-muted">
                Save once to enable preview.
              </span>
            )}
            <button
              type="button"
              className="button-primary"
              disabled={busy !== null || !validation.ok}
              onClick={publish}
            >
              {busy === "publish" ? "Publishing…" : "Publish"}
            </button>
            {status === "published" ? (
              <button
                type="button"
                className="button-secondary"
                disabled={busy !== null}
                onClick={unpublish}
              >
                {busy === "unpublish" ? "Unpublishing…" : "Unpublish"}
              </button>
            ) : null}
            {status === "published" && form.slug ? (
              <a
                href={`/lp/${form.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-center text-xs font-medium text-brand-strong hover:underline"
              >
                Open live page ↗
              </a>
            ) : null}
          </div>

          {message ? (
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-muted">
              {message}
            </p>
          ) : null}

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                Publish checklist
              </span>
              <span className="text-xs text-muted-2">
                {validation.wordCount} words
              </span>
            </div>
            {validation.ok ? (
              <p className="mt-2 text-sm text-emerald-700">
                All checks pass — ready to publish.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {validation.issues.map((issue) => (
                  <li
                    key={issue.code}
                    className="flex gap-2 text-xs text-rose-700"
                  >
                    <span aria-hidden="true">•</span>
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
