import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

type SubscriptionRow = {
  stripe_customer_id: string | null;
};

function isRealStripeCustomerId(value?: string | null) {
  return typeof value === "string" && value.startsWith("cus_");
}

export async function POST() {
  try {
    const authed = await requireUser();
    if (!authed.ok) return authed.response;

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { ok: false, error: "stripe_not_configured" },
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

    const normalizedEmail = authed.user.email?.trim().toLowerCase() ?? "";
    let customerId: string | null = null;

    const { data: byUser, error: byUserError } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", authed.user.id)
      .not("stripe_customer_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (byUserError) {
      return NextResponse.json(
        { ok: false, error: byUserError.message },
        { status: 500 },
      );
    }

    const userRow = (byUser || null) as SubscriptionRow | null;
    if (isRealStripeCustomerId(userRow?.stripe_customer_id)) {
      customerId = userRow!.stripe_customer_id!;
    }

    if (!customerId && normalizedEmail) {
      const { data: byEmail, error: byEmailError } = await admin
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("email", normalizedEmail)
        .not("stripe_customer_id", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (byEmailError) {
        return NextResponse.json(
          { ok: false, error: byEmailError.message },
          { status: 500 },
        );
      }

      const emailRow = (byEmail || null) as SubscriptionRow | null;
      if (isRealStripeCustomerId(emailRow?.stripe_customer_id)) {
        customerId = emailRow!.stripe_customer_id!;
      }
    }

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "no_billing_customer_found" },
        { status: 404 },
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/portal/billing`,
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "portal_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
