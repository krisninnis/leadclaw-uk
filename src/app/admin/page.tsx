import { readFile } from "fs/promises";
import path from "path";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/logout-button";
import OpsSummary from "@/components/ops-summary";
import LeadImporter from "@/components/lead-importer";
import LeadsTable from "@/components/leads-table";
import LeadCommandCenter from "@/components/lead-command-center";
import OpsActivityLog from "@/components/ops-activity-log";

type AppRow = {
  id?: string;
  clinic_name: string;
  contact_name: string;
  email: string;
  city: string;
  status: string;
  created_at: string;
};

type EnquiryRow = {
  id: string;
  clinic_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
};

type OnboardingSiteRow = {
  id: string;
  domain: string;
  status: string;
  clinic_id: string | null;
  created_at: string;
};

type OnboardingClientRow = {
  id: string;
  client_name: string;
  business_name: string | null;
  contact_email: string | null;
  status: string;
  created_at: string;
};

type WidgetTokenRow = {
  id: string;
  onboarding_site_id: string;
  token: string;
  status: string;
  created_at: string;
};

type SubscriptionRow = {
  id: string;
  email: string | null;
  status: string | null;
  plan: string | null;
  updated_at: string;
};

type ClinicManagementRow = {
  onboardingClientId: string;
  clientName: string;
  businessName: string | null;
  contactEmail: string | null;
  onboardingStatus: string;
  domain: string | null;
  siteStatus: string | null;
  clinicId: string | null;
  widgetTokenActive: boolean;
  subscriptionStatus: string | null;
  subscriptionPlan: string | null;
  enquiriesCount: number;
  createdAt: string;
};

