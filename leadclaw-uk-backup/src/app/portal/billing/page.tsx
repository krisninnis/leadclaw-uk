import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import PortalPlanUpgrade from "@/components/portal-plan-upgrade";
import { Badge, SectionHeading, StatCard } from "@/components/ui";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function getPlanTone(
  subscriptionText: string,
): "brand" | "amber" | "violet" | "cyan" | "neutral" {
  const lower = subscriptionText.toLowerCase();
  if (lower.includes("starter")) return "amber";
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

  let subStatus = "No active subscription found";
  let rawSubscriptionStatus = "none";
  let trialEnd: string | null = null;
  let currentPeriodEnd: string | null = null;
  let hasActiveSubscription = false;
  let isTrialing = false;
  let isTrialExpired = false;

  if (admin) {
    const { data } = await admin
      .from("subscriptions")
      .select("status,plan,trial_end,current_period_end")
      .eq("email", user.email || "")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.status) {
      rawSubscriptionStatus = String(data.status).toLowerCase();

      const planLabel = data.plan
        ? `${String(data.plan).toUpperCase()} • `
        : "";

      subStatus = `${planLabel}${data.status}`;
      trialEnd = data.trial_end || null;
      currentPeriodEnd = data.current_period_end || null;

      isTrialing = rawSubscriptionStatus === "trialing";
      isTrialExpired =
        rawSubscriptionStatus === "expired" ||
        rawSubscriptionStatus === "canceled";

      hasActiveSubscription = ["trialing", "active", "past_due"].includes(
        rawSubscriptionStatus,
      );
    }
  }

  const currentPlanTone = getPlanTone(subStatus);
  const showTrialExpiredBox = isTrialExpired || expired;
  const showUpgradeBox =
    !hasActiveSubscription || rawSubscriptionStatus === "past_due";

  return (
    <div className="space-y-6">
      {expired && (
        <div className="rounded-[24px] border border-rose-300 bg-rose-50 p-5">
          <h2 className="text-lg font-semibold text-rose-950">
            Your free trial has ended
          </h2>
          <p className="mt-2 text-sm leading-7 text-rose-900">
            To continue capturing leads, using your website widget, and keeping
            your clinic workspace live, activate a paid package below.
          </p>
        </div>
      )}

      <div className="card-premium p-6 md:p-8">
        <SectionHeading
          eyebrow="Billing"
          title="Manage your subscription"
          description="Review your current plan, trial state, billing status, and next steps for keeping LeadClaw active."
          maxWidth="lg"
        />

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Subscription"
            value={subStatus}
            hint={
              isTrialing && trialEnd
                ? `Trial ends ${formatDateTime(trialEnd)}`
                : hasActiveSubscription
                  ? "Your package is currently usable."
                  : "No active paid access right now."
            }
          />

          <StatCard
            label="Trial status"
            value={
              isTrialing
                ? "Active"
                : showTrialExpiredBox
                  ? "Ended"
                  : "Not in trial"
            }
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
            value={hasActiveSubscription ? "Unlocked" : "Limited"}
            hint={
              hasActiveSubscription
                ? "Portal and widget usage are currently available."
                : "Upgrade to restore full access."
            }
          />
        </div>
      </div>

      <div className="card-premium p-6 md:p-8">
        <SectionHeading
          eyebrow="Current plan"
          title="Subscription overview"
          description="Your current LeadClaw setup and billing state."
          maxWidth="md"
        />

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Badge tone={currentPlanTone}>{subStatus}</Badge>

          {isTrialing && !showTrialExpiredBox && (
            <Badge tone="brand">
              Trial
              {trialEnd ? ` • ends ${formatDateTime(trialEnd)}` : ""}
            </Badge>
          )}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-[22px] border border-border bg-white p-5">
            <p className="text-sm font-medium text-muted">Billing access</p>
            <p className="mt-2 text-base font-semibold text-foreground">
              {hasActiveSubscription
                ? "LeadClaw is available"
                : "LeadClaw requires upgrade"}
            </p>
            <p className="mt-2 text-sm text-muted">
              {hasActiveSubscription
                ? "Your clinic can continue using portal and widget features."
                : "Activate a paid package to restore or continue full portal and widget access."}
            </p>
          </div>

          <div className="rounded-[22px] border border-border bg-white p-5">
            <p className="text-sm font-medium text-muted">Plan timing</p>
            <p className="mt-2 text-base font-semibold text-foreground">
              {isTrialing
                ? "Trial period"
                : currentPeriodEnd
                  ? "Billing cycle active"
                  : "Timing unavailable"}
            </p>
            <p className="mt-2 text-sm text-muted">
              {isTrialing && trialEnd
                ? `Trial ends ${formatDateTime(trialEnd)}`
                : currentPeriodEnd
                  ? `Current period ends ${formatDateTime(currentPeriodEnd)}`
                  : "No billing date is currently available."}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <PortalPlanUpgrade email={user.email} />
        </div>
      </div>

      {rawSubscriptionStatus === "past_due" && (
        <div className="rounded-[24px] border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-lg font-semibold text-amber-950">
            Payment issue detected
          </h2>
          <p className="mt-2 text-sm leading-7 text-amber-900">
            Your package is still accessible right now, but there is a billing
            issue that needs attention to avoid interruption.
          </p>
          <div className="mt-4">
            <PortalPlanUpgrade email={user.email} />
          </div>
        </div>
      )}

      {showTrialExpiredBox && (
        <div className="rounded-[24px] border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-lg font-semibold text-amber-950">
            Your trial has ended
          </h2>
          <p className="mt-2 text-sm leading-7 text-amber-900">
            {trialEnd
              ? `Your free trial ended on ${formatDateTime(trialEnd)}.`
              : "Your free trial has ended."}{" "}
            Upgrade now to keep your widget live, continue receiving enquiries,
            and keep portal access fully unlocked.
          </p>
          <div className="mt-4">
            <PortalPlanUpgrade email={user.email} />
          </div>
        </div>
      )}

      {showUpgradeBox &&
        !showTrialExpiredBox &&
        rawSubscriptionStatus !== "past_due" &&
        user.email && (
          <div className="rounded-[24px] border border-sky-200 bg-sky-50 p-5">
            <h2 className="text-lg font-semibold text-sky-950">
              Upgrade or reactivate your package
            </h2>
            <p className="mt-2 text-sm leading-7 text-sky-900">
              Choose a plan to restore or continue access to the widget, lead
              inbox, install tools, and clinic workspace.
            </p>
            <div className="mt-4">
              <PortalPlanUpgrade email={user.email} />
            </div>
          </div>
        )}
    </div>
  );
}
