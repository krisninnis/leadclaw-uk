// ClawLabsLocal — Landing Page Builder (Phase A)
// Persistence helpers for landing_pages / landing_page_templates /
// landing_page_events. All writes go through the service-role admin client
// (RLS grants the public only `select` on published rows), mirroring
// src/lib/audit/store.ts.

import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeBusinessSchema,
  normalizeContent,
  type LandingEventType,
  type LandingPageListItem,
  type LandingPageRow,
  type LandingStatus,
  type LandingTemplate,
  type PublicLandingPage,
} from "./types";
import type { CreateLandingInput, UpdateLandingInput } from "./validate";

const TABLE = "landing_pages";
const TEMPLATES_TABLE = "landing_page_templates";
const EVENTS_TABLE = "landing_page_events";

// Full admin column set.
const SELECT_COLS =
  "id,slug,template_id,created_by,updated_by,status,niche,city,region,country,seo_title,seo_description,canonical_path,og_image_path,noindex,content,business_schema,meta,published_at,created_at,updated_at";

// Safe column set served to the public route (no authorship/provenance).
const PUBLIC_SELECT_COLS =
  "id,slug,status,niche,city,region,country,seo_title,seo_description,canonical_path,og_image_path,noindex,content,business_schema,published_at,updated_at";

// Compact column set for the admin list table.
const LIST_SELECT_COLS =
  "id,slug,status,niche,city,region,seo_title,noindex,published_at,updated_at";

function admin() {
  const client = createAdminClient({ optional: true });
  return client as unknown as SupabaseUntypedClient | null;
}

// Coerce the raw jsonb columns into fully-typed shapes so callers never see
// half-populated content/business_schema.
function hydrate(row: Record<string, unknown>): LandingPageRow {
  return {
    ...(row as unknown as LandingPageRow),
    content: normalizeContent(row.content),
    business_schema: normalizeBusinessSchema(row.business_schema),
    meta: (row.meta as LandingPageRow["meta"]) ?? {},
  };
}

function hydratePublic(row: Record<string, unknown>): PublicLandingPage {
  return {
    ...(row as unknown as PublicLandingPage),
    content: normalizeContent(row.content),
    business_schema: normalizeBusinessSchema(row.business_schema),
  };
}

export type ListFilters = {
  status?: LandingStatus;
  niche?: string;
  city?: string;
  search?: string;
  limit?: number;
};

export async function listLandingPages(
  filters: ListFilters = {},
): Promise<LandingPageListItem[]> {
  const db = admin();
  if (!db) return [];

  let query = db.from(TABLE).select(LIST_SELECT_COLS);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.niche) query = query.eq("niche", filters.niche);
  if (filters.city) query = query.eq("city", filters.city);
  if (filters.search) {
    const term = filters.search.replace(/[%,]/g, "");
    query = query.or(
      `slug.ilike.%${term}%,seo_title.ilike.%${term}%,city.ilike.%${term}%`,
    );
  }

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .limit(filters.limit ?? 100);

  if (error) {
    console.error("[landing] failed to list pages", error);
    return [];
  }
  return (data as unknown as LandingPageListItem[]) || [];
}

export async function getLandingPageById(
  id: string,
): Promise<LandingPageRow | null> {
  const db = admin();
  if (!db) return null;

  const { data, error } = await db
    .from(TABLE)
    .select(SELECT_COLS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[landing] failed to load page by id", error);
    return null;
  }
  return data ? hydrate(data as Record<string, unknown>) : null;
}

// Public loader — published rows only, safe columns only. Drafts/archived and
// unknown slugs resolve to null (the route returns notFound()).
export async function getPublishedLandingPage(
  slug: string,
): Promise<PublicLandingPage | null> {
  const db = admin();
  if (!db) return null;

  const { data, error } = await db
    .from(TABLE)
    .select(PUBLIC_SELECT_COLS)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error("[landing] failed to load published page", error);
    return null;
  }
  return data ? hydratePublic(data as Record<string, unknown>) : null;
}

// Is this slug already taken? Optionally exclude one row (for updates).
export async function slugExists(
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const db = admin();
  if (!db) return false;

  let query = db.from(TABLE).select("id").eq("slug", slug);
  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) {
    console.error("[landing] failed slug existence check", error);
    return false;
  }
  return !!data;
}

