import { createAdminClient } from "@/lib/supabase/admin";

export default async function OutreachDashboard() {
  const admin = createAdminClient();

  if (!admin) {
    return <div className="p-10">Supabase not configured</div>;
  }

  const { data: events, error } = await admin
    .from("outreach_events")
    .select("event_type, lead_id");

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="mb-8 text-3xl font-bold">LeadClaw Outreach Dashboard</h1>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900">
          Failed to load outreach data.
        </div>
      </div>
    );
  }

  const rows = events || [];

  const emailsSent = rows.filter((row) => row.event_type === "sent").length;

  const demoClicks = rows.filter(
    (row) => row.event_type === "demo_visit",
  ).length;

  const hotLeadIds = new Set(
    rows
      .filter((row) => row.event_type === "demo_visit" && row.lead_id)
      .map((row) => row.lead_id),
  );

  const hotLeads = Array.from(hotLeadIds);

  const clickRatePercent =
    emailsSent > 0 ? ((demoClicks / emailsSent) * 100).toFixed(2) : "0.00";

  const { data: leadRows } = await admin
    .from("leads")
    .select("id, company_name, city, contact_email, contact_phone")
    .in("id", hotLeads);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="mb-8 text-3xl font-bold">LeadClaw Outreach Dashboard</h1>

      {/* KPI cards */}

      <div className="grid gap-6 md:grid-cols-4 mb-12">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Emails Sent</div>
          <div className="text-3xl font-semibold">{emailsSent}</div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Demo Clicks</div>
          <div className="text-3xl font-semibold">{demoClicks}</div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Hot Leads</div>
          <div className="text-3xl font-semibold">{hotLeads.length}</div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Click Rate</div>
          <div className="text-3xl font-semibold">{clickRatePercent}%</div>
        </div>
      </div>

      {/* Hot Leads Table */}

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Hot Leads</h2>
          <p className="text-sm text-slate-500">
            Clinics that clicked the demo link
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-6 py-3">Clinic</th>
                <th className="px-6 py-3">City</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Phone</th>
              </tr>
            </thead>

            <tbody>
              {leadRows?.map((lead) => (
                <tr key={lead.id} className="border-t">
                  <td className="px-6 py-3 font-medium">
                    {lead.company_name || "-"}
                  </td>
                  <td className="px-6 py-3">{lead.city || "-"}</td>
                  <td className="px-6 py-3">{lead.contact_email || "-"}</td>
                  <td className="px-6 py-3">{lead.contact_phone || "-"}</td>
                </tr>
              ))}

              {!leadRows?.length && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    No demo clicks yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
