import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getTwilioSmsReadiness } from "@/lib/communications/twilio-readiness";

export const runtime = "nodejs";

export async function GET() {
  const authed = await requireAdmin();
  if (!authed.ok) return authed.response;

  return NextResponse.json({
    ok: true,
    readiness: getTwilioSmsReadiness(),
  });
}
