import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  rankOpportunities,
  recommendNextArticle,
  getClusters,
  computeQueueSummary,
  getExistingInventory,
  summarizeInventory,
  findDuplicateSlugs,
  type StatusRow,
} from "@/lib/seo/content-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only SEO Content Engine aggregate for the Command Centre.
//
// The backlog, scoring, clusters, and recommendation all come from curated code
// (src/lib/seo/content-engine.ts). The only DB read is the optional status
// overlay (seo_content_status); if that table is absent the engine still works
// and every opportunity shows as "backlog". This route NEVER writes and has no
// dependency on Lead Finder, the scraper, outreach, billing, or auth beyond the
// admin gate. Admin only; no public access.

export async function GET() {
  const authed = await requireAdmin();
  if (!authed.ok) return authed.response;

  let statusRows: StatusRow[] = [];
  let statusTableReady = false;

  const admin = createAdminClient({ optional: true });
  if (admin) {
    const a = admin as unknown as SupabaseUntypedClient;
    const res = await a
      .from("seo_content_status")
      .select("opportunity_slug,status,notes,updated_at")
      .limit(1000);
    if (!res.error && Array.isArray(res.data)) {
      statusTableReady = true;
      statusRows = (res.data as Array<{
        opportunity_slug: string;
        status: string | null;
        notes: string | null;
        updated_at: string | null;
      }>).map((r) => ({
        slug: r.opportunity_slug,
        status: r.status,
        notes: r.notes,
        updated_at: r.updated_at,
      }));
    }
  }

  const ranked = rankOpportunities(undefined, statusRows);
  const inventory = getExistingInventory();

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    statusTableReady,
    nextArticle: recommendNextArticle(undefined, statusRows),
    summary: computeQueueSummary(ranked),
    opportunities: ranked,
    clusters: getClusters(undefined, statusRows),
    inventory: {
      summary: summarizeInventory(inventory),
      duplicates: findDuplicateSlugs(),
      items: inventory,
    },
  });
}
