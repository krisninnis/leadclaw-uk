import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET() {
  const authed = await requireAdmin();
  if (!authed.ok) return authed.response;

  return NextResponse.json({
    ok: true,
    message: "Outreach queue API placeholder",
    leads: [],
  });
}
