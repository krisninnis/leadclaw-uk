import { NextResponse } from "next/server";
import { getStripe, PRICE_IDS } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_PLANS = ["basic", "growth", "pro"] as const;
const PAID_PLANS = ["growth", "pro"] as const;

export async function POST(req: Request) {
  try {
    const { plan, email } = await req.json();

    if (!ALLOWED_PLANS.includes(plan)) {
      return NextResponse.json(
        { ok: false, error: "invalid_plan" },
        { status: 400 },
      );
    }

    if (plan === "basic") {
      return NextResponse.json(
        { ok: false, error: "basic_plan_does_not_require_checkout" },
        { status: 400 },
      );
    }

    if (!PAID_PLANS.includes(plan)) {
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

    const priceId = PRICE_IDS[plan as keyof typeof PRICE_IDS];
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
      (user?.email || "").trim().toLowerCase() ||
      String(email || "")
        .trim()
        .toLowerCase();

    if (!resolvedEmail) {
      return NextResponse.json(
        { ok: false, error: "missing_email" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    let existingStatus: string | null = null;

    if (admin) {
      const { data: subscriptionRow } = await admin
        .from("subscriptions")
        .select("status")
        .eq("email", resolvedEmail)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      existingStatus = subscriptionRow?.status || null;
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: resolvedEmail,
      success_url: `${appUrl}/portal?checkout=success&setup=ready&plan=${plan}`,
      cancel_url: `${appUrl}/portal/billing?checkout=cancelled`,
      payment_method_collection: "always",
      subscription_data: {
        metadata: {
          plan,
          userId: user?.id || "",
          existingStatus: existingStatus || "",
        },
      },
      metadata: {
        plan,
        userId: user?.id || "",
        existingStatus: existingStatus || "",
      },
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "checkout_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
