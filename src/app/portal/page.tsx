import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/logout-button";
import PortalTrialCta from "@/components/portal-trial-cta";
import PortalPlanUpgrade from "@/components/portal-plan-upgrade";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildWidgetSnippet } from "@/lib/onboarding";
import PortalChat from "@/components/portal-chat";
import InstallSnippetCard from "@/components/install-snippet-card";
import { Badge, SectionHeading, StatCard } from "@/components/ui";

type PortalContext = {
  clientId: string;
  siteId: string | null;
  domain: string | null;
  siteStatus: string | null;
  clinicId: string | null;
  widgetToken: string | null;
  widgetLastSeenAt: string | null;
  widgetLastSeenDomain: string | null;
};

type EnquiryStatus = "new" | "contacted" | "booked" | "lost";

type EnquiryRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  created_at: string | null;
};

const ENQUIRY_STATUS_OPTIONS: EnquiryStatus[] = [
  "new",
  "contacted",
  "booked",
  "lost",
];

function normalizeEnquiryStatus(
  value: string | null | undefined,
): EnquiryStatus {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "contacted") return "contacted";
  if (normalized === "booked") return "booked";
  if (normalized === "lost") return "lost";
  return "new";
}

function statusBadgeClasses(status: EnquiryStatus) {
  switch (status) {
    case "contacted":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "booked":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "lost":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "new":
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function statusLabel(status: EnquiryStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatSiteStatus(value: string | null | undefined) {
  if (!value) return "Pending";
  return value.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
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

function getWidgetStatusTone(widgetStatus: string) {
  const lower = widgetStatus.toLowerCase();

  if (lower === "live")
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (lower === "pending install")
    return "border-amber-200 bg-amber-50 text-amber-800";
  if (lower === "ready to install")
    return "border-sky-200 bg-sky-50 text-sky-800";

  return "border-slate-200 bg-slate-50 text-slate-800";
}

async function updateEnquiryStatus(formData: FormData) {
  "use server";

  const enquiryId = String(formData.get("enquiryId") || "").trim();
  const nextStatus = normalizeEnquiryStatus(
    String(formData.get("status") || "").trim(),
  );

  if (!enquiryId) return;

  const admin = createAdminClient();
  if (!admin) return;

  const { error } = await admin
    .from("enquiries")
    .update({ status: nextStatus })
    .eq("id", enquiryId);

  if (error) {
    console.error("[portal] failed to update enquiry status", error);
  }

  revalidatePath("/portal");
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

      isTrialing = rawSubscriptionStatus === "trialing";
      isTrialExpired =
        rawSubscriptionStatus === "expired" ||
        rawSubscriptionStatus === "canceled";

      hasActiveSubscription = ["trialing", "active", "past_due"].includes(
        rawSubscriptionStatus,
      );
    }
  }

  let portalContext: PortalContext | null = null;
  let enquiries: EnquiryRow[] = [];
  let leadsThisWeek = 0;
  let totalLeads = 0;
  let lastLeadReceived: string | null = null;

  if (admin && user.email) {
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
        .select("id,domain,status,clinic_id")
        .eq("onboarding_client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let widgetToken: string | null = null;
      let widgetLastSeenAt: string | null = null;
      let widgetLastSeenDomain: string | null = null;

      if (site?.id) {
        const { data: tokenRow } = await admin
          .from("widget_tokens")
          .select("token,last_seen_at,last_seen_domain")
          .eq("onboarding_site_id", site.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        widgetToken = tokenRow?.token || null;
        widgetLastSeenAt = tokenRow?.last_seen_at || null;
        widgetLastSeenDomain = tokenRow?.last_seen_domain || null;
      }

      portalContext = {
        clientId: client.id,
        siteId: site?.id || null,
        domain: site?.domain || null,
        siteStatus: site?.status || null,
        clinicId: site?.clinic_id || null,
        widgetToken,
        widgetLastSeenAt,
        widgetLastSeenDomain,
      };

      if (portalContext.clinicId && hasActiveSubscription) {
        const { data: enquiryRows } = await admin
          .from("enquiries")
          .select("id,name,email,phone,status,created_at")
          .eq("clinic_id", portalContext.clinicId)
          .order("created_at", { ascending: false })
          .limit(20);

        enquiries = (enquiryRows as EnquiryRow[] | null) || [];
        lastLeadReceived = enquiries[0]?.created_at || null;

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const [{ count: weeklyCount }, { count: totalCount }] =
          await Promise.all([
            admin
              .from("enquiries")
              .select("*", { count: "exact", head: true })
              .eq("clinic_id", portalContext.clinicId)
              .gte("created_at", sevenDaysAgo.toISOString()),
            admin
              .from("enquiries")
              .select("*", { count: "exact", head: true })
              .eq("clinic_id", portalContext.clinicId),
          ]);

        leadsThisWeek = weeklyCount || 0;
        totalLeads = totalCount || 0;
      }
    }
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://leadclaw.uk";
  const widgetSnippet = portalContext?.widgetToken
    ? buildWidgetSnippet(appUrl, portalContext.widgetToken)
    : "";
  const snippetReady = widgetSnippet.trim().length > 0;

  const canUsePortalFeatures = hasActiveSubscription;
  const showTrialExpiredBox = isTrialExpired;
  const showUpgradeBox =
    !hasActiveSubscription || rawSubscriptionStatus === "past_due";

  const widgetDetected = Boolean(portalContext?.widgetLastSeenAt);

  const widgetStatus = !canUsePortalFeatures
    ? "Locked"
    : widgetDetected
      ? "Live"
      : portalContext?.siteStatus === "pending_install"
        ? "Pending install"
        : snippetReady
          ? "Ready to install"
          : "Preparing";

  const newLeadsCount = enquiries.filter(
    (enquiry) => normalizeEnquiryStatus(enquiry.status) === "new",
  ).length;

  const bookedLeadsCount = enquiries.filter(
    (enquiry) => normalizeEnquiryStatus(enquiry.status) === "booked",
  ).length;

  const widgetToneClasses = getWidgetStatusTone(widgetStatus);
  const currentPlanTone = getPlanTone(subStatus);

  return (
    <div className="space-y-8">
      <section className="page-hero">
        <div className="card-premium p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge tone="brand">Clinic portal</Badge>

              <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                Your LeadClaw dashboard
              </h1>

              <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
                Track captured enquiries, monitor widget installation, and keep
                your clinic follow-up workflow organised in one place.
              </p>

              <p className="mt-4 text-sm text-muted">
                Signed in as{" "}
                <span className="font-medium text-foreground">
                  {user.email}
                </span>
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <a href="/pricing" className="button-secondary">
                Manage subscription
              </a>
              <LogoutButton />
            </div>
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
              : " You can continue with setup below."}
          </p>
        </div>
      )}

      {trialStarted && (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-sm">
          <p className="font-semibold">Your free trial is now active</p>
          <p className="mt-1">
            You can continue with setup below and start preparing your LeadClaw
            install.
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
                  : "No active access yet."
            }
          />

          <StatCard
            label="Leads this week"
            value={canUsePortalFeatures ? String(leadsThisWeek) : "—"}
            hint={
              canUsePortalFeatures
                ? "Real enquiries captured in the last 7 days."
                : "Upgrade to unlock live lead tracking."
            }
          />

          <StatCard
            label="Widget status"
            value={widgetStatus}
            hint={
              canUsePortalFeatures
                ? widgetDetected
                  ? "Your widget has been detected on a live website."
                  : "Install your widget to start capturing enquiries."
                : "Activate a package to unlock installation."
            }
          />

          <StatCard
            label="Total leads"
            value={canUsePortalFeatures ? String(totalLeads) : "—"}
            hint="All enquiries captured for your clinic."
          />
        </div>
      </section>

      <section>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Last lead received"
            value={
              canUsePortalFeatures ? formatDateTime(lastLeadReceived) : "—"
            }
            hint="Latest enquiry timestamp from your live widget."
          />

          <StatCard
            label="New leads awaiting contact"
            value={canUsePortalFeatures ? String(newLeadsCount) : "—"}
            hint="Prioritise these first while intent is still high."
          />

          <StatCard
            label="Booked leads"
            value={canUsePortalFeatures ? String(bookedLeadsCount) : "—"}
            hint="Tracked from your latest lead inbox activity."
          />
        </div>
      </section>

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

      {!showTrialExpiredBox && !hasActiveSubscription && <PortalTrialCta />}

      {showUpgradeBox &&
        !showTrialExpiredBox &&
        rawSubscriptionStatus !== "past_due" &&
        user.email && (
          <div className="rounded-[24px] border border-sky-200 bg-sky-50 p-5">
            <h2 className="text-lg font-semibold text-sky-950">
              Unlock your live enquiry widget
            </h2>
            <p className="mt-2 text-sm leading-7 text-sky-900">
              Start or upgrade your package to activate your widget, open the
              lead inbox, and keep your installation snippet available here.
            </p>
            <div className="mt-4">
              <PortalPlanUpgrade email={user.email} />
            </div>
          </div>
        )}

      <section>
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="card-premium p-6 md:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <SectionHeading
                eyebrow="Lead inbox"
                title="Recent enquiries"
                description="Your latest captured leads, ready for follow-up."
                maxWidth="md"
              />

              {canUsePortalFeatures ? (
                <div className="rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-muted shadow-sm">
                  {enquiries.length} showing
                </div>
              ) : null}
            </div>

            {canUsePortalFeatures ? (
              enquiries.length > 0 ? (
                <>
                  <div className="mt-6 hidden overflow-hidden rounded-[24px] border border-border lg:block">
                    <div className="grid grid-cols-[1fr_1fr_0.9fr_1fr_1fr] border-b border-border bg-surface-2 px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted-2">
                      <div>Name</div>
                      <div>Email</div>
                      <div>Phone</div>
                      <div>Status</div>
                      <div>Received</div>
                    </div>

                    {enquiries.map((enquiry) => {
                      const status = normalizeEnquiryStatus(enquiry.status);

                      return (
                        <div
                          key={enquiry.id}
                          className="grid grid-cols-[1fr_1fr_0.9fr_1fr_1fr] items-start border-b border-border bg-white px-5 py-4 last:border-b-0"
                        >
                          <div className="pr-4 font-medium text-foreground">
                            {enquiry.name || "—"}
                          </div>

                          <div className="pr-4 text-sm text-muted">
                            {enquiry.email || "—"}
                          </div>

                          <div className="pr-4 text-sm text-muted">
                            {enquiry.phone || "—"}
                          </div>

                          <div className="pr-4">
                            <div className="flex flex-col gap-2">
                              <span
                                className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusBadgeClasses(
                                  status,
                                )}`}
                              >
                                {status}
                              </span>

                              <form
                                action={updateEnquiryStatus}
                                className="flex flex-col gap-2"
                              >
                                <input
                                  type="hidden"
                                  name="enquiryId"
                                  value={enquiry.id}
                                />
                                <select
                                  name="status"
                                  defaultValue={status}
                                  className="rounded-xl border border-border bg-white px-3 py-2 text-xs text-foreground outline-none transition focus:border-brand"
                                >
                                  {ENQUIRY_STATUS_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                      {statusLabel(option)}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="submit"
                                  className="inline-flex w-fit items-center justify-center rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:-translate-y-0.5"
                                >
                                  Update
                                </button>
                              </form>
                            </div>
                          </div>

                          <div className="text-sm text-muted">
                            {formatDateTime(enquiry.created_at)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6 grid gap-4 lg:hidden">
                    {enquiries.map((enquiry) => {
                      const status = normalizeEnquiryStatus(enquiry.status);

                      return (
                        <div
                          key={`${enquiry.id}-mobile`}
                          className="rounded-[22px] border border-border bg-white p-5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-base font-semibold text-foreground">
                                {enquiry.name || "—"}
                              </h3>
                              <p className="mt-1 text-sm text-muted">
                                {enquiry.email || "—"}
                              </p>
                              <p className="mt-1 text-sm text-muted">
                                {enquiry.phone || "—"}
                              </p>
                            </div>

                            <span
                              className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusBadgeClasses(
                                status,
                              )}`}
                            >
                              {status}
                            </span>
                          </div>

                          <div className="mt-4">
                            <form
                              action={updateEnquiryStatus}
                              className="flex flex-col gap-2 sm:flex-row sm:items-center"
                            >
                              <input
                                type="hidden"
                                name="enquiryId"
                                value={enquiry.id}
                              />
                              <select
                                name="status"
                                defaultValue={status}
                                className="rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand"
                              >
                                {ENQUIRY_STATUS_OPTIONS.map((option) => (
                                  <option key={option} value={option}>
                                    {statusLabel(option)}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="submit"
                                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5"
                              >
                                Update
                              </button>
                            </form>
                          </div>

                          <p className="mt-4 text-sm text-muted">
                            Received: {formatDateTime(enquiry.created_at)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="mt-6 rounded-[24px] border border-dashed border-border bg-surface-2 p-6 text-sm text-muted">
                  <p className="font-medium text-foreground">
                    No live leads to show yet
                  </p>
                  <p className="mt-2 leading-7">
                    This inbox will populate after your widget is installed and
                    visitors start submitting enquiries.
                  </p>
                </div>
              )
            ) : (
              <div className="mt-6 rounded-[24px] border border-dashed border-border bg-surface-2 p-6 text-sm text-muted">
                <p className="font-medium text-foreground">Lead inbox locked</p>
                <p className="mt-2 leading-7">
                  Upgrade or reactivate your package to view live enquiries and
                  keep your widget collecting new leads.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="card-premium p-6 md:p-8">
              <SectionHeading
                eyebrow="Widget status"
                title="Installation"
                description="Make sure your website widget is active and capturing enquiries."
                maxWidth="md"
              />

              <div
                className={`mt-6 rounded-[24px] border p-5 ${widgetToneClasses}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{widgetStatus}</p>
                    <p className="mt-1 text-sm opacity-90">
                      {canUsePortalFeatures
                        ? widgetDetected
                          ? "Your widget has been detected on a live website."
                          : "Install and publish your snippet to start capturing leads."
                        : "Activate a package to unlock installation."}
                    </p>
                  </div>
                  <span
                    className={`h-3 w-3 rounded-full ${
                      widgetDetected ? "bg-emerald-500" : "bg-amber-400"
                    }`}
                  />
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <div className="rounded-[22px] border border-border bg-white p-5">
                  <p className="text-sm font-medium text-muted">Site</p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {portalContext?.domain || "Preparing setup"}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Setup status: {formatSiteStatus(portalContext?.siteStatus)}
                  </p>
                </div>

                {widgetDetected && (
                  <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
                    <p className="font-semibold">Widget detected live</p>
                    <p className="mt-2">
                      Last seen:{" "}
                      <strong>
                        {formatDateTime(
                          portalContext?.widgetLastSeenAt || null,
                        )}
                      </strong>
                    </p>
                    <p className="mt-1">
                      Domain:{" "}
                      <strong>
                        {portalContext?.widgetLastSeenDomain || "—"}
                      </strong>
                    </p>
                  </div>
                )}

                {!widgetDetected && snippetReady && canUsePortalFeatures && (
                  <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                    <p className="font-semibold">Widget not detected yet</p>
                    <p className="mt-2 leading-7">
                      Install the snippet, publish your site, then refresh this
                      page after visiting your live website.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="card-premium p-6 md:p-8">
              <SectionHeading
                eyebrow="Current plan"
                title="Subscription overview"
                description="Your current LeadClaw setup and access state."
                maxWidth="md"
              />

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Badge tone={currentPlanTone}>{subStatus}</Badge>

                {isTrialing && !isTrialExpired && (
                  <Badge tone="brand">
                    Trial
                    {trialEnd ? ` • ends ${formatDateTime(trialEnd)}` : ""}
                  </Badge>
                )}
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-[22px] border border-border bg-white p-5">
                  <p className="text-sm font-medium text-muted">Access</p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {hasActiveSubscription
                      ? "Portal features unlocked"
                      : "Portal features limited"}
                  </p>
                </div>

                <div className="rounded-[22px] border border-border bg-white p-5">
                  <p className="text-sm font-medium text-muted">
                    Install snippet
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {snippetReady ? "Ready" : "Preparing"}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <PortalPlanUpgrade email={user.email} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        {canUsePortalFeatures ? (
          <div className="card-premium p-6 md:p-8">
            <SectionHeading
              eyebrow="Install your widget"
              title="Website installation snippet"
              description="Paste this on your website to activate your LeadClaw enquiry widget."
              maxWidth="lg"
            />

            <div className="mt-6 space-y-4">
              {snippetReady ? (
                <>
                  <InstallSnippetCard widgetSnippet={widgetSnippet} />

                  <div className="rounded-[24px] border border-border bg-surface-2 p-5 text-sm text-muted">
                    <p className="font-semibold text-foreground">
                      Quick install instructions
                    </p>
                    <ol className="mt-3 list-decimal space-y-2 pl-5 leading-7">
                      <li>Open your website editor or codebase.</li>
                      <li>
                        Paste the script before the closing &lt;/body&gt; tag.
                      </li>
                      <li>Publish the site changes.</li>
                      <li>
                        Visit your live website, then return here and refresh to
                        confirm the widget has been detected.
                      </li>
                    </ol>
                  </div>
                </>
              ) : (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Install package exists, but the widget snippet is not ready
                  yet.
                </div>
              )}

              {!isTrialing && hasActiveSubscription && (
                <p className="text-xs text-muted">
                  Your package is active and ready to use.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="card-premium p-6 md:p-8">
            <SectionHeading
              eyebrow="Install your widget"
              title="Snippet locked"
              description="Start or reactivate a plan to unlock your website install code."
              maxWidth="lg"
            />
            <div className="mt-4 rounded-[24px] border border-dashed border-border bg-surface-2 p-6 text-sm text-muted">
              Your install snippet is locked until you start or reactivate a
              plan. Once active, this section will show your ready-to-paste
              website code.
            </div>
          </div>
        )}
      </section>

      <PortalChat />
    </div>
  );
}
