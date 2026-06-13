const {
  buildTrialRedirectSubscriptionPatch,
  decideTrialGate,
} = require("@/lib/trial-subscription-gate");

const NOW = new Date("2026-06-13T12:00:00.000Z");

function subscription(overrides = {}) {
  return {
    id: "sub-row-1",
    user_id: "user_123",
    email: "owner@example.com",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_price_id: null,
    plan: "growth",
    status: "basic",
    trial_end: null,
    current_period_end: null,
    cancel_at_period_end: false,
    updated_at: "2026-06-01T12:00:00.000Z",
    ...overrides,
  };
}

function decide(rows, requestedPlan = "growth") {
  return decideTrialGate({
    rows,
    userId: "user_123",
    email: "owner@example.com",
    requestedPlan,
    now: NOW,
  });
}

describe("trial subscription gate", () => {
  it("allows a new Google user to start a Growth trial", () => {
    expect(decide([])).toMatchObject({
      action: "start_trial",
      reason: "new_user",
      selectedPlan: "growth",
    });
  });

  it("allows a new Google user to start a Pro trial", () => {
    expect(decide([], "pro")).toMatchObject({
      action: "start_trial",
      reason: "new_user",
      selectedPlan: "pro",
    });
  });

  it("redirects an existing active trial to the portal", () => {
    const decision = decide([
      subscription({
        status: "trialing",
        trial_end: "2026-06-20T12:00:00.000Z",
      }),
    ]);

    expect(decision).toMatchObject({
      action: "redirect",
      code: "trial_already_active",
      redirectTo: "/portal?trial=active&plan=growth",
      trialEnd: "2026-06-20T12:00:00.000Z",
    });
  });

  it("redirects an existing active paid subscription to billing", () => {
    const decision = decide([
      subscription({
        status: "active",
        stripe_customer_id: "cus_test123",
        stripe_subscription_id: "sub_test123",
      }),
    ]);

    expect(decision).toMatchObject({
      action: "redirect",
      code: "active_subscription_exists",
      redirectTo: "/portal/billing?account=active&plan=growth",
    });
  });

  it("does not treat an ended trial as an active subscription", () => {
    const decision = decide([
      subscription({
        status: "canceled",
        trial_end: "2026-06-01T12:00:00.000Z",
      }),
    ]);

    expect(decision).toMatchObject({
      action: "redirect",
      code: "trial_already_used",
      redirectTo: "/portal/billing?expired=1&plan=growth",
    });
  });

  it("allows a deleted-account stale row with no trial history to re-enter trial signup", () => {
    const decision = decide([
      subscription({
        user_id: null,
        status: "canceled",
        trial_end: null,
      }),
    ]);

    expect(decision).toMatchObject({
      action: "start_trial",
      reason: "inactive_subscription",
      selectedPlan: "growth",
    });
  });

  it("downgrades a stale ended trial row to limited billing access", () => {
    const decision = decide([
      subscription({
        status: "trialing",
        trial_end: "2026-06-01T12:00:00.000Z",
      }),
    ]);

    const patch = buildTrialRedirectSubscriptionPatch({
      decision,
      userId: "user_123",
      email: "owner@example.com",
      now: NOW,
    });

    expect(patch).toMatchObject({
      id: "sub-row-1",
      values: {
        status: "expired",
        plan: "basic",
        current_period_end: null,
        cancel_at_period_end: true,
      },
    });
  });
});
