"use client";

import { useState } from "react";
import {
  PLAN_DISPLAY_NAMES,
  PLAN_MONTHLY_PRICES,
  type PaidPlanSlug,
} from "@/lib/plans";

const upgradePlans: Array<{
  slug: PaidPlanSlug;
  summary: string;
  cta: string;
}> = [
  {
    slug: "growth",
    summary: "Full lead capture, follow-up automation, and workspace features.",
    cta: "Upgrade to Growth",
  },
  {
    slug: "pro",
    summary: "Advanced automation, stronger reporting, and priority support.",
    cta: "Upgrade to Pro",
  },
];

function checkoutErrorMessage(error: string, requiredEnvVar?: string) {
  if (error === "missing_price_id" && requiredEnvVar) {
    return `${requiredEnvVar} is not configured yet. Please contact support to upgrade.`;
  }

  if (error === "already_on_requested_plan") {
    return "You are already on that plan.";
  }

  if (error === "active_subscription_exists") {
    return "You already have an active subscription. Use Manage billing to change or cancel your plan.";
  }

  if (error === "stripe_not_configured") {
    return "Stripe checkout is not configured yet. Please contact support to upgrade.";
  }

  return "Could not start checkout right now. Please try again or contact support.";
}

export default function PortalPlanUpgrade({
  email,
}: {
  email?: string | null;
}) {
  const earlyAccessMode =
    process.env["NEXT_PUBLIC_EARLY_ACCESS_MODE"] === "true";
  const [earlyAccessStatus, setEarlyAccessStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [loadingPlan, setLoadingPlan] = useState<PaidPlanSlug | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState("");

  async function handleEarlyAccess() {
    if (!email) return;
    setEarlyAccessStatus("loading");
    try {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          plan: "growth",
          source: "portal_upgrade",
        }),
      });
      setEarlyAccessStatus(res.ok ? "done" : "error");
    } catch {
      setEarlyAccessStatus("error");
    }
  }

  async function startCheckout(plan: PaidPlanSlug) {
    setLoadingPlan(plan);
    setCheckoutStatus("");

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, email }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok || !data?.url) {
        setCheckoutStatus(
          checkoutErrorMessage(
            data?.error || "checkout_failed",
            data?.requiredEnvVar,
          ),
        );
        setLoadingPlan(null);
        return;
      }

      window.location.assign(data.url);
    } catch {
      setCheckoutStatus(
        "Could not start checkout right now. Please try again or contact support.",
      );
      setLoadingPlan(null);
    }
  }

  if (earlyAccessMode) {
    return (
      <div className="space-y-3">
        {earlyAccessStatus === "done" ? (
          <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">You are on the early access list</p>
            <p className="mt-1">We will email you within 24 hours.</p>
          </div>
        ) : (
          <button
            onClick={handleEarlyAccess}
            disabled={earlyAccessStatus === "loading"}
            className="button-primary"
          >
            {earlyAccessStatus === "loading"
              ? "Saving..."
              : "Join early access - Growth"}
          </button>
        )}
        <p className="text-xs text-muted">
          Paid plans launch soon. Founding workspaces get priority access and
          locked-in pricing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {upgradePlans.map((plan) => {
          const isLoading = loadingPlan === plan.slug;

          return (
            <div
              key={plan.slug}
              className="rounded-[22px] border border-border bg-white p-5"
            >
              <p className="text-sm font-semibold text-foreground">
                {PLAN_DISPLAY_NAMES[plan.slug]}
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {PLAN_MONTHLY_PRICES[plan.slug].displayMonthly}
              </p>
              <p className="mt-3 text-sm leading-7 text-muted">
                {plan.summary}
              </p>
              <button
                type="button"
                onClick={() => startCheckout(plan.slug)}
                disabled={Boolean(loadingPlan)}
                className="button-primary mt-5"
              >
                {isLoading ? "Opening checkout..." : plan.cta}
              </button>
            </div>
          );
        })}
      </div>

      {checkoutStatus ? (
        <p className="text-sm text-muted">{checkoutStatus}</p>
      ) : null}
    </div>
  );
}
