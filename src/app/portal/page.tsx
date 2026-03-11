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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Client Portal</h1>
          <p className="text-sm text-slate-600">Signed in as {user.email}</p>
        </div>
        <LogoutButton />
      </div>

      {checkoutSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          ✅ Checkout complete. Your account is active and your setup is ready
          below.
          {setupReady ? " Your install section has been prepared." : ""}
        </div>
      )}

      {trialStarted && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          ✅ Free trial started. Your setup section is now active below.
        </div>
      )}

      {rawSubscriptionStatus === "past_due" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-lg font-semibold text-amber-950">
            Payment issue detected
          </h2>
          <p className="mt-2 text-sm text-amber-900">
            Your package is still accessible right now, but there is a billing
            issue that needs attention to avoid interruption.
          </p>
          <div className="mt-4">
            <PortalPlanUpgrade email={user.email} />
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Subscription</p>
          <p className="text-xl font-semibold">{subStatus}</p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Leads this week</p>
          <p className="text-xl font-semibold">
            {canUsePortalFeatures ? leadsThisWeek : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {canUsePortalFeatures
              ? "Real enquiries captured in the last 7 days."
              : "Upgrade to unlock live lead tracking."}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Widget status</p>
          <p className="text-xl font-semibold">{widgetStatus}</p>
          <p className="mt-1 text-xs text-slate-500">
            {canUsePortalFeatures
              ? widgetDetected
                ? "Your widget has been detected on a live website."
                : "Install your widget to start capturing enquiries."
              : "Activate a package to unlock installation."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Total leads</p>
          <p className="text-xl font-semibold">
            {canUsePortalFeatures ? totalLeads : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            All enquiries captured for your clinic.
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Last lead received</p>
          <p className="text-xl font-semibold">
            {canUsePortalFeatures
              ? lastLeadReceived
                ? new Date(lastLeadReceived).toLocaleString()
                : "—"
              : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Latest enquiry timestamp from your live widget.
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Avg response time</p>
          <p className="text-xl font-semibold">—</p>
          <p className="mt-1 text-xs text-slate-500">
            Response analytics not available yet.
          </p>
        </div>
      </div>

      {showTrialExpiredBox && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-lg font-semibold text-amber-950">
            Your trial has ended
          </h2>
          <p className="mt-2 text-sm text-amber-900">
            {trialEnd
              ? `Your free trial ended on ${new Date(trialEnd).toLocaleString()}.`
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
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
            <h2 className="text-lg font-semibold text-sky-950">
              Unlock your live enquiry widget
            </h2>
            <p className="mt-2 text-sm text-sky-900">
              Start or upgrade your package to activate your widget, open the
              lead inbox, and keep your installation snippet available here.
            </p>
            <div className="mt-4">
              <PortalPlanUpgrade email={user.email} />
            </div>
          </div>
        )}

      {canUsePortalFeatures ? (
        <div className="space-y-3 rounded-xl border bg-white p-6">
          <h2 className="text-lg font-semibold">Install your widget</h2>

          <p className="text-sm text-slate-600">
            Add the script below to your website to activate your LeadClaw
            enquiry widget and start capturing leads.
          </p>

          {portalContext?.domain ? (
            <p className="text-sm text-slate-700">
              Site: <strong>{portalContext.domain}</strong> • Setup status:{" "}
              <strong>{portalContext.siteStatus || "pending_install"}</strong>
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              Your setup package is preparing. Refresh in a few seconds.
            </p>
          )}

          {widgetDetected && (
            <div className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-medium">Widget detected live</p>
              <p className="mt-1">
                Last seen:{" "}
                <strong>
                  {portalContext?.widgetLastSeenAt
                    ? new Date(portalContext.widgetLastSeenAt).toLocaleString()
                    : "—"}
                </strong>
              </p>
              <p className="mt-1">
                Domain:{" "}
                <strong>{portalContext?.widgetLastSeenDomain || "—"}</strong>
              </p>
            </div>
          )}

          {!widgetDetected && snippetReady && (
            <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium">Widget not detected yet</p>
              <p className="mt-1">
                Install the snippet, publish your website, then refresh this
                page after visiting your site.
              </p>
            </div>
          )}

          {snippetReady ? (
            <>
              <InstallSnippetCard widgetSnippet={widgetSnippet} />

              <div className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-medium text-slate-900">
                  Quick install instructions
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
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
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Install package exists, but the widget snippet is not ready yet.
            </div>
          )}

          {isTrialing && !isTrialExpired && (
            <p className="text-xs text-slate-500">
              Trial status: <strong>{rawSubscriptionStatus}</strong>
              {trialEnd
                ? ` • Trial ends: ${new Date(trialEnd).toLocaleString()}`
                : ""}
            </p>
          )}

          {!isTrialing && hasActiveSubscription && (
            <p className="text-xs text-slate-500">
              Your package is active and ready to use.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border bg-white p-6">
          <h2 className="text-lg font-semibold">Install your widget</h2>
          <p className="mt-2 text-sm text-slate-600">
            Your install snippet is locked until you start or reactivate a plan.
            Once active, this section will show your ready-to-paste website
            code.
          </p>
        </div>
      )}

      <div className="rounded-xl border bg-white p-6">
        <h2 className="mb-3 text-lg font-semibold">Lead inbox</h2>

        {canUsePortalFeatures ? (
          enquiries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Email</th>
                    <th className="py-2 pr-4 font-medium">Phone</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {enquiries.map((enquiry) => {
                    const status = normalizeEnquiryStatus(enquiry.status);

                    return (
                      <tr key={enquiry.id} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-medium text-slate-900">
                          {enquiry.name || "—"}
                        </td>
                        <td className="py-3 pr-4 text-slate-600">
                          {enquiry.email || "—"}
                        </td>
                        <td className="py-3 pr-4 text-slate-600">
                          {enquiry.phone || "—"}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-col gap-2">
                            <span
                              className={`inline-flex w-fit rounded-full border px-2 py-1 text-xs font-medium capitalize ${statusBadgeClasses(
                                status,
                              )}`}
                            >
                              {status}
                            </span>

                            <form action={updateEnquiryStatus}>
                              <input
                                type="hidden"
                                name="enquiryId"
                                value={enquiry.id}
                              />
                              <select
                                name="status"
                                defaultValue={status}
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                              >
                                {ENQUIRY_STATUS_OPTIONS.map((option) => (
                                  <option key={option} value={option}>
                                    {option.charAt(0).toUpperCase() +
                                      option.slice(1)}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="submit"
                                className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white"
                              >
                                Update
                              </button>
                            </form>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-slate-600">
                          {enquiry.created_at
                            ? new Date(enquiry.created_at).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-slate-50 p-6 text-sm text-slate-600">
              <p className="font-medium text-slate-800">
                No live leads to show yet.
              </p>
              <p className="mt-2">
                This inbox will populate after your widget is installed and
                visitors start submitting enquiries.
              </p>
            </div>
          )
        ) : (
          <div className="rounded-lg border border-dashed bg-slate-50 p-6 text-sm text-slate-600">
            <p className="font-medium text-slate-800">Lead inbox locked</p>
            <p className="mt-2">
              Upgrade or reactivate your package to view live enquiries and keep
              your widget collecting new leads.
            </p>
          </div>
        )}
      </div>

      <PortalChat />
    </div>
  );
}
