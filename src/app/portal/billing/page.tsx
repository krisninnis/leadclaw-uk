import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ManageBillingButton from "@/components/manage-billing-button";
import PortalPlanUpgrade from "@/components/portal-plan-upgrade";
import { Badge, SectionHeading, StatCard } from "@/components/ui";
import {
  deriveBillingView,
  formatBillingDate,
  type BillingSubscriptionRow,
} from "@/lib/billing-view";

type PortalSubscriptionRow = BillingSubscriptionRow & {
  user_id: string | null;
  email: string | null;
};

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
  const admin = createAdminClient();
  let subscription: PortalSubscriptionRow | null = null;

  if (admin) {
    const normalizedEmail = user.email?.trim().toLowerCase() || "";
    const filters = [`user_id.eq.${user.id}`];
    if (normalizedEmail) filters.push(`email.eq.${normalizedEmail}`);

    const { data } = await (admin as unknown as SupabaseUntypedClient)
      .from("subscriptions")
      .select(
        "user_id,email,status,plan,trial_end,current_period_end,stripe_customer_id,stripe_subscription_id",
      )
      .or(filters.join(","))
      .order("updated_at", { ascending: false })
      .limit(10);

    const rows = (data || []) as PortalSubscriptionRow[];
    subscription =
      rows.find((row) => row.user_id === user.id) ||
      rows.find(
        (row) => row.email?.trim().toLowerCase() === normalizedEmail,
      ) ||
      null;
  }

  const billing = deriveBillingView(subscription, {
    account: params.account,
    expired: params.expired,
  });
  const {
    status: rawSubscriptionStatus,
    currentPlan,
    planLabel,
    trialEnd,
    currentPeriodEnd,
    hasFullAccess: hasFullSubscriptionAccess,
    hasBasicAccess,
    accessStateLabel,
    isTrialing,
    trialEnded: trialEndedIntoBasic,
    showTrialEndedNotice,
    showPastDueNotice: showPastDueBox,
    showUpgradeNotice: showUpgradeBox,
    showActiveAccountNotice,
    canManageBilling,
    usePortalForPlanChanges,
  } = billing;
  const currentPlanTone = getPlanTone(currentPlan);

  const trialStatusLabel = isTrialing
    ? "Active"
    : trialEndedIntoBasic
      ? "Ended"
      : "Not in trial";

  return (
    <div className="space-y-6">
      {showActiveAccountNotice && (
        <div className="rounded-[24px] border border-sky-200 bg-sky-50 p-5">
          <h2 className="text-lg font-semibold text-sky-950">
            You already have an active LeadClaw account
          </h2>
          <p className="mt-2 text-sm leading-7 text-sky-900">
            Continue using your workspace here, or manage billing below if you
            want to change plan.
          </p>
        </div>
      )}

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
          description="Review your current plan, trial state, billing status, and the next best option for your workspace."
          maxWidth="lg"
        />

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Current plan"
            value={planLabel}
            hint={
              hasFullSubscriptionAccess
                ? "Your workspace currently has full LeadClaw access."
                : hasBasicAccess
                  ? "Your workspace is currently on the free Basic plan."
                  : "Your account does not currently have product access."
            }
          />

          <StatCard
            label="Trial status"
            value={trialStatusLabel}
            hint={
              trialEnd
                ? `Trial date: ${formatBillingDate(trialEnd)}`
                : "No trial date on file."
            }
          />

          <StatCard
            label="Renewal / period end"
            value={formatBillingDate(currentPeriodEnd)}
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

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={currentPlanTone}>{planLabel}</Badge>

            {isTrialing && (
              <Badge tone="brand">
                Trial
                {trialEnd ? ` • ends ${formatBillingDate(trialEnd)}` : ""}
              </Badge>
            )}

            {trialEndedIntoBasic && <Badge tone="amber">Basic active</Badge>}
          </div>

          {canManageBilling && <ManageBillingButton />}
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
                ? "Your workspace can continue using widget, portal, and paid automation features."
                : hasBasicAccess
                  ? "Your workspace keeps the free Basic widget, while Growth and Pro unlock the paid automation features."
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
                ? `Trial ends ${formatBillingDate(trialEnd)}`
                : currentPeriodEnd
                  ? `${hasFullSubscriptionAccess ? "Current period ends" : "Previous period ended"} ${formatBillingDate(currentPeriodEnd)}`
                  : trialEndedIntoBasic
                    ? "Your account has automatically moved to Basic after trial expiry."
                    : "No billing date is currently available."}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <PortalPlanUpgrade
            email={user.email}
            currentPlan={currentPlan}
            subscriptionStatus={rawSubscriptionStatus}
            usePortalForPlanChanges={usePortalForPlanChanges}
            canManageBilling={canManageBilling}
          />
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
          {canManageBilling && (
            <div className="mt-4">
              <ManageBillingButton label="Fix payment in Manage billing" />
            </div>
          )}
        </div>
      )}

      {showUpgradeBox && !showPastDueBox && (
        <div className="rounded-[24px] border border-sky-200 bg-sky-50 p-5">
          <h2 className="text-lg font-semibold text-sky-950">
            Upgrade when you’re ready
          </h2>
          <p className="mt-2 text-sm leading-7 text-sky-900">
            Your workspace is currently on Basic. Keep the free widget, move to
            Growth for full automation, or upgrade to Pro for more advanced
            support and performance features.
          </p>
        </div>
      )}
    </div>
  );
}
