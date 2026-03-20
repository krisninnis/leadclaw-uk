import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionClinicWorkspace } from "@/lib/provision-clinic";
import { logSystemEvent } from "@/lib/ops";

type SubscriptionRow = {
  id?: string;
  user_id: string | null;
  email: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  plan: string | null;
  status: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  updated_at: string | null;
};

function normalizeEmail(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isPaidLikeStatus(status: string | null | undefined) {
  const normalized = String(status || "").toLowerCase();
  return ["active", "trialing", "past_due"].includes(normalized);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const normalizedEmail = normalizeEmail(body?.email);

    if (!normalizedEmail) {
      return NextResponse.json(
        { ok: false, error: "missing_email" },
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

    const { data: existingRows, error: existingError } = await admin
      .from("subscriptions")
      .select(
        "id,user_id,email,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan,status,trial_end,current_period_end,cancel_at_period_end,updated_at",
      )
      .eq("email", normalizedEmail)
      .order("updated_at", { ascending: false })
      .limit(10);

    if (existingError) {
      return NextResponse.json(
        { ok: false, error: existingError.message },
        { status: 500 },
      );
    }

    const existingList = (existingRows || []) as SubscriptionRow[];
    const existing = existingList[0] || null;

    if (existing && isPaidLikeStatus(existing.status)) {
      return NextResponse.json(
        { ok: false, error: "paid_or_trial_subscription_exists" },
        { status: 409 },
      );
    }

    const nowIso = new Date().toISOString();

    const row = {
      user_id: existing?.user_id || null,
      email: normalizedEmail,
      stripe_customer_id: existing?.stripe_customer_id || null,
      stripe_subscription_id: existing?.stripe_subscription_id || null,
      stripe_price_id: null,
      plan: "basic",
      status: "basic",
      trial_end: existing?.trial_end || null,
      current_period_end: null,
      cancel_at_period_end: false,
      updated_at: nowIso,
    };

    let writeError: string | null = null;

    if (existing?.id) {
      const { error: updateError } = await admin
        .from("subscriptions")
        .update(row)
        .eq("id", existing.id);

      if (updateError) {
        writeError = updateError.message;
      }
    } else {
      const { error: insertError } = await admin
        .from("subscriptions")
        .insert(row);

      if (insertError) {
        writeError = insertError.message;
      }
    }

    if (writeError) {
      return NextResponse.json(
        { ok: false, error: writeError },
        { status: 500 },
      );
    }

    const redirectBase =
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

    const inviteResult = await admin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        redirectTo: `${redirectBase}/portal/billing`,
      },
    );

    if (inviteResult.error) {
      const message = inviteResult.error.message.toLowerCase();

      const ignorable =
        message.includes("already been registered") ||
        message.includes("already registered") ||
        message.includes("already exists") ||
        message.includes("email rate limit exceeded") ||
        message.includes("user already exists");

      if (!ignorable) {
        return NextResponse.json(
          { ok: false, error: inviteResult.error.message },
          { status: 500 },
        );
      }
    }

    let provisionResult: Awaited<
      ReturnType<typeof provisionClinicWorkspace>
    > | null = null;

    try {
      provisionResult = await provisionClinicWorkspace({
        email: normalizedEmail,
      });
    } catch (e) {
      await logSystemEvent({
        level: "warn",
        category: "onboarding",
        message: "Basic signup provision failed",
        meta: {
          email: normalizedEmail,
          error: e instanceof Error ? e.message : "unknown",
        },
      });
    }

    await logSystemEvent({
      level: "info",
      category: "billing_basic",
      message: `Basic plan set for ${normalizedEmail}`,
      meta: {
        email: normalizedEmail,
        siteId: provisionResult?.siteId || null,
        clinicId: provisionResult?.clinicId || null,
      },
    });

    return NextResponse.json({
      ok: true,
      plan: "basic",
      status: "basic",
      siteId: provisionResult?.siteId || null,
      clinicId: provisionResult?.clinicId || null,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "basic_signup_failed" },
      { status: 500 },
    );
  }
}
