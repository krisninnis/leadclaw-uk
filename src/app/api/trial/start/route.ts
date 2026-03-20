import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemEvent } from "@/lib/ops";
import { provisionClinicWorkspace } from "@/lib/provision-clinic";

const DEFAULT_TRIAL_PLAN = "growth" as const;

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

function isFutureDate(value?: string | null) {
  if (!value) return false;
  const dt = new Date(value);
  return !Number.isNaN(dt.getTime()) && dt.getTime() > Date.now();
}

function isPaidLikeStatus(status: string | null | undefined) {
  const normalized = String(status || "").toLowerCase();
  return ["active", "past_due"].includes(normalized);
}

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 400 },
    );
  }

  const email = normalizeEmail(user.email);
  if (!email) {
    return NextResponse.json(
      { ok: false, error: "missing_email" },
      { status: 400 },
    );
  }

  const { data: existingRows, error: existingError } = await admin
    .from("subscriptions")
    .select(
      "id,user_id,email,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan,status,trial_end,current_period_end,cancel_at_period_end,updated_at",
    )
    .or(`user_id.eq.${user.id},email.eq.${email}`)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (existingError) {
    return NextResponse.json(
      { ok: false, error: existingError.message },
      { status: 500 },
    );
  }

  const existingList = (existingRows || []) as SubscriptionRow[];
  const existing =
    existingList.find((row) => row.user_id === user.id) ||
    existingList.find((row) => normalizeEmail(row.email) === email) ||
    null;

  if (existing) {
    const existingStatus = String(existing.status || "").toLowerCase();

    if (existingStatus === "trialing" && isFutureDate(existing.trial_end)) {
      return NextResponse.json(
        {
          ok: false,
          error: "trial_already_active",
          trialEnd: existing.trial_end,
        },
        { status: 409 },
      );
    }

    if (isPaidLikeStatus(existing.status)) {
      return NextResponse.json(
        { ok: false, error: "already_subscribed" },
        { status: 409 },
      );
    }

    // One free trial only:
    // if this user/email has ever had a trial_end recorded, do not allow another trial.
    if (existing.trial_end) {
      return NextResponse.json(
        { ok: false, error: "trial_already_used" },
        { status: 409 },
      );
    }
  }

  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 7);

  const selectedPlan = DEFAULT_TRIAL_PLAN;
  const trialSubscriptionId = `trial_${user.id}`;
  const nowIso = now.toISOString();

  const row = {
    user_id: user.id,
    email,
    stripe_customer_id: existing?.stripe_customer_id || null,
    stripe_subscription_id: trialSubscriptionId,
    stripe_price_id: null,
    plan: selectedPlan,
    status: "trialing",
    trial_end: trialEnd.toISOString(),
    current_period_end: null,
    cancel_at_period_end: true,
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
    return NextResponse.json({ ok: false, error: writeError }, { status: 500 });
  }

  let provisionResult: Awaited<
    ReturnType<typeof provisionClinicWorkspace>
  > | null = null;

  try {
    provisionResult = await provisionClinicWorkspace({ email });
  } catch (e) {
    await logSystemEvent({
      level: "warn",
      category: "onboarding",
      message:
        "Trial started but onboarding auto-provision encountered an issue",
      meta: {
        email,
        plan: selectedPlan,
        error: e instanceof Error ? e.message : "unknown",
      },
    });
  }

  await logSystemEvent({
    level: "info",
    category: "billing_trial",
    message: `No-card ${selectedPlan} trial started for ${email}`,
    meta: {
      userId: user.id,
      email,
      plan: selectedPlan,
      trialEnd: trialEnd.toISOString(),
      siteId: provisionResult?.siteId || null,
      clinicId: provisionResult?.clinicId || null,
    },
  });

  return NextResponse.json({
    ok: true,
    plan: selectedPlan,
    trialEnd: trialEnd.toISOString(),
    siteId: provisionResult?.siteId || null,
    clinicId: provisionResult?.clinicId || null,
  });
}
