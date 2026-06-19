import {
  PLAN_DISPLAY_NAMES,
  normalizePlan,
  type PaidPlanSlug,
  type PlanSlug,
} from "@/lib/plans";
import {
  hasBasicLeadClawAccess,
  hasFullLeadClawAccess,
  normalizeSubscriptionStatus,
} from "@/lib/subscription-access";
import {
  isRealStripeCustomerId,
  shouldRedirectExistingToPortal,
} from "@/lib/checkout-guard";

export type BillingSubscriptionRow = {
  status?: string | null;
  plan?: string | null;
  trial_end?: string | null;
  current_period_end?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
};

export function formatBillingDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}

export function deriveBillingView(
  subscription: BillingSubscriptionRow | null | undefined,
  params?: { account?: string | string[]; expired?: string | string[] },
) {
  const status = normalizeSubscriptionStatus(subscription?.status) || "none";
  const hasFullAccess = hasFullLeadClawAccess(status);
  const storedPlan = normalizePlan(subscription?.plan, "basic");
  const currentPlan: PlanSlug = hasFullAccess ? storedPlan : "basic";
  const hasBasicAccess =
    !hasFullAccess && hasBasicLeadClawAccess(status, currentPlan);
  const isTrialing = status === "trialing";
  const trialEnded =
    Boolean(subscription?.trial_end) && ["expired", "canceled"].includes(status);
  const canManageBilling = isRealStripeCustomerId(
    subscription?.stripe_customer_id,
  );
  const usePortalForPlanChanges = shouldRedirectExistingToPortal(subscription);

  return {
    status,
    currentPlan,
    planLabel: PLAN_DISPLAY_NAMES[currentPlan],
    trialEnd: subscription?.trial_end || null,
    currentPeriodEnd: subscription?.current_period_end || null,
    hasFullAccess,
    hasBasicAccess,
    accessStateLabel: hasFullAccess
      ? "Full"
      : hasBasicAccess
        ? "Basic"
        : "Blocked",
    isTrialing,
    trialEnded,
    showTrialEndedNotice: trialEnded,
    showPastDueNotice: status === "past_due",
    showUpgradeNotice: hasBasicAccess && !hasFullAccess,
    showActiveAccountNotice:
      params?.account === "active" && ["active", "trialing"].includes(status),
    canManageBilling,
    usePortalForPlanChanges,
  };
}

export type BillingPlanAction = {
  kind: "checkout" | "portal" | "current" | "unavailable";
  label: string;
};

export function getBillingPlanAction(input: {
  plan: PaidPlanSlug;
  currentPlan: PlanSlug;
  subscriptionStatus?: string | null;
  usePortalForPlanChanges: boolean;
  canManageBilling: boolean;
}): BillingPlanAction {
  const status = normalizeSubscriptionStatus(input.subscriptionStatus);
  const planName = PLAN_DISPLAY_NAMES[input.plan];

  if (status === "active" && input.currentPlan === input.plan) {
    return { kind: "current", label: "Current plan" };
  }

  if (input.usePortalForPlanChanges) {
    return input.canManageBilling
      ? { kind: "portal", label: `Change to ${planName}` }
      : {
          kind: "unavailable",
          label: "Contact support to change plan",
        };
  }

  return { kind: "checkout", label: `Upgrade to ${planName}` };
}

export function getCheckoutErrorMessage(
  error: string,
  requiredEnvVar?: string,
) {
  if (error === "missing_price_id" && requiredEnvVar) {
    return `${requiredEnvVar} is not configured yet. Please contact support to upgrade.`;
  }

  if (error === "already_on_requested_plan") {
    return "You are already on that plan.";
  }

  if (error === "active_subscription_exists") {
    return "You already have a Stripe subscription. Open Manage billing to change plan, update payment details, or cancel.";
  }

  if (error === "stripe_not_configured") {
    return "Stripe checkout is not configured yet. Please contact support to upgrade.";
  }

  return "Could not start checkout right now. Please try again or contact support.";
}
