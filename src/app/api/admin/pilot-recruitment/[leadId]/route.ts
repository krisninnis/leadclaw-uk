import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPilotStatus, type PilotStatus } from "@/lib/admin/pilot-recruitment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only write endpoint for Pilot Recruitment.
//
// POST /api/admin/pilot-recruitment/[leadId]
//   Upserts the lead's row in lead_pilot_recruitment (keyed by lead_id). It
//   writes ONLY to that additive overlay table — it never mutates public.leads,
//   the scraper, or /api/leads/import. No public access.
//
// Accepted body (all optional; at least one required):
//   pilot_status   one of the 7 allowed statuses (sets matching milestone ts)
//   pilot_notes    string | null
//   follow_up_at   ISO datetime string | null
//   markContacted  boolean — increments contacted_count, stamps last_contacted_at

type RouteContext = { params: Promise<{ leadId: string }> };

type UpdateBody = {
  pilot_status?: unknown;
  pilot_notes?: unknown;
  follow_up_at?: unknown;
  markContacted?: unknown;
};

type PilotRow = {
  lead_id: string;
  pilot_status: string | null;
  pilot_notes: string | null;
  follow_up_at: string | null;
  last_contacted_at: string | null;
  contacted_count: number | null;
  interested_at: string | null;
  pilot_started_at: string | null;
  converted_customer_at: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

// Validate an ISO datetime string; returns the normalised ISO value, null (to
// clear), or undefined when the field was not provided / invalid.
function parseFollowUp(value: unknown): { ok: boolean; value?: string | null } {
  if (value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  const t = new Date(trimmed).getTime();
  if (!Number.isFinite(t)) return { ok: false };
  return { ok: true, value: new Date(t).toISOString() };
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const authed = await requireAdmin();
  if (!authed.ok) return authed.response;

  const { leadId } = await ctx.params;
  if (!leadId || !UUID_RE.test(leadId)) return badRequest("invalid_lead_id");

  let body: UpdateBody;
  try {
    body = (await req.json()) as UpdateBody;
  } catch {
    return badRequest("invalid_json");
  }

  // --- Validate inputs -------------------------------------------------------
  const patch: Record<string, unknown> = {};
  const now = new Date().toISOString();

  let nextStatus: PilotStatus | undefined;
  if (body.pilot_status !== undefined) {
    if (!isPilotStatus(body.pilot_status)) return badRequest("invalid_pilot_status");
    nextStatus = body.pilot_status;
    patch.pilot_status = nextStatus;
  }

  if (body.pilot_notes !== undefined) {
    if (body.pilot_notes === null) {
      patch.pilot_notes = null;
    } else if (typeof body.pilot_notes === "string") {
      if (body.pilot_notes.length > 5000) return badRequest("notes_too_long");
      patch.pilot_notes = body.pilot_notes;
    } else {
      return badRequest("invalid_notes");
    }
  }

  if (body.follow_up_at !== undefined) {
    const parsed = parseFollowUp(body.follow_up_at);
    if (!parsed.ok) return badRequest("invalid_follow_up_at");
    patch.follow_up_at = parsed.value;
  }

  const markContacted = body.markContacted === true;

  if (Object.keys(patch).length === 0 && !markContacted) {
    return badRequest("no_fields");
  }

  const admin = createAdminClient({ optional: true });
  if (!admin) return badRequest("supabase_not_configured");
  const a = admin as unknown as SupabaseUntypedClient;

  try {
    // Confirm the lead exists (we only ever attach metadata to a real lead). We
    // do NOT read or modify any pilot-irrelevant lead field.
    const leadRes = await a
      .from("leads")
      .select("id")
      .eq("id", leadId)
      .maybeSingle();
    if (leadRes.error) {
      return NextResponse.json(
        { ok: false, error: leadRes.error.message },
        { status: 500 },
      );
    }
    if (!leadRes.data) {
      return NextResponse.json(
        { ok: false, error: "lead_not_found" },
        { status: 404 },
      );
    }

    // Load any existing overlay row so we can increment counters and only stamp
    // milestone timestamps the first time they occur.
    const existingRes = await a
      .from("lead_pilot_recruitment")
      .select(
        "lead_id,pilot_status,pilot_notes,follow_up_at,last_contacted_at,contacted_count,interested_at,pilot_started_at,converted_customer_at",
      )
      .eq("lead_id", leadId)
      .maybeSingle();
    const existing = (existingRes.data as PilotRow | null) || null;

    // Status-driven milestone timestamps (only set once).
    if (nextStatus === "interested" && !existing?.interested_at) {
      patch.interested_at = now;
    }
    if (nextStatus === "pilot" && !existing?.pilot_started_at) {
      patch.pilot_started_at = now;
    }
    if (nextStatus === "customer" && !existing?.converted_customer_at) {
      patch.converted_customer_at = now;
    }

    // Mark contacted: bump count + stamp time, and advance a brand-new candidate
    // to "contacted" unless the caller set a more specific status.
    if (markContacted) {
      patch.last_contacted_at = now;
      patch.contacted_count = (existing?.contacted_count ?? 0) + 1;
      if (!nextStatus) {
        const current = existing?.pilot_status;
        if (!current || current === "candidate") patch.pilot_status = "contacted";
      }
    }

    const row = {
      lead_id: leadId,
      ...patch,
    };

    const upsertRes = await a
      .from("lead_pilot_recruitment")
      .upsert(row, { onConflict: "lead_id" })
      .select(
        "lead_id,pilot_status,pilot_notes,follow_up_at,last_contacted_at,contacted_count,interested_at,pilot_started_at,converted_customer_at,updated_at",
      )
      .maybeSingle();

    if (upsertRes.error) {
      return NextResponse.json(
        { ok: false, error: upsertRes.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, pilot: upsertRes.data });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "pilot_update_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
