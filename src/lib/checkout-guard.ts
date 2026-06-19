// Prevents an existing *real* Stripe subscriber from creating a duplicate
// subscription via Checkout. Plan changes for active subscribers must go through
// the Billing Portal. No-card trials use a `trial_` placeholder subscription id
// and are intentionally allowed to convert to paid via Checkout.

export function isRealStripeSubscriptionId(value?: string | null): boolean {
  return typeof value === "string" && value.startsWith("sub_");
}

type ExistingSubscriptionForGuard =
  | {
      status?: string | null;
      stripe_subscription_id?: string | null;
    }
  | null
  | undefined;

export function shouldRedirectExistingToPortal(
  existing: ExistingSubscriptionForGuard,
): boolean {
  if (!existing) return false;
  if (!isRealStripeSubscriptionId(existing.stripe_subscription_id)) return false;

  const status = String(existing.status || "")
    .trim()
    .toLowerCase();
  return ["active", "trialing", "past_due"].includes(status);
}
