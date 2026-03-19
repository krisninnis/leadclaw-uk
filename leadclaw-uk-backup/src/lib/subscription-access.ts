export function normalizeSubscriptionStatus(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function canUseLeadClawProduct(value: string | null | undefined) {
  const status = normalizeSubscriptionStatus(value);

  return ["trialing", "active", "past_due"].includes(status);
}

export function isFullyBlockedSubscription(value: string | null | undefined) {
  return !canUseLeadClawProduct(value);
}
