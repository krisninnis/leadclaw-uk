import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SectionHeading } from "@/components/ui";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default async function PortalActivityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();

  let trialEnd: string | null = null;
  let subscriptionUpdatedAt: string | null = null;
  let widgetLastSeenAt: string | null = null;
  let widgetLastSeenDomain: string | null = null;
  let latestLeads: Array<{
    id: string;
    name: string | null;
    created_at: string | null;
    status: string | null;
  }> = [];

  if (admin && user.email) {
    const { data: subscription } = await admin
      .from("subscriptions")
      .select("trial_end,updated_at")
      .eq("email", user.email || "")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    trialEnd = subscription?.trial_end || null;
    subscriptionUpdatedAt = subscription?.updated_at || null;

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
        .select("id,clinic_id")
        .eq("onboarding_client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (site?.id) {
        const { data: tokenRow } = await admin
          .from("widget_tokens")
          .select("last_seen_at,last_seen_domain")
          .eq("onboarding_site_id", site.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        widgetLastSeenAt = tokenRow?.last_seen_at || null;
        widgetLastSeenDomain = tokenRow?.last_seen_domain || null;
      }

      if (site?.clinic_id) {
        const { data: enquiries } = await admin
          .from("enquiries")
          .select("id,name,created_at,status")
          .eq("clinic_id", site.clinic_id)
          .order("created_at", { ascending: false })
          .limit(10);

        latestLeads =
          (enquiries as Array<{
            id: string;
            name: string | null;
            created_at: string | null;
            status: string | null;
          }> | null) || [];
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="card-premium p-6 md:p-8">
        <SectionHeading
          eyebrow="Activity"
          title="Recent workspace activity"
          description="A timeline view of the latest important events in your LeadClaw setup."
          maxWidth="lg"
        />

        <div className="mt-6 space-y-4">
          <div className="rounded-[22px] border border-border bg-white p-5">
            <p className="text-sm font-medium text-muted">
              Subscription updated
            </p>
            <p className="mt-2 text-base font-semibold text-foreground">
              {formatDateTime(subscriptionUpdatedAt)}
            </p>
          </div>

          <div className="rounded-[22px] border border-border bg-white p-5">
            <p className="text-sm font-medium text-muted">Trial end date</p>
            <p className="mt-2 text-base font-semibold text-foreground">
              {formatDateTime(trialEnd)}
            </p>
          </div>

          <div className="rounded-[22px] border border-border bg-white p-5">
            <p className="text-sm font-medium text-muted">Widget last seen</p>
            <p className="mt-2 text-base font-semibold text-foreground">
              {formatDateTime(widgetLastSeenAt)}
            </p>
            <p className="mt-2 text-sm text-muted">
              Domain: {widgetLastSeenDomain || "No live detection yet"}
            </p>
          </div>
        </div>
      </div>

      <div className="card-premium p-6 md:p-8">
        <SectionHeading
          eyebrow="Lead timeline"
          title="Latest enquiries"
          description="Your most recent lead activity appears here for a quick operational view."
          maxWidth="md"
        />

        {latestLeads.length > 0 ? (
          <div className="mt-6 space-y-3">
            {latestLeads.map((lead) => (
              <div
                key={lead.id}
                className="rounded-[22px] border border-border bg-white p-5"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-foreground">
                      {lead.name || "Unnamed enquiry"}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      Received {formatDateTime(lead.created_at)}
                    </p>
                  </div>

                  <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-medium text-muted">
                    {String(lead.status || "new")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[24px] border border-dashed border-border bg-surface-2 p-6 text-sm text-muted">
            <p className="font-medium text-foreground">No activity yet</p>
            <p className="mt-2 leading-7">
              Once your widget is live and enquiries start coming in, this
              timeline will show the latest lead activity here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
