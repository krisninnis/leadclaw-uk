export function normalizeSubscriptionStatus(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function normalizePlan(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function hasFullLeadClawAccess(value: string | null | undefined) {
  const status = normalizeSubscriptionStatus(value);
  return ["trialing", "active", "past_due"].includes(status);
}

export function hasBasicLeadClawAccess(
  statusValue: string | null | undefined,
  planValue?: string | null | undefined,
) {
  const status = normalizeSubscriptionStatus(statusValue);
  const plan = normalizePlan(planValue);

  return plan === "basic" || ["basic", "expired", "canceled"].includes(status);
}

export function canUseLeadClawProduct(
  statusValue: string | null | undefined,
  planValue?: string | null | undefined,
) {
  return (
    hasFullLeadClawAccess(statusValue) ||
    hasBasicLeadClawAccess(statusValue, planValue)
  );
}

export function canAccessPortal(
  statusValue: string | null | undefined,
  planValue?: string | null | undefined,
) {
  return canUseLeadClawProduct(statusValue, planValue);
}

export function isLimitedSubscription(
  statusValue: string | null | undefined,
  planValue?: string | null | undefined,
) {
  return (
    !hasFullLeadClawAccess(statusValue) &&
    hasBasicLeadClawAccess(statusValue, planValue)
  );
}

export function isFullyBlockedSubscription(
  statusValue: string | null | undefined,
  planValue?: string | null | undefined,
) {
  return !canAccessPortal(statusValue, planValue);
}
