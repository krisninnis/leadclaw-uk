import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import PortalPlanUpgrade from "@/components/portal-plan-upgrade";
import { Badge, SectionHeading, StatCard } from "@/components/ui";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function normalizePlan(value: string | null | undefined) {
  return String(value || "basic").toLowerCase();
}

function getPlanTone(
  planValue: string,
): "brand" | "amber" | "violet" | "cyan" | "neutral" {
  const lower = planValue.toLowerCase();
  if (lower.includes("basic")) return "amber";
  if (lower.includes("growth")) return "violet";
  if (lower.includes("pro")) return "cyan";
  return "neutral";
}

export default async function PortalBillingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const params = (await searchParams) || {};
  const expired = params.expired === "1";

  const admin = createAdminClient();

  let rawSubscriptionStatus = "none";
  let currentPlan = "basic";
  let trialEnd: string | null = null;
  let currentPeriodEnd: string | null = null;

  let hasFullSubscriptionAccess = false;
  let hasBasicAccess = true;
  let isTrialing = false;
  let isTrialExpired = false;
  let trialEndedIntoBasic = false;

  if (admin) {
    const { data } = await admin
      .from("subscriptions")
      .select("status,plan,trial_end,current_period_end")
      .eq("email", user.email || "")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      rawSubscriptionStatus = String(data.status || "").toLowerCase();
      currentPlan = normalizePlan(data.plan);
      trialEnd = data.trial_end || null;
      currentPeriodEnd = data.current_period_end || null;

      isTrialing = rawSubscriptionStatus === "trialing";
      isTrialExpired =
        rawSubscriptionStatus === "expired" ||
        rawSubscriptionStatus === "canceled";

      hasFullSubscriptionAccess = ["trialing", "active", "past_due"].includes(
        rawSubscriptionStatus,
      );

      hasBasicAccess = currentPlan === "basic" || hasFullSubscriptionAccess;

      trialEndedIntoBasic =
        currentPlan === "basic" &&
        (rawSubscriptionStatus === "expired" ||
          rawSubscriptionStatus === "canceled");
    }
  }

  const currentPlanTone = getPlanTone(currentPlan);

  const planLabel =
    currentPlan === "basic"
      ? "Basic"
      : currentPlan === "growth"
        ? "Growth"
        : currentPlan === "pro"
          ? "Pro"
          : "Basic";

  const accessStateLabel = hasFullSubscriptionAccess
    ? "Full"
    : hasBasicAccess
      ? "Basic"
      : "Blocked";

  const trialStatusLabel = isTrialing
    ? "Active"
    : trialEndedIntoBasic || expired || isTrialExpired
      ? "Ended"
      : "Not in trial";

  const showTrialEndedNotice = trialEndedIntoBasic || expired;
  const showPastDueBox = rawSubscriptionStatus === "past_due";
  const showUpgradeBox = hasBasicAccess && !hasFullSubscriptionAccess;

  return (
    <div className="space-y-6">
      {showTrialEndedNotice && (
        <div className="rounded-[24px] border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-lg font-semibold text-amber-950">
            Your free trial has ended
          </h2>
          <p className="mt-2 text-sm leading-7 text-amber-900">
            Your 7-day Growth trial has ended and your account is now on the
            free Basic plan. Your widget can stay live, while Growth and Pro
            continue to unlock full automation features.
          </p>
        </div>
      )}

      <div className="card-premium p-6 md:p-8">
        <SectionHeading
          eyebrow="Billing"
          title="Manage your subscription"
          description="Review your current plan, trial state, billing status, and the next best option for your clinic."
          maxWidth="lg"
        />

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Current plan"
            value={planLabel}
            hint={
              hasFullSubscriptionAccess
                ? "Your clinic currently has full LeadClaw access."
                : hasBasicAccess
                  ? "Your clinic is currently on the free Basic plan."
                  : "Your account does not currently have product access."
            }
          />

          <StatCard
            label="Trial status"
            value={trialStatusLabel}
            hint={
              trialEnd
                ? `Trial date: ${formatDateTime(trialEnd)}`
                : "No trial date on file."
            }
          />

          <StatCard
            label="Renewal / period end"
            value={formatDateTime(currentPeriodEnd)}
            hint="Shown when available from your latest subscription record."
          />

          <StatCard
            label="Access state"
            value={accessStateLabel}
            hint={
              hasFullSubscriptionAccess
                ? "Portal, widget, and paid automation features are available."
                : hasBasicAccess
                  ? "Widget and Basic access are available. Paid automation features are locked."
                  : "No product access is currently available."
            }
          />
        </div>
      </div>

      <div className="card-premium p-6 md:p-8">
        <SectionHeading
          eyebrow="Current plan"
          title="Subscription overview"
          description="Your current LeadClaw setup and available package options."
          maxWidth="md"
        />

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Badge tone={currentPlanTone}>{planLabel}</Badge>

          {isTrialing && (
            <Badge tone="brand">
              Trial
              {trialEnd ? ` • ends ${formatDateTime(trialEnd)}` : ""}
            </Badge>
          )}

          {trialEndedIntoBasic && <Badge tone="amber">Basic active</Badge>}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-[22px] border border-border bg-white p-5">
            <p className="text-sm font-medium text-muted">Package access</p>
            <p className="mt-2 text-base font-semibold text-foreground">
              {hasFullSubscriptionAccess
                ? "Full LeadClaw access"
                : hasBasicAccess
                  ? "Basic widget access"
                  : "Access unavailable"}
            </p>
            <p className="mt-2 text-sm text-muted">
              {hasFullSubscriptionAccess
                ? "Your clinic can continue using widget, portal, and paid automation features."
                : hasBasicAccess
                  ? "Your clinic keeps the free Basic widget, while Growth and Pro unlock the paid automation features."
                  : "Choose a plan to restore product access."}
            </p>
          </div>

          <div className="rounded-[22px] border border-border bg-white p-5">
            <p className="text-sm font-medium text-muted">Plan timing</p>
            <p className="mt-2 text-base font-semibold text-foreground">
              {isTrialing
                ? "Trial period"
                : currentPeriodEnd
                  ? "Billing cycle active"
                  : trialEndedIntoBasic
                    ? "Basic plan active"
                    : "Timing unavailable"}
            </p>
            <p className="mt-2 text-sm text-muted">
              {isTrialing && trialEnd
                ? `Trial ends ${formatDateTime(trialEnd)}`
                : currentPeriodEnd
                  ? `Current period ends ${formatDateTime(currentPeriodEnd)}`
                  : trialEndedIntoBasic
                    ? "Your account has automatically moved to Basic after trial expiry."
                    : "No billing date is currently available."}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <PortalPlanUpgrade email={user.email} />
        </div>
      </div>

      {showPastDueBox && (
        <div className="rounded-[24px] border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-lg font-semibold text-amber-950">
            Payment issue detected
          </h2>
          <p className="mt-2 text-sm leading-7 text-amber-900">
            Your paid package is still accessible right now, but there is a
            billing issue that needs attention to avoid interruption. You can
            also remain on Basic if you do not want to continue with a paid
            plan.
          </p>
          <div className="mt-4">
            <PortalPlanUpgrade email={user.email} />
          </div>
        </div>
      )}

      {showUpgradeBox && !showPastDueBox && (
        <div className="rounded-[24px] border border-sky-200 bg-sky-50 p-5">
          <h2 className="text-lg font-semibold text-sky-950">
            Upgrade when you’re ready
          </h2>
          <p className="mt-2 text-sm leading-7 text-sky-900">
            Your clinic is currently on Basic. Keep the free widget, move to
            Growth for full automation, or upgrade to Pro for more advanced
            support and performance features.
          </p>
          <div className="mt-4">
            <PortalPlanUpgrade email={user.email} />
          </div>
        </div>
      )}
    </div>
  );
}
