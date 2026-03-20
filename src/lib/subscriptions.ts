import { createAdminClient } from "@/lib/supabase/admin";

function toIso(ts?: number | null) {
  if (!ts) return null;
  return new Date(ts * 1000).toISOString();
}

function normalizeEmail(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

type SubscriptionInput = {
  userId?: string | null;
  email?: string | null;
  customerId?: string | null;
  subscriptionId: string;
  priceId?: string | null;
  plan?: string | null;
  status?: string | null;
  trialEnd?: number | null;
  currentPeriodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
};

type ExistingSubscriptionRow = {
  id: string;
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

export async function upsertStripeSubscription(input: SubscriptionInput) {
  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, reason: "supabase_not_configured" as const };
  }

  const normalizedEmail = normalizeEmail(input.email);

  const filters: string[] = [
    `stripe_subscription_id.eq.${input.subscriptionId}`,
  ];

  if (input.userId) {
    filters.push(`user_id.eq.${input.userId}`);
  }

  if (normalizedEmail) {
    filters.push(`email.eq.${normalizedEmail}`);
  }

  const { data: existingRows, error: existingError } = await admin
    .from("subscriptions")
    .select(
      "id,user_id,email,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan,status,trial_end,current_period_end,cancel_at_period_end,updated_at",
    )
    .or(filters.join(","))
    .order("updated_at", { ascending: false })
    .limit(10);

  if (existingError) {
    return { ok: false, reason: existingError.message as string };
  }

  const typedRows = (existingRows || []) as ExistingSubscriptionRow[];

  const existing =
    typedRows.find(
      (row) =>
        row.stripe_subscription_id &&
        row.stripe_subscription_id === input.subscriptionId,
    ) ||
    (input.userId
      ? typedRows.find((row) => row.user_id === input.userId)
      : null) ||
    (normalizedEmail
      ? typedRows.find((row) => normalizeEmail(row.email) === normalizedEmail)
      : null) ||
    null;

  const row = {
    user_id: input.userId || existing?.user_id || null,
    email: normalizedEmail || normalizeEmail(existing?.email) || null,
    stripe_customer_id:
      input.customerId || existing?.stripe_customer_id || null,
    stripe_subscription_id: input.subscriptionId,
    stripe_price_id: input.priceId || null,
    plan: input.plan || existing?.plan || null,
    status: input.status || existing?.status || null,
    trial_end: toIso(input.trialEnd),
    current_period_end: toIso(input.currentPeriodEnd),
    cancel_at_period_end: Boolean(input.cancelAtPeriodEnd),
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error: updateError } = await admin
      .from("subscriptions")
      .update(row)
      .eq("id", existing.id);

    if (updateError) {
      return { ok: false, reason: updateError.message as string };
    }

    return { ok: true as const };
  }

  const { error: insertError } = await admin.from("subscriptions").insert(row);

  if (insertError) {
    return { ok: false, reason: insertError.message as string };
  }

  return { ok: true as const };
}
