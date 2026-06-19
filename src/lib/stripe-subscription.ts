import type Stripe from "stripe";

// In the Stripe "basil" API era (SDK v18+, this repo is on v20), `current_period_end`
// was removed from the Subscription object and now lives on each subscription
// item (`subscription.items.data[i].current_period_end`). Read it from the item,
// with a defensive fallback to the legacy subscription-level field so older event
// shapes still resolve. Returns a Unix timestamp (seconds) or null.
export function getSubscriptionCurrentPeriodEnd(
  sub: Stripe.Subscription,
): number | null {
  const item = sub.items?.data?.[0] as
    | { current_period_end?: number | null }
    | undefined;
  const itemEnd = item?.current_period_end;
  if (typeof itemEnd === "number") return itemEnd;

  const legacy = (sub as unknown as { current_period_end?: number | null })
    .current_period_end;
  return typeof legacy === "number" ? legacy : null;
}
