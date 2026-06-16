import { NextResponse } from "next/server";
import {
  LEAD_ENRICHMENT_SELECT,
  scoreLeadQualityConservatively,
  type LeadEnrichmentRow,
} from "@/lib/lead-enrichment";
import { logSystemEvent } from "@/lib/ops";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

type RescoreBody = {
  apply?: unknown;
  limit?: unknown;
  ids?: unknown;
  created_after?: unknown;
  createdAfter?: unknown;
};

type RescoreResult = {
  id: string;
  companyName: string | null;
  previousScore: number | null;
  nextScore: number;
  fields: string[];
  applied: boolean;
  skippedReason?: string;
  error?: string;
};

function boundedInt(raw: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(Math.floor(parsed), max));
}

function parseIds(raw: unknown) {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .slice(0, 200);
}

function parseIsoDate(raw: unknown) {
  const value = String(raw || "").trim();
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function tokenFromRequest(req: Request) {
  const explicitToken = req.headers.get("x-outreach-run-token")?.trim();
  if (explicitToken) return explicitToken;

  const auth = req.headers.get("authorization")?.trim() || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i);
  return bearer?.[1]?.trim() || "";
}

function isAuthorized(req: Request) {
  const token = process.env.OUTREACH_RUN_TOKEN?.trim();
  const suppliedToken = tokenFromRequest(req);

  return Boolean(token && suppliedToken && suppliedToken === token);
}

function logAuthFailure(req: Request) {
  console.warn("[outreach.rescore] unauthorized", {
    tokenConfigured: process.env.OUTREACH_RUN_TOKEN?.trim() ? "yes" : "no",
    authHeaderPresent: req.headers.get("authorization") ? "yes" : "no",
    outreachTokenHeaderPresent: req.headers.get("x-outreach-run-token")
      ? "yes"
      : "no",
  });
}

function existingScore(value: number | null | undefined) {
  return value === null || value === undefined ? null : Number(value);
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    logAuthFailure(req);

    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as RescoreBody;
  const apply = body.apply === true;
  const ids = parseIds(body.ids);
  const limit = ids.length > 0 ? ids.length : boundedInt(body.limit, 50, 1, 500);
  const createdAfter = parseIsoDate(body.created_after ?? body.createdAfter);

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 400 },
    );
  }

  let query = (admin as unknown as SupabaseUntypedClient)
    .from("leads")
    .select(LEAD_ENRICHMENT_SELECT);

  if (ids.length > 0) {
    query = query.in("id", ids);
  }

  if (createdAfter) {
    query = query.gte("created_at", createdAfter);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[outreach.rescore] lead query failed", {
      error: error.message,
    });

    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const rows = (data || []) as LeadEnrichmentRow[];
  const results: RescoreResult[] = [];
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const lead of rows) {
    const quality = scoreLeadQualityConservatively(
      lead,
      lead.pecr_classification,
      lead.pecr_reason,
    );
    const previousScore = existingScore(lead.lead_quality_score);
    const scoreChanged = previousScore !== quality.score;
    const reasonChanged = String(lead.lead_quality_reason || "") !== quality.reason;
    const fields = scoreChanged || reasonChanged
      ? ["lead_quality_score", "lead_quality_reason"]
      : [];

    if (fields.length === 0) {
      skippedCount += 1;
      results.push({
        id: lead.id,
        companyName: lead.company_name,
        previousScore,
        nextScore: quality.score,
        fields,
        applied: false,
        skippedReason: "score_unchanged",
      });
      continue;
    }

    if (!apply) {
      updatedCount += 1;
      results.push({
        id: lead.id,
        companyName: lead.company_name,
        previousScore,
        nextScore: quality.score,
        fields,
        applied: false,
      });
      continue;
    }

    const { error: updateError } = await (
      admin as unknown as SupabaseUntypedClient
    )
      .from("leads")
      .update({
        lead_quality_score: quality.score,
        lead_quality_reason: quality.reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    if (updateError) {
      failedCount += 1;
      console.warn("[outreach.rescore] lead update failed", {
        leadId: lead.id,
        previousScore,
        nextScore: quality.score,
        error: updateError.message,
      });

      results.push({
        id: lead.id,
        companyName: lead.company_name,
        previousScore,
        nextScore: quality.score,
        fields,
        applied: false,
        error: updateError.message,
      });
      continue;
    }

    updatedCount += 1;
    results.push({
      id: lead.id,
      companyName: lead.company_name,
      previousScore,
      nextScore: quality.score,
      fields,
      applied: true,
    });
  }

  const summary = {
    apply,
    dryRun: !apply,
    inspectedCount: rows.length,
    updatedCount,
    skippedCount,
    failedCount,
    limit,
    idsCount: ids.length,
    createdAfter,
  };

  console.log("[outreach.rescore] complete", summary);

  await logSystemEvent({
    level: failedCount > 0 ? "warn" : "info",
    category: "outreach",
    message: `Outreach lead rescore ${apply ? "applied" : "dry run"}: updated=${updatedCount} skipped=${skippedCount} failed=${failedCount}`,
    meta: summary,
  });

  return NextResponse.json(
    {
      ok: failedCount === 0,
      ...summary,
      results,
    },
    { status: failedCount > 0 ? 207 : 200 },
  );
}
