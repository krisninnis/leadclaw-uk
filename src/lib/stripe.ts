import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) return null;

  return new Stripe(key);
}

// IMPORTANT:
// Basic = FREE → no Stripe price
// Only paid plans exist in Stripe

export const PRICE_IDS = {
  growth: process.env.STRIPE_PRICE_GROWTH || "",
  pro: process.env.STRIPE_PRICE_PRO || "",
};

// Optional helper (VERY useful later)
export function isPaidPlan(plan: string) {
  return plan === "growth" || plan === "pro";
}
