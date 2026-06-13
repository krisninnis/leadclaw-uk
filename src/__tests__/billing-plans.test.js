const fs = require("fs");
const path = require("path");

function walkFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next"].includes(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("LeadClaw billing plans", () => {
  it("uses customer-facing plan names and pound pricing labels", () => {
    const { PLAN_DISPLAY_NAMES, PLAN_MONTHLY_PRICES } = require("@/lib/plans");
    const { plans } = require("@/app/pricing/pricing-data");

    expect(PLAN_DISPLAY_NAMES).toEqual({
      basic: "Basic",
      growth: "Growth",
      pro: "Pro",
    });

    expect(PLAN_MONTHLY_PRICES.basic.displayMonthly).toBe("£0/month");
    expect(PLAN_MONTHLY_PRICES.growth.displayMonthly).toBe("£79/month");
    expect(PLAN_MONTHLY_PRICES.pro.displayMonthly).toBe("£149/month");

    expect(plans.map((plan) => [plan.name, plan.price])).toEqual([
      ["Basic", "Free"],
      ["Growth", "£79"],
      ["Pro", "£149"],
    ]);

    expect(JSON.stringify(plans)).not.toContain("GBP 79");
    expect(JSON.stringify(plans)).not.toContain("GBP 149");
    expect(JSON.stringify(plans)).not.toContain("Starter");
  });

  it("normalizes legacy starter to Basic and preserves Pro trials", () => {
    const { normalizePlan, normalizeTrialPlan } = require("@/lib/plans");

    expect(normalizePlan("starter")).toBe("basic");
    expect(normalizePlan("basic")).toBe("basic");
    expect(normalizeTrialPlan("growth")).toBe("growth");
    expect(normalizeTrialPlan("pro")).toBe("pro");
    expect(normalizeTrialPlan("unknown")).toBe("growth");
  });

  it("resolves checkout only for paid plans with configured Stripe price IDs", () => {
    const { resolveCheckoutPlan } = require("@/lib/checkout-plans");

    const env = {
      STRIPE_PRICE_GROWTH: "price_growth_79",
      STRIPE_PRICE_PRO: "price_pro_149",
    };

    expect(resolveCheckoutPlan("basic", env)).toEqual({
      ok: false,
      error: "basic_plan_does_not_require_checkout",
    });
    expect(resolveCheckoutPlan("growth", env)).toEqual({
      ok: true,
      plan: "growth",
      priceId: "price_growth_79",
    });
    expect(resolveCheckoutPlan("pro", env)).toEqual({
      ok: true,
      plan: "pro",
      priceId: "price_pro_149",
    });
    expect(resolveCheckoutPlan("pro", { STRIPE_PRICE_GROWTH: "price_growth_79" })).toEqual({
      ok: false,
      error: "missing_price_id",
      requiredEnvVar: "STRIPE_PRICE_PRO",
    });
  });

  it("maps Stripe webhook price IDs back to Growth and Pro", () => {
    const { planFromStripePriceId } = require("@/lib/stripe-plans");

    const env = {
      STRIPE_PRICE_GROWTH: "price_growth_79",
      STRIPE_PRICE_PRO: "price_pro_149",
    };

    expect(planFromStripePriceId("price_growth_79", env)).toBe("growth");
    expect(planFromStripePriceId("price_pro_149", env)).toBe("pro");
    expect(planFromStripePriceId("price_unknown", env)).toBeNull();
    expect(planFromStripePriceId("", env)).toBeNull();
  });

  it("documents required Stripe rotation env vars", () => {
    const envExample = fs.readFileSync(
      path.join(process.cwd(), ".env.example"),
      "utf8",
    );

    expect(envExample).toContain("STRIPE_SECRET_KEY=");
    expect(envExample).toContain("STRIPE_WEBHOOK_SECRET=");
    expect(envExample).toContain("STRIPE_PRICE_GROWTH=");
    expect(envExample).toContain("STRIPE_PRICE_PRO=");
    expect(envExample).toContain("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=");
  });

  it("keeps server-only Stripe env vars out of client-marked files", () => {
    const clientFiles = walkFiles(path.join(process.cwd(), "src")).filter(
      (file) => {
        const contents = fs.readFileSync(file, "utf8");
        return contents.startsWith('"use client"') || contents.startsWith("'use client'");
      },
    );

    const serverOnlyEnvNames = [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_PRICE_GROWTH",
      "STRIPE_PRICE_PRO",
    ];

    for (const file of clientFiles) {
      const contents = fs.readFileSync(file, "utf8");
      for (const envName of serverOnlyEnvNames) {
        expect(contents).not.toContain(envName);
      }
    }
  });
});
