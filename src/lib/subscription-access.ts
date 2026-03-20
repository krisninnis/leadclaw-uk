export function normalizeSubscriptionStatus(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function hasFullLeadClawAccess(value: string | null | undefined) {
  const status = normalizeSubscriptionStatus(value);
  return ["trialing", "active", "past_due"].includes(status);
}

export function hasBasicLeadClawAccess(value: string | null | undefined) {
  const status = normalizeSubscriptionStatus(value);
  return ["basic", "expired", "canceled"].includes(status);
}

export function canUseLeadClawProduct(value: string | null | undefined) {
  return hasFullLeadClawAccess(value);
}

export function canAccessPortal(value: string | null | undefined) {
  return hasFullLeadClawAccess(value) || hasBasicLeadClawAccess(value);
}

export function isLimitedSubscription(value: string | null | undefined) {
  return hasBasicLeadClawAccess(value);
}

export function isFullyBlockedSubscription(value: string | null | undefined) {
  return !canAccessPortal(value);
}
