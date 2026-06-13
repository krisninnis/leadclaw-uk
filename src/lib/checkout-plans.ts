import { isPaidPlan, isPlanSlug, type PaidPlanSlug } from "@/lib/plans";
import {
  getStripePriceIdForPlan,
  STRIPE_PRICE_ENV_VARS,
} from "@/lib/stripe-plans";

type CheckoutPlanError =
  | "invalid_plan"
  | "basic_plan_does_not_require_checkout"
  | "invalid_paid_plan"
  | "missing_price_id";

type CheckoutPlanResolution =
  | {
      ok: true;
      plan: PaidPlanSlug;
      priceId: string;
    }
  | {
      ok: false;
      error: CheckoutPlanError;
      requiredEnvVar?: string;
    };

export function resolveCheckoutPlan(
  value: unknown,
  env: NodeJS.ProcessEnv = process.env,
): CheckoutPlanResolution {
  if (typeof value !== "string" || !isPlanSlug(value)) {
    return { ok: false, error: "invalid_plan" };
  }

  if (value === "basic") {
    return { ok: false, error: "basic_plan_does_not_require_checkout" };
  }

  if (!isPaidPlan(value)) {
    return { ok: false, error: "invalid_paid_plan" };
  }

  const priceId = getStripePriceIdForPlan(value, env);
  if (!priceId) {
    return {
      ok: false,
      error: "missing_price_id",
      requiredEnvVar: STRIPE_PRICE_ENV_VARS[value],
    };
  }

  return { ok: true, plan: value, priceId };
}
