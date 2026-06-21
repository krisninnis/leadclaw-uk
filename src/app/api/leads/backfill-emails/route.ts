import { NextResponse } from "next/server";
import {
  discoverEmailsForLeads,
  type EmailBackfillDiscoveryResult,
  type EmailBackfillInputLead,
} from "@/lib/leads/email-backfill";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

type BackfillEmailsBody = {
  apply?: unknown;
  limit?: unknown;
};

type LeadEmailBackfillRow = {
  id: string;
  company_name: string | null;
  website: string | null;
  contact_email: string | null;
  notes: string | null;
};

function boundedInt(raw: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(Math.floor(parsed), max));
}

function tokenFromRequest(req: Request) {
  const outreachToken = req.headers.get("x-outreach-run-token")?.trim();
  if (outreachToken) return outreachToken;

  const importToken = req.headers.get("x-lead-import-token")?.trim();
  if (importToken) return importToken;

  const auth = req.headers.get("authorization")?.trim() || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i);
  return bearer?.[1]?.trim() || "";
}

function isAuthorized(req: Request) {
  const suppliedToken = tokenFromRequest(req);
  const acceptedTokens = [
    process.env.OUTREACH_RUN_TOKEN?.trim(),
    process.env.LEAD_IMPORT_TOKEN?.trim(),
  ].filter(Boolean);

  return Boolean(
    suppliedToken &&
      acceptedTokens.some((expectedToken) => suppliedToken === expectedToken),
  );
}

function logAuthFailure(req: Request) {
  console.warn("[leads.backfill-emails] unauthorized", {
    outreachTokenConfigured: process.env.OUTREACH_RUN_TOKEN?.trim()
      ? "yes"
      : "no",
    importTokenConfigured: process.env.LEAD_IMPORT_TOKEN?.trim()
      ? "yes"
      : "no",
    authHeaderPresent: req.headers.get("authorization") ? "yes" : "no",
    outreachTokenHeaderPresent: req.headers.get("x-outreach-run-token")
      ? "yes"
      : "no",
    importTokenHeaderPresent: req.headers.get("x-lead-import-token")
      ? "yes"
      : "no",
  });
}

function normalizeEmail(raw: unknown) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^mailto:/, "");
}

function isValidEmail(email: string) {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email);
}

function resultById(results: EmailBackfillDiscoveryResult[]) {
  return new Map(results.map((result) => [result.id, result]));
}

function buildInputLeads(rows: LeadEmailBackfillRow[]): EmailBackfillInputLead[] {
  return rows.map((lead) => ({
    id: lead.id,
    company_name: lead.company_name,
    website: lead.website,
    notes: lead.notes,
  }));
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    logAuthFailure(req);

    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as BackfillEmailsBody;
  const apply = body.apply === true;
  const limit = boundedInt(body.limit, 50, 1, 50);

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 400 },
    );
  }

  const { data, error } = await (admin as unknown as SupabaseUntypedClient)
    .from("leads")
    .select("id,company_name,website,contact_email,notes")
    .not("website", "is", null)
    .neq("website", "")
    .or("contact_email.is.null,contact_email.eq.")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[leads.backfill-emails] lead query failed", {
      error: error.message,
    });

    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const rows = (data || []) as LeadEmailBackfillRow[];
  let discoveryResults: EmailBackfillDiscoveryResult[];

  try {
    discoveryResults = await discoverEmailsForLeads(buildInputLeads(rows));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "email_discovery_failed";
    console.error("[leads.backfill-emails] discovery failed", {
      error: message,
      inspectedCount: rows.length,
    });

    return NextResponse.json(
      {
        ok: false,
        error: message,
        inspectedCount: rows.length,
        updatedCount: 0,
        failedCount: rows.length,
      },
      { status: 500 },
    );
  }

  const results = resultById(discoveryResults);
  let updatedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const details: Array<{
    id: string;
    status: string;
    applied: boolean;
    emailFound: boolean;
    reason?: string | null;
    error?: string;
  }> = [];

  for (const lead of rows) {
    const discovery = results.get(lead.id);
    const email = normalizeEmail(discovery?.contact_email);

    if (!discovery) {
      failedCount += 1;
      details.push({
        id: lead.id,
        status: "failed",
        applied: false,
        emailFound: false,
        error: "missing_discovery_result",
      });
      continue;
    }

    if (discovery.error || discovery.status === "failed") {
      failedCount += 1;
      details.push({
        id: lead.id,
        status: discovery.status,
        applied: false,
        emailFound: false,
        reason: discovery.reason,
        error: discovery.error || discovery.reason || "discovery_failed",
      });
      continue;
    }

    if (!email || !isValidEmail(email)) {
      skippedCount += 1;
      details.push({
        id: lead.id,
        status: discovery.status,
        applied: false,
        emailFound: false,
        reason: discovery.reason || "no_email_found",
      });
      continue;
    }

    if (!apply) {
      updatedCount += 1;
      details.push({
        id: lead.id,
        status: discovery.status,
        applied: false,
        emailFound: true,
      });
      continue;
    }

    const { error: updateError } = await (
      admin as unknown as SupabaseUntypedClient
    )
      .from("leads")
      .update({
        contact_email: email,
        notes: discovery.notes || lead.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id)
      .or("contact_email.is.null,contact_email.eq.");

    if (updateError) {
      failedCount += 1;
      details.push({
        id: lead.id,
        status: discovery.status,
        applied: false,
        emailFound: true,
        error: updateError.message,
      });
      continue;
    }

    updatedCount += 1;
    details.push({
      id: lead.id,
      status: discovery.status,
      applied: true,
      emailFound: true,
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
  };

  console.log("[leads.backfill-emails] complete", summary);

  return NextResponse.json(
    {
      ok: failedCount === 0,
      ...summary,
      results: details,
    },
    { status: failedCount > 0 ? 207 : 200 },
  );
}
