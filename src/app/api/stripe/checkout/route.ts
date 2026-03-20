import { NextResponse } from "next/server";
import { getStripe, PRICE_IDS } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_PLANS = ["basic", "growth", "pro"] as const;
const PAID_PLANS = ["growth", "pro"] as const;

type AllowedPlan = (typeof ALLOWED_PLANS)[number];
type PaidPlan = (typeof PAID_PLANS)[number];

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

function isAllowedPlan(value: unknown): value is AllowedPlan {
  return (
    typeof value === "string" &&
    (ALLOWED_PLANS as readonly string[]).includes(value)
  );
}

function isPaidPlan(value: unknown): value is PaidPlan {
  return (
    typeof value === "string" &&
    (PAID_PLANS as readonly string[]).includes(value)
  );
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

    if (!isAllowedPlan(requestedPlan)) {
      return NextResponse.json(
        { ok: false, error: "invalid_plan" },
        { status: 400 },
      );
    }

    if (requestedPlan === "basic") {
      return NextResponse.json(
        { ok: false, error: "basic_plan_does_not_require_checkout" },
        { status: 400 },
      );
    }

    if (!isPaidPlan(requestedPlan)) {
      return NextResponse.json(
        { ok: false, error: "invalid_paid_plan" },
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

    const priceId = PRICE_IDS[requestedPlan as keyof typeof PRICE_IDS];
    if (!priceId) {
      return NextResponse.json(
        { ok: false, error: "missing_price_id" },
        { status: 400 },
      );
    }

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

    if (existingStatus === "active" && existingPlan === requestedPlan) {
      return NextResponse.json(
        { ok: false, error: "already_on_requested_plan" },
        { status: 409 },
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: resolvedEmail,
      success_url: `${appUrl}/portal?checkout=success&setup=ready&plan=${requestedPlan}`,
      cancel_url: `${appUrl}/portal/billing?checkout=cancelled`,
      payment_method_collection: "always",
      metadata: {
        plan: requestedPlan,
        userId: user?.id || "",
        email: resolvedEmail,
        existingStatus,
        existingPlan,
        subscriptionId: existing?.id || "",
      },
      subscription_data: {
        metadata: {
          plan: requestedPlan,
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
