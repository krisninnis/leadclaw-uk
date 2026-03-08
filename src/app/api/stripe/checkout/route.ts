import { NextResponse } from "next/server";
import { getStripe, PRICE_IDS } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_PLANS = ["starter", "growth", "pro"] as const;

export async function POST(req: Request) {
  try {
    const { plan, email } = await req.json();
    const stripe = getStripe();

    if (!stripe) {
      return NextResponse.json(
        { ok: false, error: "stripe_not_configured" },
        { status: 400 },
      );
    }

    if (!ALLOWED_PLANS.includes(plan)) {
      return NextResponse.json(
        { ok: false, error: "invalid_plan" },
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

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

    const trialDays = 7;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: resolvedEmail,
      success_url: `${appUrl}/portal?checkout=success&setup=ready`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
      payment_method_collection: "if_required",
      subscription_data: {
        trial_period_days: trialDays,
        trial_settings: {
          end_behavior: { missing_payment_method: "cancel" },
        },
        metadata: {
          plan,
          userId: user?.id || "",
          trialAutoCancel: "true",
        },
      },
      metadata: {
        plan,
        userId: user?.id || "",
        trialAutoCancel: "true",
      },
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "checkout_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
