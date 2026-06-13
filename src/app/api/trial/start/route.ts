import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemEvent } from "@/lib/ops";
import { provisionClinicWorkspace } from "@/lib/provision-clinic";
import {
  buildTrialRedirectSubscriptionPatch,
  decideTrialGate,
  normalizeEmail,
  SUBSCRIPTION_GATE_SELECT,
  type SubscriptionGateRow,
} from "@/lib/trial-subscription-gate";

export async function POST(req: NextRequest) {
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

  const { data: existingRows, error: existingError } = await (admin as unknown as SupabaseUntypedClient)
    .from("subscriptions")
    .select(SUBSCRIPTION_GATE_SELECT)
    .or(`user_id.eq.${user.id},email.eq.${email}`)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (existingError) {
    return NextResponse.json(
      { ok: false, error: existingError.message },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const existingList = (existingRows || []) as SubscriptionGateRow[];
  const gate = decideTrialGate({
    rows: existingList,
    userId: user.id,
    email,
    requestedPlan: body?.plan,
  });

  if (gate.action === "redirect") {
    const patch = buildTrialRedirectSubscriptionPatch({
      decision: gate,
      userId: user.id,
      email,
    });

    if (patch) {
      const { error: patchError } = await (admin as unknown as SupabaseUntypedClient)
        .from("subscriptions")
        .update(patch.values)
        .eq("id", patch.id);

      if (patchError) {
        return NextResponse.json(
          { ok: false, error: patchError.message },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      {
        ok: false,
        error: gate.code,
        message: gate.message,
        redirectTo: gate.redirectTo,
        trialEnd: gate.trialEnd,
      },
      { status: 409 },
    );
  }

  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 7);

  const selectedPlan = gate.selectedPlan;
  const existing = gate.existing;
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
    const { error: updateError } = await (admin as unknown as SupabaseUntypedClient)
      .from("subscriptions")
      .update(row)
      .eq("id", existing.id);

    if (updateError) {
      writeError = updateError.message;
    }
  } else {
    const { error: insertError } = await (admin as unknown as SupabaseUntypedClient)
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
    provisionResult = await provisionClinicWorkspace({
      email,
      plan: selectedPlan,
      ownerUserId: user.id,
      ownerName:
        String(user.user_metadata?.name || "").trim() ||
        String(user.user_metadata?.full_name || "").trim() ||
        null,
    });
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
