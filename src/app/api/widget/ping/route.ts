import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseLeadClawProduct } from "@/lib/subscription-access";

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
      .select("id,token,status,onboarding_site_id")
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

    const { data: site, error: siteError } = await admin
      .from("onboarding_sites")
      .select("onboarding_client_id")
      .eq("id", tokenRow.onboarding_site_id)
      .limit(1)
      .maybeSingle();

    if (siteError) {
      console.error("[widget.ping] site lookup failed", siteError);

      return NextResponse.json(
        { ok: false, error: "site_lookup_failed" },
        { status: 500, headers: corsHeaders },
      );
    }

    let clinicContactEmail: string | null = null;
    let subscriptionStatus: string | null = null;

    if (site?.onboarding_client_id) {
      const { data: client, error: clientError } = await admin
        .from("onboarding_clients")
        .select("contact_email")
        .eq("id", site.onboarding_client_id)
        .limit(1)
        .maybeSingle();

      if (clientError) {
        console.error("[widget.ping] client lookup failed", clientError);

        return NextResponse.json(
          { ok: false, error: "client_lookup_failed" },
          { status: 500, headers: corsHeaders },
        );
      }

      clinicContactEmail = client?.contact_email?.trim().toLowerCase() || null;

      if (clinicContactEmail) {
        const { data: subscription, error: subscriptionError } = await admin
          .from("subscriptions")
          .select("status,updated_at")
          .eq("email", clinicContactEmail)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subscriptionError) {
          console.error(
            "[widget.ping] subscription lookup failed",
            subscriptionError,
          );

          return NextResponse.json(
            { ok: false, error: "subscription_lookup_failed" },
            { status: 500, headers: corsHeaders },
          );
        }

        subscriptionStatus = subscription?.status || null;
      }
    }

    if (!canUseLeadClawProduct(subscriptionStatus)) {
      console.warn("[widget.ping] blocked due to inactive subscription", {
        clinicContactEmail,
        subscriptionStatus,
      });

      return NextResponse.json(
        { ok: false, error: "subscription_inactive" },
        { status: 403, headers: corsHeaders },
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
