import { isPaidPlan, normalizeTrialPlan, type PaidPlanSlug } from "@/lib/plans";

export const SUBSCRIPTION_GATE_SELECT =
  "id,user_id,email,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan,status,trial_end,current_period_end,cancel_at_period_end,updated_at";

export type SubscriptionGateRow = {
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

export type TrialGateRedirectCode =
  | "trial_already_active"
  | "active_subscription_exists"
  | "trial_already_used";

export type TrialGateDecision =
  | {
      action: "start_trial";
      existing: SubscriptionGateRow | null;
      reason: "new_user" | "basic_upgrade" | "inactive_subscription";
      selectedPlan: PaidPlanSlug;
    }
  | {
      action: "redirect";
      code: TrialGateRedirectCode;
      existing: SubscriptionGateRow | null;
      message: string;
      redirectTo: string;
      selectedPlan: PaidPlanSlug;
      trialEnd: string | null;
    };

export function normalizeEmail(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function normalizeSubscriptionStatus(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function isFutureDate(value?: string | null, now = new Date()) {
  if (!value) return false;
  const dt = new Date(value);
  return !Number.isNaN(dt.getTime()) && dt.getTime() > now.getTime();
}

function isRealStripeSubscriptionId(value?: string | null) {
  return typeof value === "string" && value.startsWith("sub_");
}

function isRealStripeCustomerId(value?: string | null) {
  return typeof value === "string" && value.startsWith("cus_");
}

function hasStripeBillingReference(row: SubscriptionGateRow) {
  return (
    isRealStripeSubscriptionId(row.stripe_subscription_id) ||
    isRealStripeCustomerId(row.stripe_customer_id) ||
    Boolean(row.stripe_price_id)
  );
}

function isActivePaidSubscription(row: SubscriptionGateRow) {
  const status = normalizeSubscriptionStatus(row.status);
  if (!["active", "past_due"].includes(status)) return false;
  return hasStripeBillingReference(row) || isPaidPlan(row.plan);
}

function isActiveTrial(row: SubscriptionGateRow, now: Date) {
  return (
    normalizeSubscriptionStatus(row.status) === "trialing" &&
    isFutureDate(row.trial_end, now)
  );
}

function matchesUserOrEmail(
  row: SubscriptionGateRow,
  userId: string,
  email: string,
) {
  return row.user_id === userId || normalizeEmail(row.email) === email;
}

function chooseReusableSubscription(
  rows: SubscriptionGateRow[],
  userId: string,
  email: string,
) {
  return (
    rows.find((row) => row.user_id === userId) ||
    rows.find((row) => !row.user_id && normalizeEmail(row.email) === email) ||
    rows.find((row) => normalizeEmail(row.email) === email) ||
    null
  );
}

function planParam(plan: PaidPlanSlug) {
  return encodeURIComponent(plan);
}

export function decideTrialGate(input: {
  rows: SubscriptionGateRow[];
  userId: string;
  email: string;
  requestedPlan?: string | null;
  now?: Date;
}): TrialGateDecision {
  const now = input.now || new Date();
  const email = normalizeEmail(input.email);
  const selectedPlan = normalizeTrialPlan(input.requestedPlan);
  const rows = input.rows.filter((row) =>
    matchesUserOrEmail(row, input.userId, email),
  );

  const activePaid = rows.find(isActivePaidSubscription);
  if (activePaid) {
    return {
      action: "redirect",
      code: "active_subscription_exists",
      existing: activePaid,
      message: "You already have an active LeadClaw account.",
      redirectTo: `/portal/billing?account=active&plan=${planParam(
        selectedPlan,
      )}`,
      selectedPlan,
      trialEnd: activePaid.trial_end,
    };
  }

  const activeTrial = rows.find((row) => isActiveTrial(row, now));
  if (activeTrial) {
    return {
      action: "redirect",
      code: "trial_already_active",
      existing: activeTrial,
      message: "Your LeadClaw trial is already active.",
      redirectTo: `/portal?trial=active&plan=${planParam(selectedPlan)}`,
      selectedPlan,
      trialEnd: activeTrial.trial_end,
    };
  }

  const trialHistory = rows.find((row) => Boolean(row.trial_end));
  if (trialHistory) {
    return {
      action: "redirect",
      code: "trial_already_used",
      existing: trialHistory,
      message: "Your previous LeadClaw trial has ended.",
      redirectTo: `/portal/billing?expired=1&plan=${planParam(selectedPlan)}`,
      selectedPlan,
      trialEnd: trialHistory.trial_end,
    };
  }

  const existing = chooseReusableSubscription(rows, input.userId, email);
  const existingStatus = normalizeSubscriptionStatus(existing?.status);
  const existingPlan = String(existing?.plan || "")
    .trim()
    .toLowerCase();

  return {
    action: "start_trial",
    existing,
    reason: !existing
      ? "new_user"
      : existingStatus === "basic" || existingPlan === "basic"
        ? "basic_upgrade"
        : "inactive_subscription",
    selectedPlan,
  };
}

export function buildTrialRedirectSubscriptionPatch(input: {
  decision: TrialGateDecision;
  userId: string;
  email: string;
  now?: Date;
}) {
  if (input.decision.action !== "redirect") return null;
  const existing = input.decision.existing;
  if (!existing?.id) return null;

  const patch: Partial<SubscriptionGateRow> & { updated_at?: string } = {};
  const email = normalizeEmail(input.email);

  if (!existing.user_id) {
    patch.user_id = input.userId;
  }

  if (!normalizeEmail(existing.email) && email) {
    patch.email = email;
  }

  const status = normalizeSubscriptionStatus(existing.status);
  const trialHasEnded =
    Boolean(existing.trial_end) && !isFutureDate(existing.trial_end, input.now);

  if (
    input.decision.code === "trial_already_used" &&
    trialHasEnded &&
    !["basic", "expired", "canceled"].includes(status)
  ) {
    patch.status = "expired";
    patch.plan = "basic";
    patch.current_period_end = null;
    patch.cancel_at_period_end = true;
  }

  if (Object.keys(patch).length === 0) return null;

  return {
    id: existing.id,
    values: {
      ...patch,
      updated_at: new Date().toISOString(),
    },
  };
}
