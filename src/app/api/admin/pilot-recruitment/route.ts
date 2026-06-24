import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildCandidates,
  computePilotSummary,
  computeTradeCounts,
  PILOT_TRADES,
  type RawLeadRow,
  type RawPilotRow,
  type Trade,
} from "@/lib/admin/pilot-recruitment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only Pilot Recruitment aggregate for the Command Centre.
//
// Reads existing leads (produced by the scraper / import pipeline) and the
// additive lead_pilot_recruitment overlay, then classifies/filters/ranks them.
// This route NEVER writes and has NO dependency on the scraper or /api/leads/import.
// Admin auth only; no public access.

// Only columns known to exist on public.leads (see supabase/schema.sql leads
// table). We never select or require pilot columns from leads.
const LEAD_SELECT =
  "id,company_name,niche,city,website,contact_phone,contact_email,status,score,lead_score,lead_quality_score,has_live_chat,has_contact_form,created_at";

const PILOT_SELECT =
  "lead_id,pilot_status,pilot_notes,follow_up_at,last_contacted_at,contacted_count,interested_at,pilot_started_at,converted_customer_at,updated_at";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

function parseLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function parseTrade(value: string | null): Trade | null {
  if (!value || value === "all") return null;
  return (PILOT_TRADES as string[]).includes(value) ? (value as Trade) : null;
}

export async function GET(req: NextRequest) {
  const authed = await requireAdmin();
  if (!authed.ok) return authed.response;

  const admin = createAdminClient({ optional: true });
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 400 },
    );
  }
  const a = admin as unknown as SupabaseUntypedClient;

  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams.get("limit"));
  const tradeFilter = parseTrade(searchParams.get("trade"));

  try {
    // Pull leads (newest first) and the full pilot overlay. The overlay is small
    // (one row per tracked lead) so we read it whole and join in memory.
    const [leadsRes, pilotsRes] = await Promise.all([
      a
        .from("leads")
        .select(LEAD_SELECT)
        .order("created_at", { ascending: false })
        .limit(5000),
      a
        .from("lead_pilot_recruitment")
        .select(PILOT_SELECT)
        .limit(5000),
    ]);

    if (leadsRes.error) {
      return NextResponse.json(
        { ok: false, error: leadsRes.error.message },
        { status: 500 },
      );
    }
    // A missing pilot table (migration not yet applied) must not break the view —
    // treat it as "no pilot metadata yet" so candidates still render.
    const pilots = (pilotsRes.error ? [] : (pilotsRes.data as RawPilotRow[])) || [];
    const leads = (leadsRes.data as RawLeadRow[]) || [];

    const now = Date.now();
    const allCandidates = buildCandidates(leads, pilots, { now });
    const filtered = tradeFilter
      ? allCandidates.filter((c) => c.trade === tradeFilter)
      : allCandidates;

    return NextResponse.json({
      ok: true,
      generatedAt: new Date(now).toISOString(),
      summary: computePilotSummary(leads, pilots, now),
      tradeCounts: computeTradeCounts(allCandidates),
      candidates: filtered.slice(0, limit),
      pilotTableReady: !pilotsRes.error,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "pilot_recruitment_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
