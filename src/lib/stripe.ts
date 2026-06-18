import Stripe from "stripe";
import { isPaidPlan } from "@/lib/plans";
import { getStripePriceIdForPlan } from "@/lib/stripe-plans";
import { evaluateStripeEnvironment } from "@/lib/stripe-environment";

// Returns a Stripe client, or null when Stripe must not be used.
//
// Fails closed on an environment/key-mode mismatch so a live key can never mint
// `cs_live_` sessions from a Preview/Development deployment (and a test key
// cannot masquerade as live in Production). Callers already treat null as
// `stripe_not_configured`. Override with STRIPE_ALLOW_MODE_MISMATCH=true.
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;

  const evaluation = evaluateStripeEnvironment();
  if (evaluation.blocked) {
    console.error(
      `[stripe] Refusing to initialise Stripe — ${evaluation.reason} ` +
        `(deploymentEnv=${evaluation.deploymentEnv}, keyMode=${evaluation.keyMode}, expected=${evaluation.expectedMode}).`,
    );
    return null;
  }

  return new Stripe(key);
}

// Basic = FREE → no Stripe price. Only paid plans (Growth, Pro) exist in Stripe.
export { isPaidPlan, getStripePriceIdForPlan };
