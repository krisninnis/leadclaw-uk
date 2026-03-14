import { createAdminClient } from "@/lib/supabase/admin";

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

  const stats = data?.[0] || {
    emails_sent: 0,
    demo_clicks: 0,
    hot_leads: 0,
    click_rate_percent: 0,
  };

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
    </div>
  );
}