async function safeCount(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
) {
  if (!admin) return 0;

  try {
    const { count } = await admin.from(table).select("*", {
      count: "exact",
      head: true,
    });
    return count || 0;
  } catch {
    return 0;
  }
}

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const isAdminEmail =
    !!user.email && adminEmails.includes(user.email.toLowerCase());
  const isAdmin = profile?.role === "admin" || isAdminEmail;

  if (!isAdmin) {
    redirect("/portal");
  }

  let applications: AppRow[] = [];
  let source = "local_fallback";

  const admin = createAdminClient();

  if (admin) {
    const { data } = await admin
      .from("applications")
      .select("id,clinic_name,contact_name,email,city,status,created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    applications = (data as AppRow[]) || [];
    source = "supabase";
  } else {
    try {
      const file = path.join(process.cwd(), "data", "applications.jsonl");
      const txt = await readFile(file, "utf8");
      const rows = txt.trim()
        ? txt
            .trim()
            .split("\n")
            .map((l) => JSON.parse(l))
        : [];
      applications = rows.slice(-20).reverse();
    } catch {}
  }

  const [
    subCount,
    clinicCount,
    userCount,
    enquiryCount,
    onboardingClientCount,
    onboardingSiteCount,
    widgetTokenCount,
  ] = await Promise.all([
    safeCount(admin, "subscriptions"),
    safeCount(admin, "clinics"),
    safeCount(admin, "profiles"),
    safeCount(admin, "enquiries"),
    safeCount(admin, "onboarding_clients"),
    safeCount(admin, "onboarding_sites"),
    safeCount(admin, "widget_tokens"),
  ]);

  let recentEnquiries: EnquiryRow[] = [];
  let recentSites: OnboardingSiteRow[] = [];
  let clinicManagementRows: ClinicManagementRow[] = [];

  if (admin) {
    try {
      const { data } = await admin
        .from("enquiries")
        .select("id,clinic_id,name,email,phone,created_at")
        .order("created_at", { ascending: false })
        .limit(10);

      recentEnquiries = (data as EnquiryRow[]) || [];
    } catch {}

    try {
      const { data } = await admin
        .from("onboarding_sites")
        .select("id,domain,status,clinic_id,created_at")
        .order("created_at", { ascending: false })
        .limit(10);

      recentSites = (data as OnboardingSiteRow[]) || [];
    } catch {}

    try {
      const [clientsRes, sitesRes, tokensRes, subsRes, enquiriesRes] =
        await Promise.all([
          admin
            .from("onboarding_clients")
            .select(
              "id,client_name,business_name,contact_email,status,created_at",
            )
            .order("created_at", { ascending: false })
            .limit(100),
          admin
            .from("onboarding_sites")
            .select(
              "id,onboarding_client_id,domain,status,clinic_id,created_at",
            )
            .order("created_at", { ascending: false })
            .limit(200),
          admin
            .from("widget_tokens")
            .select("id,onboarding_site_id,token,status,created_at")
            .order("created_at", { ascending: false })
            .limit(200),
          admin
            .from("subscriptions")
            .select("id,email,status,plan,updated_at")
            .order("updated_at", { ascending: false })
            .limit(200),
          admin
            .from("enquiries")
            .select("id,clinic_id,created_at")
            .order("created_at", { ascending: false })
            .limit(1000),
        ]);

      const onboardingClients = (clientsRes.data ||
        []) as OnboardingClientRow[];
      const onboardingSites = (sitesRes.data || []) as Array<
        OnboardingSiteRow & { onboarding_client_id: string }
      >;
      const widgetTokens = (tokensRes.data || []) as WidgetTokenRow[];
      const subscriptions = (subsRes.data || []) as SubscriptionRow[];
      const enquiries = (enquiriesRes.data || []) as Array<{
        id: string;
        clinic_id: string;
        created_at: string;
      }>;

      const sitesByClientId = new Map<
        string,
        (OnboardingSiteRow & { onboarding_client_id: string })[]
      >();

      for (const site of onboardingSites) {
        const existing = sitesByClientId.get(site.onboarding_client_id) || [];
        existing.push(site);
        sitesByClientId.set(site.onboarding_client_id, existing);
      }

      const activeTokenSiteIds = new Set(
        widgetTokens
          .filter((token) => token.status === "active")
          .map((token) => token.onboarding_site_id),
      );

      const enquiryCountByClinicId = new Map<string, number>();
      for (const enquiry of enquiries) {
        enquiryCountByClinicId.set(
          enquiry.clinic_id,
          (enquiryCountByClinicId.get(enquiry.clinic_id) || 0) + 1,
        );
      }

      const latestSubscriptionByEmail = new Map<string, SubscriptionRow>();
      for (const sub of subscriptions) {
        const email = (sub.email || "").trim().toLowerCase();
        if (!email) continue;
        if (!latestSubscriptionByEmail.has(email)) {
          latestSubscriptionByEmail.set(email, sub);
        }
      }

      clinicManagementRows = onboardingClients.map((client) => {
        const clientSites = sitesByClientId.get(client.id) || [];
        const latestSite = clientSites[0] || null;
        const contactEmail = client.contact_email || null;
        const subscription = contactEmail
          ? latestSubscriptionByEmail.get(contactEmail.toLowerCase()) || null
          : null;

        return {
          onboardingClientId: client.id,
          clientName: client.client_name,
          businessName: client.business_name,
          contactEmail,
          onboardingStatus: client.status,
          domain: latestSite?.domain || null,
          siteStatus: latestSite?.status || null,
          clinicId: latestSite?.clinic_id || null,
          widgetTokenActive: latestSite
            ? activeTokenSiteIds.has(latestSite.id)
            : false,
          subscriptionStatus: subscription?.status || null,
          subscriptionPlan: subscription?.plan || null,
          enquiriesCount: latestSite?.clinic_id
            ? enquiryCountByClinicId.get(latestSite.clinic_id) || 0
            : 0,
          createdAt: client.created_at,
        };
      });
    } catch {
      clinicManagementRows = [];
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard (MVP)</h1>
          <p className="text-sm text-slate-600">Data source: {source}</p>
        </div>
        <LogoutButton />
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold">Admin Command Centre</h2>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Clinics</p>
            <p className="text-2xl font-semibold">{clinicCount}</p>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Portal users</p>
            <p className="text-2xl font-semibold">{userCount}</p>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Enquiries</p>
            <p className="text-2xl font-semibold">{enquiryCount}</p>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Subscriptions</p>
            <p className="text-2xl font-semibold">{subCount}</p>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Onboarding clients</p>
            <p className="text-2xl font-semibold">{onboardingClientCount}</p>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Onboarding sites</p>
            <p className="text-2xl font-semibold">{onboardingSiteCount}</p>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Widget tokens</p>
            <p className="text-2xl font-semibold">{widgetTokenCount}</p>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Applications</p>
            <p className="text-2xl font-semibold">{applications.length}</p>
            <p className="mt-1 text-xs text-slate-500">
              Showing latest {applications.length}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Clinic Management</h2>
          <p className="text-sm text-slate-600">
            One row per onboarding client so you can see setup, widget,
            subscription, and lead status in one place.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-4">Client</th>
                <th className="pr-4">Email</th>
                <th className="pr-4">Domain</th>
                <th className="pr-4">Site status</th>
                <th className="pr-4">Clinic linked</th>
                <th className="pr-4">Widget token</th>
                <th className="pr-4">Subscription</th>
                <th className="pr-4">Enquiries</th>
              </tr>
            </thead>
            <tbody>
              {clinicManagementRows.map((row) => (
                <tr
                  key={row.onboardingClientId}
                  className="border-b last:border-0"
                >
                  <td className="py-3 pr-4">
                    <div className="font-medium text-slate-900">
                      {row.businessName || row.clientName}
                    </div>
                    <div className="text-xs text-slate-500">
                      onboarding: {row.onboardingStatus}
                    </div>
                  </td>
                  <td className="pr-4 text-slate-600">
                    {row.contactEmail || "—"}
                  </td>
                  <td className="pr-4 text-slate-600">{row.domain || "—"}</td>
                  <td className="pr-4">
                    {row.siteStatus ? (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                        {row.siteStatus}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="pr-4">
                    {row.clinicId ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
                        Linked
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
                        Missing
                      </span>
                    )}
                  </td>
                  <td className="pr-4">
                    {row.widgetTokenActive ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
                        Missing
                      </span>
                    )}
                  </td>
                  <td className="pr-4">
                    {row.subscriptionStatus ? (
                      <div>
                        <div className="font-medium text-slate-900">
                          {row.subscriptionStatus}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.subscriptionPlan || "plan unknown"}
                        </div>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="pr-4 font-medium">{row.enquiriesCount}</td>
                </tr>
              ))}
              {clinicManagementRows.length === 0 && (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={8}>
                    No clinic management rows yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <OpsSummary />

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold">Recent enquiries</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2">Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Clinic</th>
                </tr>
              </thead>
              <tbody>
                {recentEnquiries.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-2">{row.name || "—"}</td>
                    <td>{row.email || "—"}</td>
                    <td>{row.phone || "—"}</td>
                    <td className="font-mono text-xs text-slate-500">
                      {row.clinic_id}
                    </td>
                  </tr>
                ))}
                {recentEnquiries.length === 0 && (
                  <tr>
                    <td className="py-3 text-slate-500" colSpan={4}>
                      No enquiries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold">
            Recent onboarding sites
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2">Domain</th>
                  <th>Status</th>
                  <th>Clinic linked</th>
                </tr>
              </thead>
              <tbody>
                {recentSites.map((site) => (
                  <tr key={site.id} className="border-b last:border-0">
                    <td className="py-2">{site.domain}</td>
                    <td>{site.status}</td>
                    <td>{site.clinic_id ? "Yes" : "No"}</td>
                  </tr>
                ))}
                {recentSites.length === 0 && (
                  <tr>
                    <td className="py-3 text-slate-500" colSpan={3}>
                      No onboarding sites yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 text-sm">
        Active/known subscriptions: <strong>{subCount || 0}</strong>
      </div>

      <LeadImporter />
      <LeadsTable />
      <LeadCommandCenter />
      <OpsActivityLog />

      <div className="rounded-xl border bg-white p-6">
        <h2 className="mb-3 text-lg font-semibold">Latest applications</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Clinic</th>
              <th>Contact</th>
              <th>Email</th>
              <th>City</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((a, i) => (
              <tr
                key={a.id || `${a.email}-${i}`}
                className="border-b last:border-0"
              >
                <td className="py-2">{a.clinic_name}</td>
                <td>{a.contact_name}</td>
                <td>{a.email}</td>
                <td>{a.city}</td>
                <td>{a.status}</td>
              </tr>
            ))}
            {applications.length === 0 && (
              <tr>
                <td className="py-3 text-slate-500" colSpan={5}>
                  No applications yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
