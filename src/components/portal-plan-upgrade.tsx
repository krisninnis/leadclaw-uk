"use client";

import { useState } from "react";
import {
  PLAN_DISPLAY_NAMES,
  PLAN_MONTHLY_PRICES,
  type PaidPlanSlug,
  type PlanSlug,
} from "@/lib/plans";
import ManageBillingButton from "@/components/manage-billing-button";
import {
  getBillingPlanAction,
  getCheckoutErrorMessage,
} from "@/lib/billing-view";

const upgradePlans: Array<{
  slug: PaidPlanSlug;
  summary: string;
}> = [
  {
    slug: "growth",
    summary: "Full lead capture, follow-up automation, and workspace features.",
  },
  {
    slug: "pro",
    summary: "Advanced automation, stronger reporting, and priority support.",
  },
];

export default function PortalPlanUpgrade({
  email,
  currentPlan = "basic",
  subscriptionStatus = "none",
  usePortalForPlanChanges = false,
  canManageBilling = false,
}: {
  email?: string | null;
  currentPlan?: PlanSlug;
  subscriptionStatus?: string | null;
  usePortalForPlanChanges?: boolean;
  canManageBilling?: boolean;
}) {
  const earlyAccessMode =
    process.env["NEXT_PUBLIC_EARLY_ACCESS_MODE"] === "true";
  const [earlyAccessStatus, setEarlyAccessStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [loadingPlan, setLoadingPlan] = useState<PaidPlanSlug | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState("");
  const [portalSuggested, setPortalSuggested] = useState(false);

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
          getCheckoutErrorMessage(
            data?.error || "checkout_failed",
            data?.requiredEnvVar,
          ),
        );
        setPortalSuggested(Boolean(data?.usePortal));
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
          const action = getBillingPlanAction({
            plan: plan.slug,
            currentPlan,
            subscriptionStatus,
            usePortalForPlanChanges,
            canManageBilling,
          });

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
              {action.kind === "portal" ? (
                <div className="mt-5">
                  <ManageBillingButton
                    label={action.label}
                    className="button-primary"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    action.kind === "checkout"
                      ? startCheckout(plan.slug)
                      : undefined
                  }
                  disabled={
                    Boolean(loadingPlan) || action.kind !== "checkout"
                  }
                  className="button-primary mt-5"
                >
                  {isLoading ? "Opening checkout..." : action.label}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {checkoutStatus ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">{checkoutStatus}</p>
          {portalSuggested && canManageBilling ? <ManageBillingButton /> : null}
        </div>
      ) : null}
    </div>
  );
}
