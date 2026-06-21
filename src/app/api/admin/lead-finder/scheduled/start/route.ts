import { NextResponse } from "next/server";
import {
  githubActionsWorkflowUrl,
  type LeadFinderConfigInput,
} from "@/lib/lead-finder";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

type LeadFinderConfigRow = {
  id: string;
  name: string | null;
  niche_mode: LeadFinderConfigInput["niche_mode"];
  niches: string[] | null;
  locations: string[] | null;
  lead_limit: number | null;
  discover_emails: boolean | null;
  email_discovery_max_pages: number | null;
  dry_run: boolean | null;
  schedule_enabled: boolean | null;
  run_time_local: string | null;
  timezone: string | null;
};

type RunRow = {
  id: string;
};

function tokenFromRequest(req: Request) {
  const auth = req.headers.get("authorization")?.trim() || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i);
  return bearer?.[1]?.trim() || "";
}

function isAuthorized(req: Request) {
  const expected = process.env.LEAD_FINDER_SCHEDULER_TOKEN?.trim();
  const supplied = tokenFromRequest(req);
  return Boolean(expected && supplied && supplied === expected);
}

function normalizeTime(value: string | null | undefined) {
  if (!value) return "09:00";
  return value.slice(0, 5);
}

function configFromRow(row: LeadFinderConfigRow): LeadFinderConfigInput {
  return {
    name: row.name || "Default Lead Finder",
    niche_mode: row.niche_mode || "clinic",
    niches: row.niches || [],
    locations: row.locations || ["Coventry", "Birmingham", "Leicester", "Nottingham"],
    limit: row.lead_limit || 25,
    discover_emails: row.discover_emails ?? true,
    email_discovery_max_pages: row.email_discovery_max_pages || 7,
    dry_run: row.dry_run ?? false,
    schedule_enabled: row.schedule_enabled ?? false,
    run_time_local: normalizeTime(row.run_time_local),
    timezone: row.timezone || "Europe/London",
  };
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    console.warn("[lead-finder.scheduled.start] unauthorized", {
      tokenConfigured: process.env.LEAD_FINDER_SCHEDULER_TOKEN?.trim()
        ? "yes"
        : "no",
      authHeaderPresent: req.headers.get("authorization") ? "yes" : "no",
    });

    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 400 },
    );
  }

  const { data: configRows, error: configError } = await (
    admin as unknown as SupabaseUntypedClient
  )
    .from("lead_finder_configs")
    .select("*")
    .eq("schedule_enabled", true)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (configError) {
    return NextResponse.json(
      { ok: false, error: configError.message },
      { status: 500 },
    );
  }

  const configRow = ((configRows || []) as LeadFinderConfigRow[])[0];
  if (!configRow) {
    return NextResponse.json({
      ok: false,
      skipped: true,
      error: "no_enabled_lead_finder_schedule",
    });
  }

  const config = configFromRow(configRow);
  const queuedAt = new Date().toISOString();
  const externalUrl = githubActionsWorkflowUrl();
  const summary = {
    dry_run: config.dry_run,
    execution_mode: "github_actions",
    message: "Scheduled GitHub Actions workflow started.",
    external_url: externalUrl,
    run_time_local: config.run_time_local,
    timezone: config.timezone,
  };

  const { data: insertedRun, error: insertError } = await (
    admin as unknown as SupabaseUntypedClient
  )
    .from("lead_finder_runs")
    .insert({
      config_id: configRow.id,
      status: "running",
      trigger_source: "scheduled",
      dry_run: config.dry_run,
      execution_mode: "github_actions",
      external_url: externalUrl,
      queued_at: queuedAt,
      started_at: queuedAt,
      config_snapshot: config,
      summary,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json(
      { ok: false, error: insertError.message },
      { status: 500 },
    );
  }

  const run = insertedRun as RunRow | null;
  if (!run?.id) {
    return NextResponse.json(
      { ok: false, error: "run_insert_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    run_id: run.id,
    config,
  });
}
