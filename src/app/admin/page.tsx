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
