import { NextResponse } from "next/server";
import { getStripe, PRICE_IDS } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_PLANS = ["basic", "growth", "pro"] as const;
const PAID_PLANS = ["growth", "pro"] as const;

export async function POST(req: Request) {
  try {
    // Extract data from the request body
    const { plan, email } = await req.json();

    // Ensure the plan is valid
    if (!ALLOWED_PLANS.includes(plan)) {
      return NextResponse.json(
        { ok: false, error: "invalid_plan" },
        { status: 400 },
      );
    }

    // Handle the case where the basic plan doesn't require checkout
    if (plan === "basic") {
      return NextResponse.json(
        { ok: false, error: "basic_plan_does_not_require_checkout" },
        { status: 400 },
      );
    }

    // Ensure the plan is one of the paid options (growth, pro)
    if (!PAID_PLANS.includes(plan)) {
      return NextResponse.json(
        { ok: false, error: "invalid_paid_plan" },
        { status: 400 },
      );
    }

    // Initialize Stripe
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { ok: false, error: "stripe_not_configured" },
        { status: 400 },
      );
    }

    // Retrieve the price ID from your predefined mapping
    const priceId = PRICE_IDS[plan as keyof typeof PRICE_IDS];
    if (!priceId) {
      return NextResponse.json(
        { ok: false, error: "missing_price_id" },
        { status: 400 },
      );
    }

    // Get the authenticated user from Supabase
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Normalize the email to lowercase for consistency
    const resolvedEmail =
      (user?.email || "").trim().toLowerCase() ||
      String(email || "")
        .trim()
        .toLowerCase();

    // Ensure email is provided
    if (!resolvedEmail) {
      return NextResponse.json(
        { ok: false, error: "missing_email" },
        { status: 400 },
      );
    }

    // Initialize Supabase admin client
    const admin = createAdminClient();
    let existingStatus: string | null = null;

    // Check if there is an existing subscription for the user by email
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

    // The application URL for redirection after the checkout process
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

    // Create the Stripe checkout session
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
          userId: user?.id || "", // Pass the user ID to Stripe's metadata
          existingStatus: existingStatus || "",
        },
      },
      metadata: {
        plan,
        userId: user?.id || "", // Pass the user ID to Stripe's metadata
        existingStatus: existingStatus || "",
      },
    });

    // Return the session URL to complete the checkout process
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "checkout_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
