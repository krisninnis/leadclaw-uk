import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { setOutreachQueueStatus } from "@/lib/outreach-queue";
import { recordOutreachActivity } from "@/lib/outreach-activity";
import { suppressEmail } from "@/lib/email";

export const runtime = "nodejs";

const SUPPRESSION_REASON = "do_not_contact";

type LeadRow = { id: string; contact_email: string | null };

export async function POST(req: NextRequest) {
  const authed = await requireAdmin();
  if (!authed.ok) return authed.response;

  let body: { lead_id?: unknown; email?: unknown } = {};
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
    .select("id,contact_email")
    .eq("id", leadId)
    .maybeSingle();

  if (leadError) {
    return NextResponse.json(
      { ok: false, error: leadError.message },
      { status: 500 },
    );
  }

  const leadRow = lead as LeadRow | null;
  if (!leadRow?.id) {
    return NextResponse.json(
      { ok: false, error: "lead_not_found" },
      { status: 404 },
    );
  }

  // Require an email: use the lead's email, or one supplied in the body when
  // the lead has none on record.
  const bodyEmail = typeof body.email === "string" ? body.email.trim() : "";
  const email = (leadRow.contact_email || bodyEmail).trim();
  if (!email) {
    return NextResponse.json(
      { ok: false, error: "email_required" },
      { status: 400 },
    );
  }

  // Reuse the existing email_suppressions mechanism (upsert by email).
  const { error: suppressError } = await suppressEmail(email, SUPPRESSION_REASON);
  if (suppressError) {
    return NextResponse.json(
      { ok: false, error: "suppression_failed" },
      { status: 500 },
    );
  }

  const result = await setOutreachQueueStatus(admin, {
    leadId,
    status: "do_not_contact",
    userId: authed.user.id,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 500 },
    );
  }

  // Audit trail (best-effort): record the action after the queue update.
  const activity = await recordOutreachActivity({
    leadId,
    action: "do_not_contact",
    userId: authed.user.id,
    metadata: { email, suppression_reason: SUPPRESSION_REASON },
  });

  return NextResponse.json({
    ok: true,
    status: "do_not_contact",
    activity_logged: activity.ok,
  });
}
