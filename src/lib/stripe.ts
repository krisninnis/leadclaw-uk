import Stripe from "stripe";
import { isPaidPlan } from "@/lib/plans";
import { getStripePriceIdForPlan } from "@/lib/stripe-plans";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) return null;

  return new Stripe(key);
}

// IMPORTANT:
// Basic = FREE → no Stripe price
// Only paid plans exist in Stripe

export const PRICE_IDS = {
  growth: getStripePriceIdForPlan("growth") || "",
  pro: getStripePriceIdForPlan("pro") || "",
};

export { isPaidPlan, getStripePriceIdForPlan };
