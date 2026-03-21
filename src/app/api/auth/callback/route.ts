export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemEvent } from "@/lib/ops";
import { provisionClinicWorkspace } from "@/lib/provision-clinic";

type PlanSlug = "basic" | "growth" | "pro";

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

function normalizeNext(value: string | null) {
  if (!value || !value.startsWith("/")) return "/portal";
  return value;
}

function normalizePlan(value: string | null): PlanSlug {
  if (value === "basic") return "basic";
  if (value === "pro") return "pro";
  return "growth";
}

function normalizeEmail(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
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

function isFutureDate(value?: string | null) {
  if (!value) return false;
  const dt = new Date(value);
  return !Number.isNaN(dt.getTime()) && dt.getTime() > Date.now();
}

function isPaidLikeStatus(status: string | null | undefined) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();
  return ["active", "past_due"].includes(normalized);
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

  const { data: existingRows, error: existingError } = await admin
    .from("subscriptions")
    .select(
      "id,user_id,email,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan,status,trial_end,current_period_end,cancel_at_period_end,updated_at",
    )
    .or(`user_id.eq.${userId},email.eq.${email}`)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingList = (existingRows || []) as SubscriptionRow[];
  const existing =
    existingList.find((row) => row.user_id === userId) ||
    existingList.find((row) => normalizeEmail(row.email) === email) ||
    null;

  const existingStatus = String(existing?.status || "")
    .trim()
    .toLowerCase();

  if (existingStatus === "trialing" && isFutureDate(existing?.trial_end)) {
    throw new Error("trial_already_active");
  }

  if (isPaidLikeStatus(existing?.status)) {
    throw new Error("already_subscribed");
  }

  if (existing?.trial_end) {
    throw new Error("trial_already_used");
  }

  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 7);

  const trialSubscriptionId = `trial_${userId}`;

  const subscriptionRow = {
    user_id: userId,
    email,
    stripe_customer_id: existing?.stripe_customer_id || null,
    stripe_subscription_id: trialSubscriptionId,
    stripe_price_id: null,
    plan,
    status: "trialing",
    trial_end: trialEnd.toISOString(),
    current_period_end: null,
    cancel_at_period_end: true,
    updated_at: new Date().toISOString(),
  };

  let subError: string | null = null;

  if (existing?.id) {
    const { error } = await admin
      .from("subscriptions")
      .update(subscriptionRow)
      .eq("id", existing.id);

    if (error) subError = error.message;
  } else {
    const { error } = await admin.from("subscriptions").insert(subscriptionRow);

    if (error) subError = error.message;
  }

  if (subError) {
    throw new Error(subError);
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

  const { data: existingRows, error: existingError } = await admin
    .from("subscriptions")
    .select(
      "id,user_id,email,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan,status,trial_end,current_period_end,cancel_at_period_end,updated_at",
    )
    .or(`user_id.eq.${userId},email.eq.${email}`)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingList = (existingRows || []) as SubscriptionRow[];
  const existing =
    existingList.find((row) => row.user_id === userId) ||
    existingList.find((row) => normalizeEmail(row.email) === email) ||
    null;

  const existingStatus = String(existing?.status || "")
    .trim()
    .toLowerCase();

  if (isPaidLikeStatus(existingStatus)) {
    throw new Error("already_subscribed");
  }

  const subscriptionRow = {
    user_id: userId,
    email,
    stripe_customer_id: existing?.stripe_customer_id || null,
    stripe_subscription_id:
      existing?.stripe_subscription_id || `basic_${userId}`,
    stripe_price_id: null,
    plan: "basic" as const,
    status: "basic" as const,
    trial_end: existing?.trial_end || null,
    current_period_end: null,
    cancel_at_period_end: false,
    updated_at: new Date().toISOString(),
  };

  let subError: string | null = null;

  if (existing?.id) {
    const { error } = await admin
      .from("subscriptions")
      .update(subscriptionRow)
      .eq("id", existing.id);

    if (error) subError = error.message;
  } else {
    const { error } = await admin.from("subscriptions").insert(subscriptionRow);

    if (error) subError = error.message;
  }

  if (subError) {
    throw new Error(subError);
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
  const normalizedEmail = normalizeEmail(user.email);
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

      const errorMessage =
        trialError instanceof Error ? trialError.message : "trial_start_failed";

      return NextResponse.redirect(
        new URL(
          `/free-trial?plan=${selectedPlan}&email=${encodeURIComponent(
            normalizedEmail,
          )}&error=${encodeURIComponent(errorMessage)}`,
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

      const errorMessage =
        basicError instanceof Error
          ? basicError.message
          : "basic_signup_failed";

      return NextResponse.redirect(
        new URL(
          `/signup?plan=basic&email=${encodeURIComponent(
            normalizedEmail,
          )}&error=${encodeURIComponent(errorMessage)}`,
          origin,
        ),
      );
    }
  }

  return response;
}
