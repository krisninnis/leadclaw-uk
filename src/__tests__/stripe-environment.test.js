const {
  getStripeKeyMode,
  getDeploymentEnv,
  evaluateStripeEnvironment,
} = require("@/lib/stripe-environment");

describe("stripe environment", () => {
  test("live key in preview is blocked", () => {
    const result = evaluateStripeEnvironment({
      VERCEL_ENV: "preview",
      STRIPE_SECRET_KEY: "sk_live_test",
    });

    expect(result.blocked).toBe(true);
  });

  test("test key in preview is allowed", () => {
    const result = evaluateStripeEnvironment({
      VERCEL_ENV: "preview",
      STRIPE_SECRET_KEY: "sk_test_test",
    });

    expect(result.blocked).toBe(false);
  });

  test("deployment detection works", () => {
    expect(
      getDeploymentEnv({ VERCEL_ENV: "preview" }),
    ).toBe("preview");
  });

  test("key detection works", () => {
    expect(
      getStripeKeyMode("sk_live_123"),
    ).toBe("live");
  });
});
