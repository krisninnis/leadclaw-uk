import { isPaidPlan, type PaidPlanSlug } from "@/lib/plans";

export const STRIPE_PRICE_ENV_VARS: Record<PaidPlanSlug, string> = {
  growth: "STRIPE_PRICE_GROWTH",
  pro: "STRIPE_PRICE_PRO",
};

type StripePriceEnv = {
  STRIPE_PRICE_GROWTH?: string;
  STRIPE_PRICE_PRO?: string;
  [key: string]: string | undefined;
};

export function getStripePriceIdForPlan(
  plan: unknown,
  env: StripePriceEnv = process.env,
) {
  if (!isPaidPlan(plan)) return null;

  const envVar = STRIPE_PRICE_ENV_VARS[plan];
  return env[envVar]?.trim() || "";
}

export function planFromStripePriceId(
  priceId: string | null | undefined,
  env: StripePriceEnv = process.env,
): PaidPlanSlug | null {
  const normalizedPriceId = priceId?.trim();
  if (!normalizedPriceId) return null;

  for (const plan of Object.keys(STRIPE_PRICE_ENV_VARS) as PaidPlanSlug[]) {
    if (normalizedPriceId === getStripePriceIdForPlan(plan, env)) {
      return plan;
    }
  }

  return null;
}
