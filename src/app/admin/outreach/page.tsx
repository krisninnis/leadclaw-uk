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
  const demoClicks = rows.filter((row) => row.event_type === "demo_visit").length;
  const hotLeads = new Set(
    rows
      .filter((row) => row.event_type === "demo_visit" && row.lead_id)
      .map((row) => row.lead_id),
  ).size;

  const clickRatePercent =
    emailsSent > 0 ? ((demoClicks / emailsSent) * 100).toFixed(2) : "0.00";

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="mb-8 text-3xl font-bold">LeadClaw Outreach Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-4">
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
          <div className="text-3xl font-semibold">{hotLeads}</div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Click Rate</div>
          <div className="text-3xl font-semibold">{clickRatePercent}%</div>
        </div>
      </div>
    </div>
  );
}
