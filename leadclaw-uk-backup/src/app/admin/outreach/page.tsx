import { createAdminClient } from "@/lib/supabase/admin";

type HotDemoLead = {
  id: string;
  company_name: string | null;
  city: string | null;
  contact_email: string | null;
  website: string | null;
  updated_at: string | null;
};

export default async function OutreachDashboard() {
  const admin = createAdminClient();

  if (!admin) {
    return <div className="p-10">Supabase not configured</div>;
  }

  const { data } = await admin.rpc("query", {
    sql: `
      select
        count(*) filter (where event_type = 'sent') as emails_sent,
        count(*) filter (where event_type = 'demo_visit') as demo_clicks,
        count(distinct lead_id) filter (where event_type = 'demo_visit') as hot_leads,
        round(
          (
            count(*) filter (where event_type = 'demo_visit')::numeric
            / nullif(count(*) filter (where event_type = 'sent'), 0)
          ) * 100,
          2
        ) as click_rate_percent
      from outreach_events
    `,
  });

  const { data: hotDemoLeads } = await admin
    .from("leads")
    .select("id, company_name, city, contact_email, website, updated_at")
    .eq("status", "hot_demo")
    .order("updated_at", { ascending: false })
    .limit(10);

  const stats = data?.[0] || {
    emails_sent: 0,
    demo_clicks: 0,
    hot_leads: 0,
    click_rate_percent: 0,
  };

  const leads = (hotDemoLeads || []) as HotDemoLead[];

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="mb-8 text-3xl font-bold">LeadClaw Outreach Dashboard</h1>

      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Emails Sent</div>
          <div className="text-3xl font-semibold">{stats.emails_sent}</div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Demo Clicks</div>
          <div className="text-3xl font-semibold">{stats.demo_clicks}</div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Hot Leads</div>
          <div className="text-3xl font-semibold">{stats.hot_leads}</div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Click Rate</div>
          <div className="text-3xl font-semibold">
            {stats.click_rate_percent}%
          </div>
        </div>
      </div>

      <div className="mt-10 rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-950">
            Hot Demo Leads
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Clinics that viewed a personalised demo with a live widget.
          </p>
        </div>

        {leads.length === 0 ? (
          <div className="px-6 py-8 text-sm text-slate-500">
            No hot demo leads yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-6 py-3">Clinic</th>
                  <th className="px-6 py-3">City</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Website</th>
                  <th className="px-6 py-3">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-t">
                    <td className="px-6 py-3 font-medium text-slate-900">
                      {lead.company_name || "-"}
                    </td>
                    <td className="px-6 py-3 text-slate-700">
                      {lead.city || "-"}
                    </td>
                    <td className="px-6 py-3 text-slate-700">
                      {lead.contact_email || "-"}
                    </td>
                    <td className="px-6 py-3 text-slate-700">
                      {lead.website ? (
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Open site
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-700">
                      {lead.updated_at
                        ? new Date(lead.updated_at).toLocaleString("en-GB", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
