import { createAdminClient } from "@/lib/supabase/admin";

type HotDemoLead = {
  id: string;
  company_name: string | null;
  city: string | null;
  contact_email: string | null;
  website: string | null;
  updated_at: string | null;
};

type OutreachEventRow = {
  event_type: string | null;
  lead_id: string | null;
};

export default async function OutreachDashboard() {
  const admin = createAdminClient();

  if (!admin) {
    return <div className="p-10">Supabase not configured</div>;
  }

  const { data: outreachEvents } = await admin
    .from("outreach_events")
    .select("event_type, lead_id")
    .in("event_type", ["sent", "demo_visit"])
    .limit(10000);

  const events = (outreachEvents || []) as OutreachEventRow[];
  const emailsSent = events.filter(
    (event) => event.event_type === "sent",
  ).length;
  const demoClicks = events.filter(
    (event) => event.event_type === "demo_visit",
  ).length;
  const hotLeadIds = new Set(
    events
      .filter((event) => event.event_type === "demo_visit" && event.lead_id)
      .map((event) => event.lead_id),
  );

  const clickRate =
    emailsSent > 0 ? Number(((demoClicks / emailsSent) * 100).toFixed(2)) : 0;

  const { data: hotDemoLeads } = await admin
    .from("leads")
    .select("id, company_name, city, contact_email, website, updated_at")
    .eq("status", "hot_demo")
    .order("updated_at", { ascending: false })
    .limit(10);

  const stats = {
    emails_sent: emailsSent,
    demo_clicks: demoClicks,
    hot_leads: hotLeadIds.size,
    click_rate_percent: clickRate,
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
            Workspaces that viewed a personalised demo with a live widget.
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
                  <th className="px-6 py-3">Workspace</th>
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
