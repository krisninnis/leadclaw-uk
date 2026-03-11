import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  token: z.string().min(10),
  domain: z.string().min(1).max(255),
});

function buildCorsHeaders(origin?: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");

  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(origin),
  });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);

  const admin = createAdminClient();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 400, headers: corsHeaders },
    );
  }

  try {
    const body = await req.json();
    const parsed = schema.parse(body);

    const safeDomain = parsed.domain.trim().toLowerCase();

    const { data: tokenRow, error: tokenError } = await admin
      .from("widget_tokens")
      .select("id,token,status")
      .eq("token", parsed.token)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (tokenError) {
      console.error("[widget.ping] token lookup failed", tokenError);

      return NextResponse.json(
        { ok: false, error: "token_lookup_failed" },
        { status: 500, headers: corsHeaders },
      );
    }

    if (!tokenRow) {
      return NextResponse.json(
        { ok: false, error: "invalid_widget_token" },
        { status: 401, headers: corsHeaders },
      );
    }

    const { error: updateError } = await admin
      .from("widget_tokens")
      .update({
        last_seen_at: new Date().toISOString(),
        last_seen_domain: safeDomain,
      })
      .eq("id", tokenRow.id);

    if (updateError) {
      console.error("[widget.ping] failed to update token", updateError);

      return NextResponse.json(
        { ok: false, error: "failed_to_store_ping" },
        { status: 500, headers: corsHeaders },
      );
    }

    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[widget.ping] unexpected error", err);

    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400, headers: corsHeaders },
    );
  }
}
