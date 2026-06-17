import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { setOutreachQueueStatus } from "@/lib/outreach-queue";

export const runtime = "nodejs";

type LeadRow = { id: string };

export async function POST(req: NextRequest) {
  const authed = await requireAdmin();
  if (!authed.ok) return authed.response;

  let body: { lead_id?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const leadId = typeof body.lead_id === "string" ? body.lead_id.trim() : "";
  if (!leadId) {
    return NextResponse.json(
      { ok: false, error: "lead_id_required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 400 },
    );
  }

  const { data: lead, error: leadError } = await (
    admin as unknown as SupabaseUntypedClient
  )
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .maybeSingle();

  if (leadError) {
    return NextResponse.json(
      { ok: false, error: leadError.message },
      { status: 500 },
    );
  }
  if (!(lead as LeadRow | null)?.id) {
    return NextResponse.json(
      { ok: false, error: "lead_not_found" },
      { status: 404 },
    );
  }

  const result = await setOutreachQueueStatus(admin, {
    leadId,
    status: "called",
    userId: authed.user.id,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, status: "called" });
}
