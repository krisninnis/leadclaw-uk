import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import LogoutButton from "@/components/logout-button";
import PortalPlanUpgrade from "@/components/portal-plan-upgrade";
import PortalChat from "@/components/portal-chat";
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

export default async function PortalPage({
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
  const trialStarted = params.trial === "started";
  const checkoutSuccess = params.checkout === "success";
  const setupReady = params.setup === "ready";

  const admin = createAdminClient();

  let subStatus = "No active subscription found";
  let rawSubscriptionStatus = "none";
  let trialEnd: string | null = null;
  let currentPeriodEnd: string | null = null;
  let hasActiveSubscription = false;
  let isTrialing = false;
  let isTrialExpired = false;

  let domain: string | null = null;
  let widgetLastSeenAt: string | null = null;
  let leadsThisWeek = 0;
  let totalLeads = 0;
  let lastLeadReceived: string | null = null;
  let newLeadsCount = 0;
  let bookedLeadsCount = 0;
  let recentEnquiries: Array<{
    id: string;
    name: string | null;
    created_at: string | null;
    status: string | null;
  }> = [];

  if (admin) {
    const { data: subscription } = await admin
      .from("subscriptions")
      .select("status,plan,trial_end,current_period_end")
      .eq("email", user.email || "")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscription?.status) {
      rawSubscriptionStatus = String(subscription.status).toLowerCase();

      const planLabel = subscription.plan
        ? `${String(subscription.plan).toUpperCase()} • `
        : "";

      subStatus = `${planLabel}${subscription.status}`;
      trialEnd = subscription.trial_end || null;
      currentPeriodEnd = subscription.current_period_end || null;

      isTrialing = rawSubscriptionStatus === "trialing";
      isTrialExpired =
        rawSubscriptionStatus === "expired" ||
        rawSubscriptionStatus === "canceled";

      hasActiveSubscription = ["trialing", "active", "past_due"].includes(
        rawSubscriptionStatus,
      );
    }

    if (user.email) {
      const { data: client } = await admin
        .from("onboarding_clients")
        .select("id")
        .eq("contact_email", user.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (client?.id) {
        const { data: site } = await admin
          .from("onboarding_sites")
          .select("id,domain,clinic_id")
          .eq("onboarding_client_id", client.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        domain = site?.domain || null;

        if (site?.id) {
          const { data: tokenRow } = await admin
            .from("widget_tokens")
            .select("last_seen_at")
            .eq("onboarding_site_id", site.id)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          widgetLastSeenAt = tokenRow?.last_seen_at || null;
        }

        if (site?.clinic_id && hasActiveSubscription) {
          const { data: enquiryRows } = await admin
            .from("enquiries")
            .select("id,name,status,created_at")
            .eq("clinic_id", site.clinic_id)
            .order("created_at", { ascending: false })
            .limit(5);

          recentEnquiries =
            (enquiryRows as Array<{
              id: string;
              name: string | null;
              created_at: string | null;
              status: string | null;
            }> | null) || [];

          lastLeadReceived = recentEnquiries[0]?.created_at || null;

          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

          const [
            { count: weeklyCount },
            { count: totalCount },
            { data: allRows },
          ] = await Promise.all([
            admin
              .from("enquiries")
              .select("*", { count: "exact", head: true })
              .eq("clinic_id", site.clinic_id)
              .gte("created_at", sevenDaysAgo.toISOString()),
            admin
              .from("enquiries")
              .select("*", { count: "exact", head: true })
              .eq("clinic_id", site.clinic_id),
            admin
              .from("enquiries")
              .select("status")
              .eq("clinic_id", site.clinic_id)
              .limit(200),
          ]);

          leadsThisWeek = weeklyCount || 0;
          totalLeads = totalCount || 0;

          const allStatuses = (allRows || []).map((row) =>
            String(row.status || "")
              .trim()
              .toLowerCase(),
          );

          newLeadsCount = allStatuses.filter(
            (status) => status === "new",
          ).length;
          bookedLeadsCount = allStatuses.filter(
            (status) => status === "booked",
          ).length;
        }
      }
    }
  }

  const widgetDetected = Boolean(widgetLastSeenAt);
  const widgetStatus = widgetDetected ? "Live" : "Needs install";

  const currentPlanTone = getPlanTone(subStatus);
  const showTrialExpiredBox = isTrialExpired;

  return (
    <div className="space-y-6">
      <section className="card-premium p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge tone="brand">Dashboard</Badge>

            <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
              Welcome to your clinic workspace
            </h1>

            <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
              See your latest LeadClaw status, recent activity, and the next
              best actions for getting value from the platform.
            </p>

            <p className="mt-4 text-sm text-muted">
              Signed in as{" "}
              <span className="font-medium text-foreground">{user.email}</span>
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/portal/billing" className="button-secondary">
              Manage billing
            </Link>
            <LogoutButton />
          </div>
        </div>
      </section>

      {checkoutSuccess && (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-sm">
          <p className="font-semibold">Your paid plan is now active</p>
          <p className="mt-1">
            LeadClaw is ready to use.
            {setupReady
              ? " Your install section has been prepared below."
              : " You can continue with setup from the sections below."}
          </p>
        </div>
      )}

      {trialStarted && (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-sm">
          <p className="font-semibold">Your free trial is now active</p>
          <p className="mt-1">
            You can now install your widget, review leads, and explore your
            workspace.
          </p>
        </div>
      )}

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
            Upgrade now to restore full access.
          </p>
          <div className="mt-4">
            <PortalPlanUpgrade email={user.email} />
          </div>
        </div>
      )}

      <section>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Subscription"
            value={subStatus}
            hint={
              isTrialing && trialEnd
                ? `Trial ends ${formatDateTime(trialEnd)}`
                : hasActiveSubscription
                  ? "Your package is currently usable."
                  : "Your package is currently paused."
            }
          />

          <StatCard
            label="Widget status"
            value={widgetStatus}
            hint={
              widgetDetected
                ? "The widget has been seen on a live website."
                : "Install your widget to begin capturing enquiries."
            }
          />

          <StatCard
            label="Leads this week"
            value={String(leadsThisWeek)}
            hint="New enquiries captured in the last 7 days."
          />

          <StatCard
            label="Total leads"
            value={String(totalLeads)}
            hint="All enquiries captured for your clinic."
          />
        </div>
      </section>

      <section>
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="card-premium p-6 md:p-8">
            <SectionHeading
              eyebrow="Overview"
              title="Recent lead activity"
              description="A quick view of your latest enquiries and what needs attention."
              maxWidth="md"
            />

            {recentEnquiries.length > 0 ? (
              <div className="mt-6 space-y-3">
                {recentEnquiries.map((enquiry) => (
                  <div
                    key={enquiry.id}
                    className="rounded-[22px] border border-border bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {enquiry.name || "Unnamed enquiry"}
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          Received {formatDateTime(enquiry.created_at)}
                        </p>
                      </div>

                      <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-medium text-muted">
                        {String(enquiry.status || "new")}
                      </span>
                    </div>
                  </div>
                ))}

                <div className="pt-2">
                  <Link href="/portal/leads" className="button-secondary">
                    Open full lead inbox
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-[24px] border border-dashed border-border bg-surface-2 p-6 text-sm text-muted">
                <p className="font-medium text-foreground">
                  No live leads to show yet
                </p>
                <p className="mt-2 leading-7">
                  Once your widget is installed and visitors submit enquiries,
                  your lead inbox will start filling up.
                </p>
                <div className="mt-4">
                  <Link href="/portal/install" className="button-secondary">
                    Go to install
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="card-premium p-6 md:p-8">
              <SectionHeading
                eyebrow="Quick actions"
                title="Next best steps"
                description="Use these shortcuts to keep setup and follow-up moving."
                maxWidth="md"
              />

              <div className="mt-6 grid gap-3">
                <Link href="/portal/install" className="button-secondary">
                  Open install guide
                </Link>
                <Link href="/portal/leads" className="button-secondary">
                  Review leads
                </Link>
                <Link href="/portal/billing" className="button-secondary">
                  Review billing
                </Link>
                <Link href="/portal/support" className="button-secondary">
                  Contact support
                </Link>
              </div>
            </div>

            <div className="card-premium p-6 md:p-8">
              <SectionHeading
                eyebrow="Clinic status"
                title="Workspace summary"
                description="A fast summary of your current product state."
                maxWidth="md"
              />

              <div className="mt-5 space-y-4">
                <div className="rounded-[22px] border border-border bg-white p-5">
                  <p className="text-sm font-medium text-muted">Current plan</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone={currentPlanTone}>{subStatus}</Badge>
                    {isTrialing && !isTrialExpired ? (
                      <Badge tone="brand">
                        Trial
                        {trialEnd ? ` • ends ${formatDateTime(trialEnd)}` : ""}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[22px] border border-border bg-white p-5">
                  <p className="text-sm font-medium text-muted">Website</p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {domain || "Preparing setup"}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Widget last seen: {formatDateTime(widgetLastSeenAt)}
                  </p>
                </div>

                <div className="rounded-[22px] border border-border bg-white p-5">
                  <p className="text-sm font-medium text-muted">Lead summary</p>
                  <p className="mt-2 text-sm text-muted">
                    New leads awaiting contact:{" "}
                    <span className="font-semibold text-foreground">
                      {newLeadsCount}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Booked leads:{" "}
                    <span className="font-semibold text-foreground">
                      {bookedLeadsCount}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Last lead received:{" "}
                    <span className="font-semibold text-foreground">
                      {formatDateTime(lastLeadReceived)}
                    </span>
                  </p>
                </div>

                <div className="rounded-[22px] border border-border bg-white p-5">
                  <p className="text-sm font-medium text-muted">
                    Billing timing
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Trial end:{" "}
                    <span className="font-semibold text-foreground">
                      {formatDateTime(trialEnd)}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Current period end:{" "}
                    <span className="font-semibold text-foreground">
                      {formatDateTime(currentPeriodEnd)}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <PortalChat />
    </div>
  );
}
