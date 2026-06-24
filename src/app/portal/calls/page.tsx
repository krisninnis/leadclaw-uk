import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SectionHeading } from "@/components/ui";
import { hasFullLeadClawAccess } from "@/lib/subscription-access";

// Minimal, read-only Phase 1 surface for Missed Call Recovery.
// Reachable at /portal/calls. A nav link can be added later; kept isolated for
// now so no existing portal files are modified.

type SubscriptionStatusRow = { status: string | null };
type IdRow = { id: string };
type ClinicIdRow = { clinic_id: string | null };

type MissedCallRow = {
  id: string;
  from_e164: string | null;
  status: string | null;
  occurred_at: string | null;
};

type ConversationRow = {
  id: string;
  customer_e164: string | null;
  status: string | null;
  last_message_at: string | null;
  enquiry_id: string | null;
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(status: string | null): string {
  const base =
    "inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize";
  switch (status) {
    case "missed":
    case "awaiting_reply":
      return `${base} bg-amber-100 text-amber-800`;
    case "replied":
    case "recovered":
      return `${base} bg-emerald-100 text-emerald-800`;
    case "requiring_review":
      return `${base} bg-rose-100 text-rose-700`;
    case "opted_out":
      return `${base} bg-slate-200 text-slate-700`;
    default:
      return `${base} bg-slate-100 text-slate-600`;
  }
}

export default async function PortalCallsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: sub } = await (supabase as unknown as SupabaseUntypedClient)
    .from("subscriptions")
    .select("status")
    .eq("email", user.email || "")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!hasFullLeadClawAccess((sub as SubscriptionStatusRow | null)?.status)) {
    redirect("/portal/billing");
  }

  const admin = createAdminClient({ optional: true });

  let missedCalls: MissedCallRow[] = [];
  let conversations: ConversationRow[] = [];
  let clinicId: string | null = null;

  if (admin && user.email) {
    const adminClient = admin as unknown as SupabaseUntypedClient;

    const { data: client } = await adminClient
      .from("onboarding_clients")
      .select("id")
      .eq("contact_email", user.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const onboardingClient = client as IdRow | null;

    if (onboardingClient?.id) {
      const { data: site } = await adminClient
        .from("onboarding_sites")
        .select("clinic_id")
        .eq("onboarding_client_id", onboardingClient.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      clinicId = (site as ClinicIdRow | null)?.clinic_id ?? null;
    }

    if (clinicId) {
      const { data: callRows } = await adminClient
        .from("missed_calls")
        .select("id,from_e164,status,occurred_at")
        .eq("clinic_id", clinicId)
        .order("occurred_at", { ascending: false })
        .limit(50);
      missedCalls = (callRows as MissedCallRow[] | null) || [];

      const { data: convoRows } = await adminClient
        .from("sms_conversations")
        .select("id,customer_e164,status,last_message_at,enquiry_id")
        .eq("clinic_id", clinicId)
        .order("last_message_at", { ascending: false })
        .limit(50);
      conversations = (convoRows as ConversationRow[] | null) || [];
    }
  }

  return (
    <div className="space-y-6">
      <div className="card-premium p-6 md:p-8">
        <SectionHeading
          eyebrow="Missed call recovery"
          title="Calls & text-backs"
          description="Calls you missed, the automatic SMS we sent, and replies we turned into leads."
          maxWidth="lg"
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-[22px] border border-border bg-white p-5">
            <p className="text-sm font-medium text-muted">Missed calls</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {missedCalls.length}
            </p>
          </div>
          <div className="rounded-[22px] border border-border bg-white p-5">
            <p className="text-sm font-medium text-muted">Conversations</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {conversations.length}
            </p>
          </div>
          <div className="rounded-[22px] border border-border bg-white p-5">
            <p className="text-sm font-medium text-muted">Replied (leads)</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-600">
              {conversations.filter((c) => c.enquiry_id).length}
            </p>
          </div>
        </div>
      </div>

      <div className="card-premium p-6 md:p-8">
        <SectionHeading eyebrow="Calls" title="Recent missed calls" maxWidth="md" />
        {missedCalls.length > 0 ? (
          <div className="mt-6 overflow-hidden rounded-[24px] border border-border">
            <div className="grid grid-cols-[1.4fr_1fr_1fr] border-b border-border bg-surface-2 px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-2">
              <div>Caller</div>
              <div>Status</div>
              <div>When</div>
            </div>
            {missedCalls.map((call) => (
              <div
                key={call.id}
                className="grid grid-cols-[1.4fr_1fr_1fr] items-center border-b border-border px-5 py-3 text-sm last:border-0"
              >
                <div className="text-foreground">{call.from_e164 || "Withheld"}</div>
                <div>
                  <span className={statusBadge(call.status)}>
                    {(call.status || "").replace(/_/g, " ")}
                  </span>
                </div>
                <div className="text-muted">{formatDateTime(call.occurred_at)}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted">
            No missed calls recorded yet. Once your number is connected, missed
            calls will appear here.
          </p>
        )}
      </div>

      <div className="card-premium p-6 md:p-8">
        <SectionHeading
          eyebrow="Text-backs"
          title="SMS conversations"
          maxWidth="md"
        />
        {conversations.length > 0 ? (
          <div className="mt-6 overflow-hidden rounded-[24px] border border-border">
            <div className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr] border-b border-border bg-surface-2 px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-2">
              <div>Customer</div>
              <div>Status</div>
              <div>Last message</div>
              <div>Lead</div>
            </div>
            {conversations.map((convo) => (
              <div
                key={convo.id}
                className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr] items-center border-b border-border px-5 py-3 text-sm last:border-0"
              >
                <div className="text-foreground">
                  {convo.customer_e164 || "—"}
                </div>
                <div>
                  <span className={statusBadge(convo.status)}>
                    {(convo.status || "").replace(/_/g, " ")}
                  </span>
                </div>
                <div className="text-muted">
                  {formatDateTime(convo.last_message_at)}
                </div>
                <div className="text-muted">{convo.enquiry_id ? "Yes" : "—"}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted">
            No SMS conversations yet.
          </p>
        )}
      </div>
    </div>
  );
}
