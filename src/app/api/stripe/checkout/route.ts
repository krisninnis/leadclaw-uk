import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { resolveCheckoutPlan } from "@/lib/checkout-plans";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppBaseUrl } from "@/lib/app-url";

type SubscriptionRow = {
  id?: string;
  user_id: string | null;
  email: string | null;
  plan: string | null;
  status: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  updated_at?: string | null;
};

function normalizeEmail(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeStatus(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const requestedPlan = String(body?.plan || "")
      .trim()
      .toLowerCase();

    const checkoutPlan = resolveCheckoutPlan(requestedPlan);

    if (!checkoutPlan.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: checkoutPlan.error,
          requiredEnvVar: checkoutPlan.requiredEnvVar,
        },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { ok: false, error: "stripe_not_configured" },
        { status: 400 },
      );
    }

    const requestedPaidPlan = checkoutPlan.plan;
    const priceId = checkoutPlan.priceId;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const resolvedEmail =
      normalizeEmail(user?.email) || normalizeEmail(body?.email);

    if (!resolvedEmail) {
      return NextResponse.json(
        { ok: false, error: "missing_email" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    let existing: SubscriptionRow | null = null;

    if (admin) {
      const filters: string[] = [];
      if (user?.id) filters.push(`user_id.eq.${user.id}`);
      filters.push(`email.eq.${resolvedEmail}`);

      const { data: rows, error } = await admin
        .from("subscriptions")
        .select(
          "id,user_id,email,plan,status,stripe_customer_id,stripe_subscription_id,updated_at",
        )
        .or(filters.join(","))
        .order("updated_at", { ascending: false })
        .limit(10);

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 },
        );
      }

      const typedRows = (rows || []) as SubscriptionRow[];
      existing =
        typedRows.find((row) => row.user_id && row.user_id === user?.id) ||
        typedRows.find((row) => normalizeEmail(row.email) === resolvedEmail) ||
        null;
    }

    const existingStatus = normalizeStatus(existing?.status);
    const existingPlan = String(existing?.plan || "")
      .trim()
      .toLowerCase();

    if (existingStatus === "active" && existingPlan === requestedPaidPlan) {
      return NextResponse.json(
        { ok: false, error: "already_on_requested_plan" },
        { status: 409 },
      );
    }

    const appUrl = getAppBaseUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: resolvedEmail,
      success_url: `${appUrl}/portal?checkout=success&setup=ready&plan=${requestedPaidPlan}`,
      cancel_url: `${appUrl}/portal/billing?checkout=cancelled`,
      payment_method_collection: "always",
      metadata: {
        plan: requestedPaidPlan,
        userId: user?.id || "",
        email: resolvedEmail,
        existingStatus,
        existingPlan,
        subscriptionId: existing?.id || "",
      },
      subscription_data: {
        metadata: {
          plan: requestedPaidPlan,
          userId: user?.id || "",
          email: resolvedEmail,
          existingStatus,
          existingPlan,
          subscriptionId: existing?.id || "",
        },
      },
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "checkout_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
