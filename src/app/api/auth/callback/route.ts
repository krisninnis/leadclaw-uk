export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemEvent } from "@/lib/ops";
import { provisionClinicWorkspace } from "@/lib/provision-clinic";

type PlanSlug = "basic" | "growth" | "pro";

function normalizeNext(value: string | null) {
  if (!value || !value.startsWith("/")) return "/portal";
  return value;
}

function normalizePlan(value: string | null): PlanSlug {
  if (value === "basic") return "basic";
  if (value === "pro") return "pro";
  return "growth";
}

function buildFallbackContactName(
  email: string,
  userMetadata: Record<string, unknown> | undefined,
) {
  const name =
    String(userMetadata?.name || "").trim() ||
    String(userMetadata?.full_name || "").trim();

  if (name) return name;

  const emailName = email
    .split("@")[0]
    ?.replace(/[._-]+/g, " ")
    .trim();
  if (emailName) return emailName;

  return "New LeadClaw User";
}

async function saveApplicationRecord(
  email: string,
  plan: PlanSlug,
  contactName: string,
) {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("supabase_not_configured");
  }

  const { data: existingRow, error: findError } = await admin
    .from("applications")
    .select("id")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }

  if (existingRow?.id) {
    const { error: updateError } = await admin
      .from("applications")
      .update({
        plan,
        contact_name: contactName,
        city: "Not Provided",
      })
      .eq("id", existingRow.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return;
  }

  const { error: insertError } = await admin.from("applications").insert({
    email,
    contact_name: contactName,
    clinic_name: null,
    website: null,
    phone: null,
    city: "Not Provided",
    plan,
    created_at: new Date().toISOString(),
  });

  if (insertError) {
    throw new Error(insertError.message);
  }
}

async function startTrialForUser(
  userId: string,
  email: string,
  plan: PlanSlug,
  contactName: string,
) {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("supabase_not_configured");
  }

  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 7);

  const trialSubscriptionId = `trial_${userId}`;

  const subscriptionRow = {
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

  const { error: subError } = await admin
    .from("subscriptions")
    .upsert(subscriptionRow, { onConflict: "stripe_subscription_id" });

  if (subError) {
    throw new Error(subError.message);
  }

  await saveApplicationRecord(email, plan, contactName);

  let provisionResult: Awaited<
    ReturnType<typeof provisionClinicWorkspace>
  > | null = null;

  try {
    provisionResult = await provisionClinicWorkspace({
      email,
      plan,
      subscriptionStatus: "trialing",
    });
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

async function startBasicForUser(
  userId: string,
  email: string,
  contactName: string,
) {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("supabase_not_configured");
  }

  const subscriptionId = `basic_${userId}`;

  const { error: subError } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      email,
      stripe_customer_id: null,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: null,
      plan: "basic",
      status: "active",
      trial_end: null,
      current_period_end: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );

  if (subError) {
    throw new Error(subError.message);
  }

  await saveApplicationRecord(email, "basic", contactName);

  let provisionResult: Awaited<
    ReturnType<typeof provisionClinicWorkspace>
  > | null = null;

  try {
    provisionResult = await provisionClinicWorkspace({
      email,
      plan: "basic",
      subscriptionStatus: "active",
    });
  } catch (e) {
    await logSystemEvent({
      level: "warn",
      category: "onboarding",
      message:
        "Basic signup in auth callback but onboarding auto-provision encountered an issue",
      meta: {
        email,
        plan: "basic",
        error: e instanceof Error ? e.message : "unknown",
      },
    });
  }

  await logSystemEvent({
    level: "info",
    category: "billing_basic",
    message: `Free basic plan started for ${email} in auth callback`,
    meta: {
      userId,
      email,
      plan: "basic",
      siteId: provisionResult?.siteId || null,
      clinicId: provisionResult?.clinicId || null,
    },
  });
}

export async function GET(request: NextRequest) {
  console.log("🔥 API AUTH CALLBACK HIT");

  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get("code");
  const next = normalizeNext(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const redirectUrl = new URL(next, origin);
  const response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[api.auth.callback] failed to exchange code", error);
    return NextResponse.redirect(new URL("/login", origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const nextUrl = new URL(next, origin);
  const shouldStartTrial = nextUrl.searchParams.get("startTrial") === "1";
  const shouldStartBasic = nextUrl.searchParams.get("startBasic") === "1";
  const selectedPlan = normalizePlan(nextUrl.searchParams.get("plan"));
  const normalizedEmail = user.email.trim().toLowerCase();
  const contactName = buildFallbackContactName(
    normalizedEmail,
    (user.user_metadata ?? {}) as Record<string, unknown>,
  );

  if (shouldStartTrial) {
    try {
      await startTrialForUser(
        user.id,
        normalizedEmail,
        selectedPlan,
        contactName,
      );
    } catch (trialError) {
      console.error("[api.auth.callback] failed to start trial", trialError);
      return NextResponse.redirect(
        new URL(
          `/free-trial?plan=${selectedPlan}&email=${encodeURIComponent(
            normalizedEmail,
          )}&error=trial_start_failed`,
          origin,
        ),
      );
    }
  }

  if (shouldStartBasic) {
    try {
      await startBasicForUser(user.id, normalizedEmail, contactName);
    } catch (basicError) {
      console.error("[api.auth.callback] failed to start basic", basicError);
      return NextResponse.redirect(
        new URL(
          `/signup?plan=basic&email=${encodeURIComponent(
            normalizedEmail,
          )}&error=basic_signup_failed`,
          origin,
        ),
      );
    }
  }

  return response;
}
