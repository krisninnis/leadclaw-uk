import { NextResponse } from "next/server";
import {
  buildLeadEnrichmentPatch,
  LEAD_ENRICHMENT_SELECT,
  type LeadEnrichmentRow,
} from "@/lib/lead-enrichment";
import { logSystemEvent } from "@/lib/ops";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

type BackfillBody = {
  apply?: unknown;
  limit?: unknown;
  ids?: unknown;
  created_after?: unknown;
  createdAfter?: unknown;
};

type BackfillResult = {
  id: string;
  companyName: string | null;
  fields: string[];
  skippedReasons: string[];
  applied: boolean;
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
  console.warn("[outreach.backfill] unauthorized", {
    tokenConfigured: process.env.OUTREACH_RUN_TOKEN?.trim() ? "yes" : "no",
    authHeaderPresent: req.headers.get("authorization") ? "yes" : "no",
    outreachTokenHeaderPresent: req.headers.get("x-outreach-run-token")
      ? "yes"
      : "no",
  });
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    logAuthFailure(req);

    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as BackfillBody;
  const apply = body.apply === true;
  const ids = parseIds(body.ids);
  const limit = ids.length > 0 ? ids.length : boundedInt(body.limit, 50, 1, 200);
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
    .select(LEAD_ENRICHMENT_SELECT)
    .or(
      "pecr_classification.is.null,lead_quality_score.is.null,outreach_subject.is.null,outreach_message.is.null",
    );

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
    console.error("[outreach.backfill] lead query failed", {
      error: error.message,
    });

    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const rows = (data || []) as LeadEnrichmentRow[];
  const results: BackfillResult[] = [];
  let updatedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const lead of rows) {
    const { patch, skippedReasons } = buildLeadEnrichmentPatch(lead);
    const fields = Object.keys(patch);
    const subjectGenerated = Boolean(patch.outreach_subject);
    const messageGenerated = Boolean(patch.outreach_message);

    if (subjectGenerated || messageGenerated) {
      console.log("[outreach.backfill] outreach copy generated", {
        leadId: lead.id,
        subjectGenerated: patch.outreach_subject || null,
        messageGenerated,
        messageLength: patch.outreach_message?.length || 0,
      });
    }

    if (fields.length === 0) {
      skippedCount += 1;
      results.push({
        id: lead.id,
        companyName: lead.company_name,
        fields,
        skippedReasons: [...skippedReasons, "no_missing_fields"],
        applied: false,
      });
      continue;
    }

    if (!apply) {
      updatedCount += 1;
      results.push({
        id: lead.id,
        companyName: lead.company_name,
        fields,
        skippedReasons,
        applied: false,
      });
      continue;
    }

    const { error: updateError } = await (
      admin as unknown as SupabaseUntypedClient
    )
      .from("leads")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    if (updateError) {
      failedCount += 1;
      console.warn("[outreach.backfill] lead update failed", {
        leadId: lead.id,
        subjectGenerated: patch.outreach_subject || null,
        messageGenerated,
        saveSucceeded: false,
        error: updateError.message,
      });

      results.push({
        id: lead.id,
        companyName: lead.company_name,
        fields,
        skippedReasons,
        applied: false,
        error: updateError.message,
      });
      continue;
    }

    updatedCount += 1;
    console.log("[outreach.backfill] lead update saved", {
      leadId: lead.id,
      fields,
      subjectGenerated: patch.outreach_subject || null,
      messageGenerated,
      saveSucceeded: true,
    });

    results.push({
      id: lead.id,
      companyName: lead.company_name,
      fields,
      skippedReasons,
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

  console.log("[outreach.backfill] complete", summary);

  await logSystemEvent({
    level: failedCount > 0 ? "warn" : "info",
    category: "outreach",
    message: `Outreach enrichment backfill ${apply ? "applied" : "dry run"}: updated=${updatedCount} skipped=${skippedCount} failed=${failedCount}`,
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
