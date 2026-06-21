import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import GaEventOnMount from "@/components/analytics/ga-event-on-mount";
import LogoutButton from "@/components/logout-button";
import PortalPlanUpgrade from "@/components/portal-plan-upgrade";
import PortalChat from "@/components/portal-chat";
import { Badge, SectionHeading, StatCard } from "@/components/ui";
import ManageBillingButton from "@/components/manage-billing-button";

type PortalSubscriptionRow = {
  status: string | null;
  plan: string | null;
  trial_end: string | null;
  current_period_end: string | null;
};

type IdRow = {
  id: string;
};

type PortalSiteRow = {
  id: string;
  domain: string | null;
  clinic_id: string | null;
};

type WidgetSeenRow = {
  last_seen_at: string | null;
};

type RecentEnquiryRow = {
  id: string;
  name: string | null;
  created_at: string | null;
  status: string | null;
};

type EnquiryStatusOnlyRow = {
  status: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function getPlanTone(
  subscriptionText: string,
): "brand" | "amber" | "violet" | "cyan" | "neutral" {
  const lower = subscriptionText.toLowerCase();
  if (lower.includes("basic")) return "amber";
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

  // Onboarding gate: route users who haven't finished the setup wizard there
  // first, so nobody lands in the portal without installing the widget.
  if (user.email) {
    const gateAdmin = createAdminClient({ optional: true });
    if (gateAdmin) {
      const { data: gateClient } = await (gateAdmin as unknown as SupabaseUntypedClient)
        .from("onboarding_clients")
        .select("id")
        .eq("contact_email", user.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const gateClientId = (gateClient as { id: string } | null)?.id || null;
      if (gateClientId) {
        const { data: gateSite } = await (gateAdmin as unknown as SupabaseUntypedClient)
          .from("onboarding_sites")
          .select("settings")
          .eq("onboarding_client_id", gateClientId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const gateSettings =
          ((gateSite as { settings: Record<string, unknown> | null } | null)?.settings ||
            {}) as Record<string, unknown>;
        const gateOnboarding = (gateSettings.onboarding || {}) as Record<string, unknown>;
        if (gateOnboarding.completed !== true) {
          redirect("/portal/onboarding");
        }
      }
    }
  }

  const params = (await searchParams) || {};
  const trialStarted = params.trial === "started";
  const trialAlreadyActive = params.trial === "active";
  const basicStarted = params.startBasic === "1";
  const checkoutSuccess = params.checkout === "success";
  const setupReady = params.setup === "ready";
  const requestedPlan =
    params.plan === "basic" || params.plan === "growth" || params.plan === "pro"
      ? params.plan
      : undefined;
  const portalConversionFlow = checkoutSuccess
    ? "checkout_success"
    : trialStarted
      ? "trial_signup"
      : basicStarted
        ? "basic_signup"
        : null;

  const admin = createAdminClient();

  let subStatus = "No active subscription found";
  let rawSubscriptionStatus = "none";
  let currentPlan = "basic";
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
  let recentEnquiries: RecentEnquiryRow[] = [];

  if (admin) {
    const { data: subscription } = await (admin as unknown as SupabaseUntypedClient)
      .from("subscriptions")
      .select("status,plan,trial_end,current_period_end")
      .eq("email", user.email || "")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const latestSubscription = subscription as PortalSubscriptionRow | null;

    if (latestSubscription?.status) {
      rawSubscriptionStatus = String(latestSubscription.status).toLowerCase();

      const planLabel = latestSubscription.plan
        ? `${String(latestSubscription.plan).toUpperCase()} • `
        : "";
      currentPlan = String(latestSubscription.plan || "basic").toLowerCase();

      subStatus = `${planLabel}${latestSubscription.status}`;
      trialEnd = latestSubscription.trial_end || null;
      currentPeriodEnd = latestSubscription.current_period_end || null;

      isTrialing = rawSubscriptionStatus === "trialing";
      isTrialExpired =
        rawSubscriptionStatus === "expired" ||
        rawSubscriptionStatus === "canceled";

      hasActiveSubscription = ["trialing", "active", "past_due"].includes(
        rawSubscriptionStatus,
      );
    }

    if (user.email) {
      const { data: client } = await (admin as unknown as SupabaseUntypedClient)
        .from("onboarding_clients")
        .select("id")
        .eq("contact_email", user.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const onboardingClient = client as IdRow | null;

      if (onboardingClient?.id) {
        const { data: site } = await (admin as unknown as SupabaseUntypedClient)
          .from("onboarding_sites")
          .select("id,domain,clinic_id")
          .eq("onboarding_client_id", onboardingClient.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const onboardingSite = site as PortalSiteRow | null;

        domain = onboardingSite?.domain || null;

        if (onboardingSite?.id) {
          const { data: tokenRow } = await (admin as unknown as SupabaseUntypedClient)
            .from("widget_tokens")
            .select("last_seen_at")
            .eq("onboarding_site_id", onboardingSite.id)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          widgetLastSeenAt =
            (tokenRow as WidgetSeenRow | null)?.last_seen_at || null;
        }

        if (onboardingSite?.clinic_id && hasActiveSubscription) {
          const { data: enquiryRows } = await (admin as unknown as SupabaseUntypedClient)
            .from("enquiries")
            .select("id,name,status,created_at")
            .eq("clinic_id", onboardingSite.clinic_id)
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
            (admin as unknown as SupabaseUntypedClient)
              .from("enquiries")
              .select("*", { count: "exact", head: true })
              .eq("clinic_id", onboardingSite.clinic_id)
              .gte("created_at", sevenDaysAgo.toISOString()),
            (admin as unknown as SupabaseUntypedClient)
              .from("enquiries")
              .select("*", { count: "exact", head: true })
              .eq("clinic_id", onboardingSite.clinic_id),
            (admin as unknown as SupabaseUntypedClient)
              .from("enquiries")
              .select("status")
              .eq("clinic_id", onboardingSite.clinic_id)
              .limit(200),
          ]);

          leadsThisWeek = weeklyCount || 0;
          totalLeads = totalCount || 0;

          const allStatuses = ((allRows || []) as EnquiryStatusOnlyRow[]).map((row) =>
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

  const isDowngradedBasic =
    rawSubscriptionStatus === "expired" && currentPlan === "basic";
  if (isTrialExpired && !isDowngradedBasic) {
    redirect("/portal/billing?expired=1");
  }

  const widgetDetected = Boolean(widgetLastSeenAt);
  const widgetStatus = widgetDetected ? "Live" : "Needs install";

  const currentPlanTone = getPlanTone(subStatus);
  const showTrialExpiredBox = isTrialExpired && !isDowngradedBasic;

  return (
    <div className="space-y-6">
      {portalConversionFlow ? (
        <>
          <GaEventOnMount
            name="portal_reached"
            params={{
              route: "/portal",
              flow: portalConversionFlow,
              plan: requestedPlan || currentPlan,
            }}
            dedupeKey={`portal_reached_${portalConversionFlow}_${requestedPlan || currentPlan}`}
            flushPending
          />
          {trialStarted || basicStarted ? (
            <GaEventOnMount
              name="signup_completed"
              params={{
                route: "/portal",
                flow: portalConversionFlow,
                plan: requestedPlan || currentPlan,
              }}
              dedupeKey={`signup_completed_${portalConversionFlow}_${requestedPlan || currentPlan}`}
            />
          ) : null}
        </>
      ) : null}
      <section className="card-premium p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge tone="brand">Dashboard</Badge>

            <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
              Welcome to your workspace
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
            <ManageBillingButton />
            <LogoutButton />
          </div>
        </div>
      </section>

      <div className="rounded-[24px] border border-sky-200 bg-sky-50 p-5">
        <h2 className="text-lg font-semibold text-sky-950">
          Built with real customer feedback
        </h2>
        <p className="mt-2 text-sm leading-7 text-sky-900">
          LeadClaw is an early-stage product built closely with real customer
          feedback. If you spot an issue, want something improved, or have an
          idea that would make the platform more useful for your workspace,
          please send us a message. We review every report carefully and ship
          improvements continuously.
        </p>
        <div className="mt-4">
          <Link href="/portal/support" className="button-secondary">
            Contact support
          </Link>
        </div>
      </div>

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

      {trialAlreadyActive && (
        <div className="rounded-[24px] border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 shadow-sm">
          <p className="font-semibold">Your free trial is already active</p>
          <p className="mt-1">
            Continue setup from your workspace, or review billing if you want
            to change plan.
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
            <ManageBillingButton label="Fix payment in Manage billing" />
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
            : "Install your widget to begin capturing requests."
            }
          />

          <StatCard
            label="Leads this week"
            value={String(leadsThisWeek)}
            hint="New requests captured in the last 7 days."
          />

          <StatCard
            label="Total leads"
            value={String(totalLeads)}
            hint="All requests captured for your workspace."
          />
        </div>
      </section>

      <section>
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="card-premium p-6 md:p-8">
            <SectionHeading
              eyebrow="Overview"
              title="Recent lead activity"
              description="A quick view of your latest requests and what needs attention."
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
                          {enquiry.name || "Unnamed request"}
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
                  Once your widget is installed and visitors submit requests,
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
                eyebrow="Workspace status"
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
