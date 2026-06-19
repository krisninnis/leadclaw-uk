import { NextResponse } from "next/server";
import { z } from "zod";
import { runAudit, isUrlValidationError } from "@/lib/audit/run-audit";
import { saveAuditLead } from "@/lib/audit/leads-store";
import { buildPublicAuditReport } from "@/lib/audit/public-report";
import {
  checkRateLimit,
  getClientIp,
  publicAuditRateLimit,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  websiteUrl: z.string().trim().min(3).max(2048),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
});

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const allowed = await checkRateLimit(publicAuditRateLimit, clientIp);
  if (!allowed) {
    return json(
      {
        ok: false,
        error: "rate_limited",
        message: "Too many audit requests. Please try again in a few minutes.",
      },
      429,
    );
  }

  let input: z.infer<typeof requestSchema>;
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 12_000) throw new Error("request_too_large");
    input = requestSchema.parse(await request.json());
  } catch {
    return json(
      {
        ok: false,
        error: "invalid_request",
        message: "Enter a valid website URL, name, and email address.",
      },
      400,
    );
  }

  try {
    // This is the same engine used by authenticated audits. The public route
    // adds validation, rate limiting, lead persistence, and response gating.
    const result = await runAudit(input.websiteUrl);
    const lead = await saveAuditLead({
      name: input.name,
      email: input.email.toLowerCase(),
      result,
    });

    // Never release the report if lead capture failed. This preserves the
    // email gate and avoids silently losing valid submissions.
    if (!lead) {
      return json(
        {
          ok: false,
          error: "lead_capture_failed",
          message: "We could not save your report. Please try again.",
        },
        503,
      );
    }

    return json({ ok: true, report: buildPublicAuditReport(result) });
  } catch (error) {
    if (isUrlValidationError(error)) {
      return json(
        { ok: false, error: "invalid_url", message: error.message },
        400,
      );
    }

    console.error("[public-audit] run failed", error);
    return json(
      {
        ok: false,
        error: "audit_failed",
        message: "The audit could not be completed. Please try again.",
      },
      500,
    );
  }
}
