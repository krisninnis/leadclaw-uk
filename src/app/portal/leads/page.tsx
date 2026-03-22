import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SectionHeading } from "@/components/ui";
import { hasFullLeadClawAccess } from "@/lib/subscription-access";
import {
  ENQUIRY_STATUS_OPTIONS,
  formatDateTime,
  normalizeEnquiryStatus,
  statusBadgeClasses,
  statusLabel,
  updateEnquiryStatus,
  updateEnquiryNotes,
  type EnquiryRow,
} from "../_lib/shared";

export default async function PortalLeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, plan")
    .eq("email", user.email || "")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!hasFullLeadClawAccess(sub?.status)) {
    redirect("/portal/billing");
  }

  const admin = createAdminClient();

  let hasActiveSubscription = false;
  let enquiries: EnquiryRow[] = [];

  if (admin) {
    const { data: subscription } = await admin
      .from("subscriptions")
      .select("status")
      .eq("email", user.email || "")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const rawSubscriptionStatus = String(
      subscription?.status || "",
    ).toLowerCase();
    hasActiveSubscription = ["trialing", "active", "past_due"].includes(
      rawSubscriptionStatus,
    );

    if (user.email) {
      const { data: client } = await admin
        .from("onboarding_clients")
        .select("id")
        .eq("contact_email", user.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (client?.id && hasActiveSubscription) {
        const { data: site } = await admin
          .from("onboarding_sites")
          .select("clinic_id")
          .eq("onboarding_client_id", client.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (site?.clinic_id) {
          const { data: enquiryRows } = await admin
            .from("enquiries")
            .select("id,name,email,phone,status,service,notes,created_at")
            .eq("clinic_id", site.clinic_id)
            .order("created_at", { ascending: false })
            .limit(100);

          enquiries = (enquiryRows as EnquiryRow[] | null) || [];
        }
      }
    }
  }

  const newLeadsCount = enquiries.filter(
    (enquiry) => normalizeEnquiryStatus(enquiry.status) === "new",
  ).length;

  const contactedLeadsCount = enquiries.filter(
    (enquiry) => normalizeEnquiryStatus(enquiry.status) === "contacted",
  ).length;

  const bookedLeadsCount = enquiries.filter(
    (enquiry) => normalizeEnquiryStatus(enquiry.status) === "booked",
  ).length;

  const lostLeadsCount = enquiries.filter(
    (enquiry) => normalizeEnquiryStatus(enquiry.status) === "lost",
  ).length;

  return (
    <div className="space-y-6">
      <div className="card-premium p-6 md:p-8">
        <SectionHeading
          eyebrow="Lead inbox"
          title="Manage your enquiries"
          description="View, update, and track the latest leads captured through your LeadClaw widget."
          maxWidth="lg"
        />

        {hasActiveSubscription ? (
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-[22px] border border-border bg-white p-5">
              <p className="text-sm font-medium text-muted">Total enquiries</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {enquiries.length}
              </p>
            </div>

            <div className="rounded-[22px] border border-border bg-white p-5">
              <p className="text-sm font-medium text-muted">New enquiries</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {newLeadsCount}
              </p>
            </div>

            <div className="rounded-[22px] border border-border bg-white p-5">
              <p className="text-sm font-medium text-muted">Booked enquiries</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {bookedLeadsCount}
              </p>
            </div>

            <div className="rounded-[22px] border border-border bg-white p-5">
              <p className="text-sm font-medium text-muted">Lost enquiries</p>
              <p className="mt-2 text-2xl font-semibold text-rose-500">
                {lostLeadsCount}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="card-premium p-6 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            eyebrow="Enquiries"
            title="Latest leads"
            description="Keep your follow-up organised and update lead status as you work through your inbox."
            maxWidth="md"
          />

          {hasActiveSubscription ? (
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-muted shadow-sm">
                {enquiries.length} total
              </span>
              <span className="rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-muted shadow-sm">
                {contactedLeadsCount} contacted
              </span>
            </div>
          ) : null}
        </div>

        {hasActiveSubscription ? (
          enquiries.length > 0 ? (
            <>
              <div className="mt-6 hidden overflow-hidden rounded-[24px] border border-border lg:block">
                <div className="grid grid-cols-[1fr_1fr_0.9fr_1fr_1fr_1.2fr_1fr] border-b border-border bg-surface-2 px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted-2">
                  <div>Name</div>
                  <div>Email</div>
                  <div>Phone</div>
                  <div>Enquiry</div>
                  <div>Status</div>
                  <div>Notes</div>
                  <div>Received</div>
                </div>

                {enquiries.map((enquiry) => {
                  const status = normalizeEnquiryStatus(enquiry.status);

                  return (
                    <div
                      key={enquiry.id}
                      className="grid grid-cols-[1fr_1fr_0.9fr_1fr_1fr_1.2fr_1fr] items-start border-b border-border bg-white px-5 py-4 last:border-b-0"
                    >
                      <div className="pr-4 font-medium text-foreground">
                        {enquiry.name || "—"}
                      </div>

                      <div className="pr-4 text-sm text-muted">
                        {enquiry.email || "—"}
                      </div>

                      <div className="pr-4 text-sm text-muted">
                        {enquiry.phone || "—"}
                      </div>

                      <div className="pr-4 text-sm text-muted">
                        {enquiry.service || "—"}
                      </div>

                      <div className="pr-4">
                        <div className="flex flex-col gap-2">
                          <span
                            className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusBadgeClasses(
                              status,
                            )}`}
                          >
                            {status}
                          </span>
                          <form
                            action={updateEnquiryStatus}
                            className="flex flex-col gap-2"
                          >
                            <input
                              type="hidden"
                              name="enquiryId"
                              value={enquiry.id}
                            />
                            <select
                              name="status"
                              defaultValue={status}
                              className="rounded-xl border border-border bg-white px-3 py-2 text-xs text-foreground outline-none transition focus:border-brand"
                            >
                              {ENQUIRY_STATUS_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {statusLabel(option)}
                                </option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              className="inline-flex w-fit items-center justify-center rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:-translate-y-0.5"
                            >
                              Update
                            </button>
                          </form>
                        </div>
                      </div>

                      <div className="pr-4">
                        <form
                          action={updateEnquiryNotes}
                          className="flex flex-col gap-2"
                        >
                          <input
                            type="hidden"
                            name="enquiryId"
                            value={enquiry.id}
                          />
                          <textarea
                            name="notes"
                            defaultValue={enquiry.notes || ""}
                            placeholder="Add notes..."
                            rows={2}
                            className="rounded-xl border border-border bg-white px-3 py-2 text-xs text-foreground outline-none transition focus:border-brand resize-none w-full"
                          />
                          <button
                            type="submit"
                            className="inline-flex w-fit items-center justify-center rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:-translate-y-0.5"
                          >
                            Save note
                          </button>
                        </form>
                      </div>

                      <div className="text-sm text-muted">
                        {formatDateTime(enquiry.created_at)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 grid gap-4 lg:hidden">
                {enquiries.map((enquiry) => {
                  const status = normalizeEnquiryStatus(enquiry.status);

                  return (
                    <div
                      key={`${enquiry.id}-mobile`}
                      className="rounded-[22px] border border-border bg-white p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-foreground">
                            {enquiry.name || "—"}
                          </h3>
                          <p className="mt-1 text-sm text-muted">
                            {enquiry.email || "—"}
                          </p>
                          <p className="mt-1 text-sm text-muted">
                            {enquiry.phone || "—"}
                          </p>
                          {enquiry.service && (
                            <p className="mt-1 text-sm font-medium text-brand-strong">
                              {enquiry.service}
                            </p>
                          )}
                        </div>

                        <span
                          className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusBadgeClasses(
                            status,
                          )}`}
                        >
                          {status}
                        </span>
                      </div>

                      <div className="mt-4">
                        <form
                          action={updateEnquiryStatus}
                          className="flex flex-col gap-2 sm:flex-row sm:items-center"
                        >
                          <input
                            type="hidden"
                            name="enquiryId"
                            value={enquiry.id}
                          />
                          <select
                            name="status"
                            defaultValue={status}
                            className="rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand"
                          >
                            {ENQUIRY_STATUS_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {statusLabel(option)}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5"
                          >
                            Update
                          </button>
                        </form>
                      </div>

                      <div className="mt-4">
                        <form
                          action={updateEnquiryNotes}
                          className="flex flex-col gap-2"
                        >
                          <input
                            type="hidden"
                            name="enquiryId"
                            value={enquiry.id}
                          />
                          <textarea
                            name="notes"
                            defaultValue={enquiry.notes || ""}
                            placeholder="Add notes..."
                            rows={2}
                            className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand resize-none"
                          />
                          <button
                            type="submit"
                            className="inline-flex w-fit items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5"
                          >
                            Save note
                          </button>
                        </form>
                      </div>

                      <p className="mt-4 text-sm text-muted">
                        Received: {formatDateTime(enquiry.created_at)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="mt-6 rounded-[24px] border border-dashed border-border bg-surface-2 p-6 text-sm text-muted">
              <p className="font-medium text-foreground">No live leads yet</p>
              <p className="mt-2 leading-7">
                Once your widget is installed and visitors start submitting
                enquiries, they will appear here.
              </p>
            </div>
          )
        ) : (
          <div className="mt-6 rounded-[24px] border border-dashed border-border bg-surface-2 p-6 text-sm text-muted">
            <p className="font-medium text-foreground">Lead inbox locked</p>
            <p className="mt-2 leading-7">
              Reactivate or upgrade your package to view and manage live
              enquiries.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
