const {
  getSubscriptionCurrentPeriodEnd,
} = require("@/lib/stripe-subscription");
const {
  isRealStripeSubscriptionId,
  shouldRedirectExistingToPortal,
} = require("@/lib/checkout-guard");
const {
  hasFullLeadClawAccess,
  hasBasicLeadClawAccess,
} = require("@/lib/subscription-access");

describe("getSubscriptionCurrentPeriodEnd", () => {
  it("reads current_period_end from the subscription item (basil API)", () => {
    expect(
      getSubscriptionCurrentPeriodEnd({
        items: { data: [{ current_period_end: 1893456000 }] },
      }),
    ).toBe(1893456000);
  });

  it("falls back to the legacy subscription-level field", () => {
    expect(
      getSubscriptionCurrentPeriodEnd({
        current_period_end: 1700000000,
        items: { data: [{}] },
      }),
    ).toBe(1700000000);
  });

  it("returns null when no period end is present", () => {
    expect(getSubscriptionCurrentPeriodEnd({ items: { data: [] } })).toBeNull();
    expect(getSubscriptionCurrentPeriodEnd({})).toBeNull();
  });
});

describe("duplicate-subscription guard", () => {
  it("blocks checkout for an active real Stripe subscription", () => {
    expect(
      shouldRedirectExistingToPortal({
        status: "active",
        stripe_subscription_id: "sub_123",
      }),
    ).toBe(true);
  });

  it("blocks for past_due and trialing real subscriptions", () => {
    expect(
      shouldRedirectExistingToPortal({
        status: "past_due",
        stripe_subscription_id: "sub_1",
      }),
    ).toBe(true);
    expect(
      shouldRedirectExistingToPortal({
        status: "trialing",
        stripe_subscription_id: "sub_1",
      }),
    ).toBe(true);
  });

  it("allows a no-card trial (trial_ placeholder) to convert to paid", () => {
    expect(
      shouldRedirectExistingToPortal({
        status: "trialing",
        stripe_subscription_id: "trial_abc",
      }),
    ).toBe(false);
  });

  it("allows resubscribe when canceled / basic / none", () => {
    expect(
      shouldRedirectExistingToPortal({
        status: "canceled",
        stripe_subscription_id: "sub_1",
      }),
    ).toBe(false);
    expect(
      shouldRedirectExistingToPortal({
        status: "basic",
        stripe_subscription_id: null,
      }),
    ).toBe(false);
    expect(shouldRedirectExistingToPortal(null)).toBe(false);
  });

  it("isRealStripeSubscriptionId distinguishes real vs placeholder ids", () => {
    expect(isRealStripeSubscriptionId("sub_1")).toBe(true);
    expect(isRealStripeSubscriptionId("trial_1")).toBe(false);
    expect(isRealStripeSubscriptionId(null)).toBe(false);
  });
});

describe("past_due access rules", () => {
  it("past_due retains full access (grace period)", () => {
    expect(hasFullLeadClawAccess("past_due")).toBe(true);
  });

  it("canceled loses full access but keeps basic access", () => {
    expect(hasFullLeadClawAccess("canceled")).toBe(false);
    expect(hasBasicLeadClawAccess("canceled", "growth")).toBe(true);
  });
});
