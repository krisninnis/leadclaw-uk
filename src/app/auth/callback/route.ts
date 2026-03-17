import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemEvent } from "@/lib/ops";
import { provisionClinicWorkspace } from "@/lib/provision-clinic";

type PlanSlug = "starter" | "growth" | "pro";

function normalizeNext(value: string | null) {
  if (!value || !value.startsWith("/")) return "/portal";
  return value;
}

function normalizePlan(value: string | null): PlanSlug {
  if (value === "starter") return "starter";
  if (value === "pro") return "pro";
  return "growth";
}

async function startTrialForUser(
  userId: string,
  email: string,
  plan: PlanSlug,
) {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("supabase_not_configured");
  }

  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 7);

  const trialSubscriptionId = `trial_${userId}`;

  const row = {
    user_id: userId,
    email,
    stripe_customer_id: null,
    stripe_subscription_id: trialSubscriptionId,
    stripe_price_id: null,
    plan,
    status: "trialing",
    trial_end: trialEnd.toISOString(),
    current_period_end: null,
    cancel_at_period_end: true,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin
    .from("subscriptions")
    .upsert(row, { onConflict: "stripe_subscription_id" });

  if (error) {
    throw new Error(error.message);
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
        "Trial started in auth callback but onboarding auto-provision encountered an issue",
      meta: {
        email,
        plan,
        error: e instanceof Error ? e.message : "unknown",
      },
    });
  }

  await logSystemEvent({
    level: "info",
    category: "billing_trial",
    message: `No-card ${plan} trial started for ${email} in auth callback`,
    meta: {
      userId,
      email,
      plan,
      trialEnd: trialEnd.toISOString(),
      siteId: provisionResult?.siteId || null,
      clinicId: provisionResult?.clinicId || null,
    },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = normalizeNext(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth.callback] failed to exchange code for session", error);
    return NextResponse.redirect(`${origin}/login`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const nextUrl = new URL(next, origin);
  const shouldStartTrial = nextUrl.searchParams.get("startTrial") === "1";
  const selectedPlan = normalizePlan(nextUrl.searchParams.get("plan"));

  if (shouldStartTrial) {
    try {
      await startTrialForUser(
        user.id,
        user.email.trim().toLowerCase(),
        selectedPlan,
      );
    } catch (trialError) {
      console.error("[auth.callback] failed to start trial", trialError);
      return NextResponse.redirect(
        `${origin}/free-trial?plan=${selectedPlan}&email=${encodeURIComponent(
          user.email.trim().toLowerCase(),
        )}&error=trial_start_failed`,
      );
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
