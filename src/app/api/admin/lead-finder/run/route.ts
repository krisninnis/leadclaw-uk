import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import {
  dispatchLeadFinderWorkflow,
  githubActionsWorkflowUrl,
  isGitHubDispatchConfigured,
  parseLeadFinderConfig,
  resolveLeadFinderExecutionMode,
  runLeadFinderScraper,
} from "@/lib/lead-finder";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

type RunRow = {
  id: string;
};

export async function POST(req: Request) {
  const authed = await requireAdmin();
  if (!authed.ok) return authed.response;

  let config;
  try {
    const body = await req.json().catch(() => ({}));
    config = parseLeadFinderConfig(body);
  } catch (error: unknown) {
    const message =
      error instanceof ZodError
        ? error.issues[0]?.message || "invalid_config"
        : error instanceof Error
          ? error.message
          : "invalid_config";

    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 400 },
    );
  }

  const executionMode = resolveLeadFinderExecutionMode();

  if (executionMode === "github_actions") {
    if (!isGitHubDispatchConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error: "GitHub Actions dispatch token is not configured.",
        },
        { status: 400 },
      );
    }

    const queuedAt = new Date().toISOString();
    const externalUrl = githubActionsWorkflowUrl();
    const queuedSummary = {
      dry_run: config.dry_run,
      execution_mode: executionMode,
      message: "GitHub Actions workflow dispatch requested.",
      external_url: externalUrl,
    };

    const { data: insertedRun, error: insertError } = await (
      admin as unknown as SupabaseUntypedClient
    )
      .from("lead_finder_runs")
      .insert({
        status: "queued",
        trigger_source: "manual",
        dry_run: config.dry_run,
        execution_mode: executionMode,
        external_url: externalUrl,
        queued_at: queuedAt,
        config_snapshot: config,
        summary: queuedSummary,
        started_at: queuedAt,
        created_by: authed.user.id,
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

    try {
      const dispatchResult = await dispatchLeadFinderWorkflow(config, run.id);
      const summary = {
        ...queuedSummary,
        message: dispatchResult.message,
        lead_finder_run_id: run.id,
      };

      const { error: updateError } = await (
        admin as unknown as SupabaseUntypedClient
      )
        .from("lead_finder_runs")
        .update({
          status: "queued",
          summary,
          external_url: dispatchResult.externalUrl,
          error: null,
        })
        .eq("id", run.id);

      if (updateError) {
        return NextResponse.json(
          {
            ok: false,
            error: updateError.message,
            runId: run.id,
            summary,
          },
          { status: 500 },
        );
      }

      return NextResponse.json({
        ok: true,
        runId: run.id,
        status: "queued",
        executionMode,
        externalUrl: dispatchResult.externalUrl,
        summary,
        message: "Run started in GitHub Actions.",
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "GitHub Actions dispatch failed.";
      const completedAt = new Date().toISOString();
      const summary = {
        ...queuedSummary,
        message,
        errors: [message],
      };

      await (admin as unknown as SupabaseUntypedClient)
        .from("lead_finder_runs")
        .update({
          status: "failed",
          summary,
          error: message,
          completed_at: completedAt,
        })
        .eq("id", run.id);

      return NextResponse.json(
        {
          ok: false,
          error: message,
          runId: run.id,
          status: "failed",
          executionMode,
          externalUrl,
          summary,
        },
        { status: 500 },
      );
    }
  }

  const startedAt = new Date().toISOString();
  const { data: insertedRun, error: insertError } = await (
    admin as unknown as SupabaseUntypedClient
  )
    .from("lead_finder_runs")
    .insert({
      status: "running",
      trigger_source: "manual",
      dry_run: config.dry_run,
      execution_mode: executionMode,
      config_snapshot: config,
      summary: {},
      started_at: startedAt,
      created_by: authed.user.id,
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

  const result = await runLeadFinderScraper(config);
  const completedAt = new Date().toISOString();
  const status = result.ok ? "completed" : "failed";
  const summary = {
    ...result.summary,
    dry_run: config.dry_run,
    execution_mode: executionMode,
    command: result.command,
    args: result.args,
  };

  const { error: updateError } = await (
    admin as unknown as SupabaseUntypedClient
  )
    .from("lead_finder_runs")
    .update({
      status,
      summary,
      stdout: result.stdout,
      stderr: result.stderr,
      exit_code: result.exitCode,
      error: result.ok ? null : result.summary.errors.join("; "),
      completed_at: completedAt,
    })
    .eq("id", run.id);

  if (updateError) {
    return NextResponse.json(
      {
        ok: false,
        error: updateError.message,
        runId: run.id,
        summary,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      ok: result.ok,
      runId: run.id,
      status,
      executionMode,
      summary,
      exitCode: result.exitCode,
    },
    { status: result.ok ? 200 : 500 },
  );
}
