export const PLAN_SLUGS = ["basic", "growth", "pro"] as const;
export type PlanSlug = (typeof PLAN_SLUGS)[number];

export const PAID_PLAN_SLUGS = ["growth", "pro"] as const;
export type PaidPlanSlug = (typeof PAID_PLAN_SLUGS)[number];

export const PLAN_DISPLAY_NAMES: Record<PlanSlug, string> = {
  basic: "Basic",
  growth: "Growth",
  pro: "Pro",
};

export const PLAN_MONTHLY_PRICES: Record<
  PlanSlug,
  { amount: number; display: string; displayMonthly: string }
> = {
  basic: { amount: 0, display: "Free", displayMonthly: "£0/month" },
  growth: { amount: 79, display: "£79", displayMonthly: "£79/month" },
  pro: { amount: 149, display: "£149", displayMonthly: "£149/month" },
};

export function isPlanSlug(value: unknown): value is PlanSlug {
  return (
    typeof value === "string" &&
    (PLAN_SLUGS as readonly string[]).includes(value)
  );
}

export function isPaidPlan(value: unknown): value is PaidPlanSlug {
  return (
    typeof value === "string" &&
    (PAID_PLAN_SLUGS as readonly string[]).includes(value)
  );
}

export function normalizePlan(
  value: string | null | undefined,
  fallback: PlanSlug = "basic",
): PlanSlug {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "starter") return "basic";
  if (isPlanSlug(normalized)) return normalized;
  return fallback;
}

export function normalizeTrialPlan(
  value: string | null | undefined,
): PaidPlanSlug {
  return normalizePlan(value, "growth") === "pro" ? "pro" : "growth";
}
