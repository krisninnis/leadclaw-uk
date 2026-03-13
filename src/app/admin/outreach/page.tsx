import { createAdminClient } from "@/lib/supabase/admin";

export default async function OutreachDashboard() {
  const admin = createAdminClient();

  if (!admin) {
    return <div className="p-10">Supabase not configured</div>;
  }

  const { data: events } = await admin
    .from("outreach_events")
    .select("event_type, lead_id");

  const rows = events || [];

  const emailsSent = rows.filter((r) => r.event_type === "sent").length;

  const demoClicks = rows.filter((r) => r.event_type === "demo_visit").length;

  const hotLeadIds = new Set(
    rows
      .filter((r) => r.event_type === "demo_visit" && r.lead_id)
      .map((r) => r.lead_id),
  );

  const clickRatePercent =
    emailsSent > 0 ? ((demoClicks / emailsSent) * 100).toFixed(2) : "0.00";

  const { data: leads } = await admin
    .from("leads")
    .select("id, company_name, city, contact_email, contact_phone, website")
    .in("id", Array.from(hotLeadIds));

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
          <div className="text-3xl font-semibold">{hotLeadIds.size}</div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Click Rate</div>
          <div className="text-3xl font-semibold">{clickRatePercent}%</div>
        </div>
      </div>

      {/* HOT LEADS */}

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">🔥 Hot Leads</h2>
          <p className="text-sm text-slate-500">
            Clinics that clicked your demo
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-6 py-3">Clinic</th>
                <th className="px-6 py-3">City</th>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {leads?.map((lead) => (
                <tr key={lead.id} className="border-t bg-red-50/40">
                  <td className="px-6 py-3 font-semibold">
                    {lead.company_name || "-"}
                  </td>

                  <td className="px-6 py-3">{lead.city || "-"}</td>

                  <td className="px-6 py-3">
                    {lead.contact_email || lead.contact_phone || "-"}
                  </td>

                  <td className="px-6 py-3 space-x-4">
                    {lead.contact_phone && (
                      <a
                        href={`tel:${lead.contact_phone}`}
                        className="text-blue-600 hover:underline"
                      >
                        📞 Call
                      </a>
                    )}

                    {lead.contact_email && (
                      <a
                        href={`mailto:${lead.contact_email}`}
                        className="text-blue-600 hover:underline"
                      >
                        ✉ Email
                      </a>
                    )}

                    {lead.website && (
                      <a
                        href={lead.website}
                        target="_blank"
                        className="text-blue-600 hover:underline"
                      >
                        🌐 Site
                      </a>
                    )}
                  </td>
                </tr>
              ))}

              {!leads?.length && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-10 text-center text-slate-500"
                  >
                    No hot leads yet
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
