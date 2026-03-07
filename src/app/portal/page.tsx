import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/logout-button";
import PortalTrialCta from "@/components/portal-trial-cta";
import PortalPlanUpgrade from "@/components/portal-plan-upgrade";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildWidgetSnippet } from "@/lib/onboarding";
import PortalChat from "@/components/portal-chat";

type PortalContext = {
  clientId: string;
  siteId: string | null;
  domain: string | null;
  siteStatus: string | null;
  clinicId: string | null;
  widgetToken: string | null;
};

type EnquiryRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

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

  const admin = createAdminClient();

  let subStatus = "No active subscription found";
  let rawSubscriptionStatus = "none";
  let activePlan = "starter";
  let trialEnd: string | null = null;
  let hasActiveSubscription = false;
  let isTrialing = false;

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
      hasActiveSubscription = ["trialing", "active", "past_due"].includes(
        rawSubscriptionStatus,
      );
      isTrialing = rawSubscriptionStatus === "trialing";
      activePlan = String(data.plan || "starter");
      trialEnd = data.trial_end || null;
    }
  }

  let portalContext: PortalContext | null = null;
  let enquiries: EnquiryRow[] = [];
  let leadsThisWeek = 0;

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

      if (site?.id) {
        const { data: tokenRow } = await admin
          .from("widget_tokens")
          .select("token")
          .eq("onboarding_site_id", site.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        widgetToken = tokenRow?.token || null;
      }

      portalContext = {
        clientId: client.id,
        siteId: site?.id || null,
        domain: site?.domain || null,
        siteStatus: site?.status || null,
        clinicId: site?.clinic_id || null,
        widgetToken,
      };

      if (portalContext.clinicId) {
        const { data: enquiryRows } = await admin
          .from("enquiries")
          .select("id,name,email,phone")
          .eq("clinic_id", portalContext.clinicId)
          .order("id", { ascending: false })
          .limit(20);

        enquiries = enquiryRows || [];

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { count } = await admin
          .from("enquiries")
          .select("*", { count: "exact", head: true })
          .eq("clinic_id", portalContext.clinicId)
          .gte("created_at", sevenDaysAgo.toISOString());

        leadsThisWeek = count || 0;
      }
    }
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://leadclaw.uk";
  const widgetSnippet = portalContext?.widgetToken
    ? buildWidgetSnippet(appUrl, portalContext.widgetToken)
    : "";
  const snippetReady = widgetSnippet.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Client Portal (MVP)</h1>
          <p className="text-sm text-slate-600">Signed in as {user.email}</p>
        </div>
        <LogoutButton />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Subscription</p>
          <p className="text-xl font-semibold">{subStatus}</p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Leads this week</p>
          <p className="text-xl font-semibold">{leadsThisWeek}</p>
          <p className="mt-1 text-xs text-slate-500">
            Real enquiries captured in the last 7 days.
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

      {trialStarted && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          ✅ Free trial started. Your setup section is now active below.
        </div>
      )}

      {!hasActiveSubscription && <PortalTrialCta />}

      {isTrialing && (
        <>
          <div className="space-y-3 rounded-xl border bg-white p-6">
            <h2 className="text-lg font-semibold">Free Trial Setup Section</h2>
            <p className="text-sm text-slate-600">
              Trial status: <strong>{rawSubscriptionStatus}</strong>
              {trialEnd
                ? ` • Trial ends: ${new Date(trialEnd).toLocaleString()}`
                : ""}
            </p>

            {portalContext?.domain ? (
              <>
                <p className="text-sm text-slate-700">
                  Site: <strong>{portalContext.domain}</strong> • Setup status:{" "}
                  <strong>
                    {portalContext.siteStatus || "pending_install"}
                  </strong>
                </p>

                {snippetReady ? (
                  <div className="rounded border bg-slate-50 p-3">
                    <div className="mb-2 text-sm font-medium text-slate-800">
                      Install snippet (paste before &lt;/body&gt;):
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-white p-3 text-xs text-slate-700">
                      <code>{widgetSnippet}</code>
                    </pre>
                  </div>
                ) : (
                  <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    Install package exists, but the widget snippet is not ready
                    yet.
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-600">
                Setup package is preparing. Refresh in a few seconds.
              </p>
            )}
          </div>

          <PortalPlanUpgrade email={user.email} />
        </>
      )}

      {!isTrialing && hasActiveSubscription && (
        <div className="rounded-xl border bg-white p-6">
          <h2 className="text-lg font-semibold">Subscribed Package Section</h2>
          <p className="text-sm text-slate-600">
            You are on the <strong>{activePlan.toUpperCase()}</strong> package.
            Manage usage and support from this portal.
          </p>
        </div>
      )}

      <div className="rounded-xl border bg-white p-6">
        <h2 className="mb-3 text-lg font-semibold">Lead inbox</h2>

        {enquiries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Phone</th>
                </tr>
              </thead>
              <tbody>
                {enquiries.map((enquiry) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed bg-slate-50 p-6 text-sm text-slate-600">
            <p className="font-medium text-slate-800">
              No live leads to show yet.
            </p>
            <p className="mt-2">
              This inbox will populate after the widget and lead capture flow
              are fully connected.
            </p>
            <p className="mt-1">
              For now, use the setup section above to prepare installation.
            </p>
          </div>
        )}
      </div>

      <PortalChat />
    </div>
  );
}