export async function createLandingPage(
  input: CreateLandingInput,
  userId: string,
): Promise<LandingPageRow | null> {
  const db = admin();
  if (!db) return null;

  const { data, error } = await db
    .from(TABLE)
    .insert({
      slug: input.slug,
      template_id: input.template_id,
      created_by: userId,
      updated_by: userId,
      status: "draft",
      niche: input.niche,
      city: input.city,
      region: input.region,
      country: input.country,
      seo_title: input.seo_title,
      seo_description: input.seo_description,
      canonical_path: input.canonical_path,
      og_image_path: input.og_image_path,
      noindex: input.noindex,
      content: input.content,
      business_schema: input.business_schema,
    })
    .select(SELECT_COLS)
    .single();

  if (error) {
    console.error("[landing] failed to create page", error);
    return null;
  }
  return hydrate(data as Record<string, unknown>);
}

export async function updateLandingPage(
  id: string,
  patch: UpdateLandingInput,
  userId: string,
): Promise<LandingPageRow | null> {
  const db = admin();
  if (!db) return null;

  const payload: Record<string, unknown> = {
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) payload[key] = value;
  }

  const { data, error } = await db
    .from(TABLE)
    .update(payload)
    .eq("id", id)
    .select(SELECT_COLS)
    .single();

  if (error) {
    console.error("[landing] failed to update page", error);
    return null;
  }
  return hydrate(data as Record<string, unknown>);
}

// Flip status. Publishing stamps published_at; unpublishing clears it.
export async function setLandingPageStatus(
  id: string,
  status: LandingStatus,
  userId: string,
): Promise<LandingPageRow | null> {
  const db = admin();
  if (!db) return null;

  const payload: Record<string, unknown> = {
    status,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
  if (status === "published") {
    payload.published_at = new Date().toISOString();
  } else if (status === "draft") {
    payload.published_at = null;
  }

  const { data, error } = await db
    .from(TABLE)
    .update(payload)
    .eq("id", id)
    .select(SELECT_COLS)
    .single();

  if (error) {
    console.error("[landing] failed to set page status", error);
    return null;
  }
  return hydrate(data as Record<string, unknown>);
}

export type SitemapEntry = {
  slug: string;
  canonical_path: string | null;
  updated_at: string;
};

// Published, non-noindex pages for the sitemap. Returns [] when the admin
// client is unavailable (e.g. at build time without service-role creds) so the
// sitemap and build never fail.
export async function listPublishedForSitemap(): Promise<SitemapEntry[]> {
  const db = admin();
  if (!db) return [];

  const { data, error } = await db
    .from(TABLE)
    .select("slug,canonical_path,updated_at")
    .eq("status", "published")
    .eq("noindex", false)
    .order("updated_at", { ascending: false })
    .limit(5000);

  if (error) {
    console.error("[landing] failed to load sitemap entries", error);
    return [];
  }
  return (data as unknown as SitemapEntry[]) || [];
}

// All published slugs — used by generateStaticParams() on /lp/[slug].
export async function listPublishedSlugs(): Promise<string[]> {
  const db = admin();
  if (!db) return [];

  const { data, error } = await db
    .from(TABLE)
    .select("slug")
    .eq("status", "published")
    .limit(5000);

  if (error) {
    console.error("[landing] failed to load published slugs", error);
    return [];
  }
  return ((data as unknown as { slug: string }[]) || []).map((r) => r.slug);
}

export async function listActiveTemplates(): Promise<LandingTemplate[]> {
  const db = admin();
  if (!db) return [];

  const { data, error } = await db
    .from(TEMPLATES_TABLE)
    .select("id,key,name,description,default_content,schema_types,status")
    .eq("status", "active")
    .order("name", { ascending: true })
    .limit(50);

  if (error) {
    console.error("[landing] failed to load templates", error);
    return [];
  }
  return (data as unknown as LandingTemplate[]) || [];
}

// Record a first-party, PII-free engagement event. Best-effort; never throws.
export async function recordLandingEvent(
  landingPageId: string,
  eventType: LandingEventType,
  context: Record<string, unknown> = {},
): Promise<void> {
  const db = admin();
  if (!db) return;

  const { error } = await db.from(EVENTS_TABLE).insert({
    landing_page_id: landingPageId,
    event_type: eventType,
    context,
  });
  if (error) console.error("[landing] failed to record event", error);
}
