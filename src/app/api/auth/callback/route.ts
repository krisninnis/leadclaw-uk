export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemEvent } from "@/lib/ops";
import { provisionClinicWorkspace } from "@/lib/provision-clinic";
import { normalizeAuthRedirectPath } from "@/lib/auth-redirect";
import {
  buildTrialRedirectSubscriptionPatch,
  decideTrialGate,
  normalizeEmail,
  normalizeSubscriptionStatus,
  SUBSCRIPTION_GATE_SELECT,
  type SubscriptionGateRow,
  type TrialGateRedirectCode,
} from "@/lib/trial-subscription-gate";

type PlanSlug = "basic" | "growth" | "pro";

type ApplicationIdRow = {
  id: string;
};

type TrialStartResult =
  | { ok: true }
  | {
      ok: false;
      code: TrialGateRedirectCode;
      message: string;
      redirectTo: string;
    };

function normalizeNext(value: string | null) {
  return normalizeAuthRedirectPath(value, "/portal");
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

function isPaidLikeStatus(status: string | null | undefined) {
  return ["active", "past_due"].includes(normalizeSubscriptionStatus(status));
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

  const { data: existingRow, error: findError } = await (admin as unknown as SupabaseUntypedClient)
    .from("applications")
    .select("id")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }

  const existingApplication = existingRow as ApplicationIdRow | null;

  if (existingApplication?.id) {
    const { error: updateError } = await (admin as unknown as SupabaseUntypedClient)
      .from("applications")
      .update({
        plan,
        contact_name: contactName,
        city: "Not Provided",
      })
      .eq("id", existingApplication.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return;
  }

  const { error: insertError } = await (admin as unknown as SupabaseUntypedClient).from("applications").insert({
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
): Promise<TrialStartResult> {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("supabase_not_configured");
  }

  const { data: existingRows, error: existingError } = await (admin as unknown as SupabaseUntypedClient)
    .from("subscriptions")
    .select(SUBSCRIPTION_GATE_SELECT)
    .or(`user_id.eq.${userId},email.eq.${email}`)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingList = (existingRows || []) as SubscriptionGateRow[];
  const gate = decideTrialGate({
    rows: existingList,
    userId,
    email,
    requestedPlan: plan,
  });

  if (gate.action === "redirect") {
    const patch = buildTrialRedirectSubscriptionPatch({
      decision: gate,
      userId,
      email,
    });

    if (patch) {
      const { error: patchError } = await (admin as unknown as SupabaseUntypedClient)
        .from("subscriptions")
        .update(patch.values)
        .eq("id", patch.id);

      if (patchError) {
        throw new Error(patchError.message);
      }
    }

    await logSystemEvent({
      level: "info",
      category: "billing_trial",
      message: `Trial start redirected for ${email}`,
      meta: {
        userId,
        email,
        plan: gate.selectedPlan,
        code: gate.code,
      },
    });

    return {
      ok: false,
      code: gate.code,
      message: gate.message,
      redirectTo: gate.redirectTo,
    };
  }

  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 7);

  const trialSubscriptionId = `trial_${userId}`;
  const selectedPlan = gate.selectedPlan;
  const existing = gate.existing;

  const subscriptionRow = {
    user_id: userId,
    email,
    stripe_customer_id: existing?.stripe_customer_id || null,
    stripe_subscription_id: trialSubscriptionId,
    stripe_price_id: null,
    plan: selectedPlan,
    status: "trialing",
    trial_end: trialEnd.toISOString(),
    current_period_end: null,
    cancel_at_period_end: true,
    updated_at: new Date().toISOString(),
  };

  let subError: string | null = null;

  if (existing?.id) {
    const { error } = await (admin as unknown as SupabaseUntypedClient)
      .from("subscriptions")
      .update(subscriptionRow)
      .eq("id", existing.id);

    if (error) subError = error.message;
  } else {
    const { error } = await (admin as unknown as SupabaseUntypedClient)
      .from("subscriptions")
      .insert(subscriptionRow);

    if (error) subError = error.message;
  }

  if (subError) {
    throw new Error(subError);
  }

  await saveApplicationRecord(email, selectedPlan, contactName);

  let provisionResult: Awaited<
    ReturnType<typeof provisionClinicWorkspace>
  > | null = null;

  try {
    provisionResult = await provisionClinicWorkspace({
      email,
      plan: selectedPlan,
      subscriptionStatus: "trialing",
      ownerUserId: userId,
      ownerName: contactName,
    });
  } catch (e) {
    await logSystemEvent({
      level: "warn",
      category: "onboarding",
      message:
        "Trial started in auth callback but onboarding auto-provision encountered an issue",
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
    message: `No-card ${selectedPlan} trial started for ${email} in auth callback`,
    meta: {
      userId,
      email,
      plan: selectedPlan,
      reason: gate.reason,
      trialEnd: trialEnd.toISOString(),
      siteId: provisionResult?.siteId || null,
      clinicId: provisionResult?.clinicId || null,
    },
  });

  return { ok: true };
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

  const { data: existingRows, error: existingError } = await (admin as unknown as SupabaseUntypedClient)
    .from("subscriptions")
    .select(SUBSCRIPTION_GATE_SELECT)
    .or(`user_id.eq.${userId},email.eq.${email}`)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingList = (existingRows || []) as SubscriptionGateRow[];
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
    const { error } = await (admin as unknown as SupabaseUntypedClient)
      .from("subscriptions")
      .update(subscriptionRow)
      .eq("id", existing.id);

    if (error) subError = error.message;
  } else {
    const { error } = await (admin as unknown as SupabaseUntypedClient)
      .from("subscriptions")
      .insert(subscriptionRow);

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
      ownerUserId: userId,
      ownerName: contactName,
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
  const redirectWithSession = (path: string) => {
    response.headers.set("Location", new URL(path, origin).toString());
    return response;
  };

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
      const trialResult = await startTrialForUser(
        user.id,
        normalizedEmail,
        selectedPlan,
        contactName,
      );

      if (!trialResult.ok) {
        return redirectWithSession(trialResult.redirectTo);
      }
    } catch (trialError) {
      console.error("[api.auth.callback] failed to start trial", trialError);

      const errorMessage =
        trialError instanceof Error ? trialError.message : "trial_start_failed";

      return redirectWithSession(
        `/free-trial?plan=${selectedPlan}&email=${encodeURIComponent(
          normalizedEmail,
        )}&error=${encodeURIComponent(errorMessage)}`,
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

      if (errorMessage === "already_subscribed") {
        return redirectWithSession("/portal/billing?account=active&plan=basic");
      }

      return redirectWithSession(
        `/signup?plan=basic&email=${encodeURIComponent(
          normalizedEmail,
        )}&error=${encodeURIComponent(errorMessage)}`,
      );
    }
  }

  return response;
}
