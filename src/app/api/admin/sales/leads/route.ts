import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

// Read-only lead list for the Sales Workspace "Lead Database" tab.
// Selects only columns already known to exist on the leads table (the same
// columns used by the outreach queue route). This endpoint never writes and
// performs no migrations — it is UI plumbing only.
const LEAD_SELECT =
  "id,company_name,niche,city,lead_quality_score,status,contact_email,website,created_at";

type SalesLeadRow = {
  id: string;
  company_name: string | null;
  niche: string | null;
  city: string | null;
  lead_quality_score: number | null;
  status: string | null;
  contact_email: string | null;
  website: string | null;
  created_at: string | null;
};

function parseLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

export async function GET(req: NextRequest) {
  const authed = await requireAdmin();
  if (!authed.ok) return authed.response;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams.get("limit"));

  const { data, error } = await admin
    .from("leads")
    .select(LEAD_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const leads = (data as SalesLeadRow[] | null) || [];

  return NextResponse.json({ ok: true, leads });
}
