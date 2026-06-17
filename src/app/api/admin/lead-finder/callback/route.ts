import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_STDIO_CHARS = 12000;

const callbackSchema = z.object({
  lead_finder_run_id: z.string().trim().min(1),
  status: z.enum(["completed", "failed"]),
  summary: z.record(z.string(), z.unknown()).default({}),
  stdout: z.string().optional().default(""),
  stderr: z.string().optional().default(""),
  exit_code: z.number().int().nullable().optional(),
});

function tokenFromRequest(req: Request) {
  const auth = req.headers.get("authorization")?.trim() || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i);
  return bearer?.[1]?.trim() || "";
}

function isAuthorized(req: Request) {
  const expected = process.env.LEAD_FINDER_CALLBACK_TOKEN?.trim();
  const supplied = tokenFromRequest(req);
  return Boolean(expected && supplied && supplied === expected);
}

function tail(value: string) {
  if (value.length <= MAX_STDIO_CHARS) return value;
  return value.slice(value.length - MAX_STDIO_CHARS);
}

function errorFromPayload(status: "completed" | "failed", stderr: string) {
  if (status === "completed") return null;
  return stderr.trim().slice(0, 1000) || "Lead Finder workflow failed.";
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    console.warn("[lead-finder.callback] unauthorized", {
      tokenConfigured: process.env.LEAD_FINDER_CALLBACK_TOKEN?.trim()
        ? "yes"
        : "no",
      authHeaderPresent: req.headers.get("authorization") ? "yes" : "no",
    });

    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = callbackSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message || "invalid_payload" },
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

  const payload = parsed.data;
  const stdout = tail(payload.stdout);
  const stderr = tail(payload.stderr);
  const completedAt = new Date().toISOString();
  const summary = {
    ...payload.summary,
    callback_received_at: completedAt,
  };

  const { error } = await (admin as unknown as SupabaseUntypedClient)
    .from("lead_finder_runs")
    .update({
      status: payload.status,
      summary,
      stdout,
      stderr,
      exit_code: payload.exit_code ?? null,
      completed_at: completedAt,
      error: errorFromPayload(payload.status, stderr),
    })
    .eq("id", payload.lead_finder_run_id);

  if (error) {
    console.error("[lead-finder.callback] update failed", {
      runId: payload.lead_finder_run_id,
      error: error.message,
    });

    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    runId: payload.lead_finder_run_id,
    status: payload.status,
  });
}
