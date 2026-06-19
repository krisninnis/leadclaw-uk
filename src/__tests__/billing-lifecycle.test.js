const {
  getSubscriptionCurrentPeriodEnd,
} = require("@/lib/stripe-subscription");
const {
  isRealStripeCustomerId,
  isRealStripeSubscriptionId,
  shouldRedirectExistingToPortal,
} = require("@/lib/checkout-guard");
const {
  hasFullLeadClawAccess,
  hasBasicLeadClawAccess,
} = require("@/lib/subscription-access");
const {
  deriveBillingView,
  formatBillingDate,
  getBillingPlanAction,
  getCheckoutErrorMessage,
} = require("@/lib/billing-view");

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

  it("blocks an active Stripe customer even if a legacy row is missing the subscription id", () => {
    expect(
      shouldRedirectExistingToPortal({
        status: "active",
        stripe_customer_id: "cus_123",
        stripe_subscription_id: null,
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
    expect(isRealStripeCustomerId("cus_1")).toBe(true);
    expect(isRealStripeCustomerId("trial_1")).toBe(false);
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

describe("billing page view model", () => {
  it("ignores active-account query params for Basic and canceled accounts", () => {
    const basic = deriveBillingView(null, { account: "active" });
    const canceled = deriveBillingView(
      {
        status: "canceled",
        plan: "growth",
        trial_end: "2026-06-01T12:00:00.000Z",
        current_period_end: "2026-06-10T12:00:00.000Z",
        stripe_customer_id: "cus_ended",
        stripe_subscription_id: "sub_ended",
      },
      { account: "active", expired: "1" },
    );

    expect(basic).toMatchObject({
      currentPlan: "basic",
      accessStateLabel: "Basic",
      showActiveAccountNotice: false,
      showUpgradeNotice: true,
    });
    expect(canceled).toMatchObject({
      currentPlan: "basic",
      accessStateLabel: "Basic",
      hasFullAccess: false,
      showActiveAccountNotice: false,
      showTrialEndedNotice: true,
      usePortalForPlanChanges: false,
    });
  });

  it("maps active Growth and Pro subscriptions to full access and Billing Portal actions", () => {
    for (const currentPlan of ["growth", "pro"]) {
      const view = deriveBillingView(
        {
          status: "active",
          plan: currentPlan,
          current_period_end: "2026-07-01T12:00:00.000Z",
          stripe_customer_id: `cus_${currentPlan}`,
          stripe_subscription_id: `sub_${currentPlan}`,
        },
        { account: "active" },
      );

      expect(view).toMatchObject({
        currentPlan,
        accessStateLabel: "Full",
        showActiveAccountNotice: true,
        canManageBilling: true,
        usePortalForPlanChanges: true,
      });

      expect(
        getBillingPlanAction({
          plan: currentPlan,
          currentPlan,
          subscriptionStatus: "active",
          usePortalForPlanChanges: true,
          canManageBilling: true,
        }),
      ).toEqual({ kind: "current", label: "Current plan" });
    }

    expect(
      getBillingPlanAction({
        plan: "pro",
        currentPlan: "growth",
        subscriptionStatus: "active",
        usePortalForPlanChanges: true,
        canManageBilling: true,
      }),
    ).toEqual({ kind: "portal", label: "Change to Pro" });
  });

  it("renders trialing state as full access with its trial end date", () => {
    expect(
      deriveBillingView(
        {
          status: "trialing",
          plan: "growth",
          trial_end: "2026-06-25T12:00:00.000Z",
          stripe_subscription_id: "trial_local",
        },
        { account: "active" },
      ),
    ).toMatchObject({
      currentPlan: "growth",
      accessStateLabel: "Full",
      isTrialing: true,
      trialEnd: "2026-06-25T12:00:00.000Z",
      showActiveAccountNotice: true,
      showUpgradeNotice: false,
      usePortalForPlanChanges: false,
    });
  });

  it("keeps past_due access during grace and directs plan actions to Billing Portal", () => {
    const view = deriveBillingView({
      status: "past_due",
      plan: "growth",
      stripe_customer_id: "cus_past_due",
      stripe_subscription_id: "sub_past_due",
    });

    expect(view).toMatchObject({
      accessStateLabel: "Full",
      showPastDueNotice: true,
      usePortalForPlanChanges: true,
    });
    expect(
      getBillingPlanAction({
        plan: "growth",
        currentPlan: "growth",
        subscriptionStatus: "past_due",
        usePortalForPlanChanges: true,
        canManageBilling: true,
      }),
    ).toEqual({ kind: "portal", label: "Change to Growth" });
  });

  it("keeps Basic checkout available and formats period-end dates", () => {
    expect(
      getBillingPlanAction({
        plan: "growth",
        currentPlan: "basic",
        subscriptionStatus: "canceled",
        usePortalForPlanChanges: false,
        canManageBilling: true,
      }),
    ).toEqual({ kind: "checkout", label: "Upgrade to Growth" });
    expect(formatBillingDate("2026-07-01T12:00:00.000Z")).toContain(
      "1 Jul 2026",
    );
  });

  it("maps active_subscription_exists to an actionable Manage billing message", () => {
    expect(getCheckoutErrorMessage("active_subscription_exists")).toBe(
      "You already have a Stripe subscription. Open Manage billing to change plan, update payment details, or cancel.",
    );
  });
});
