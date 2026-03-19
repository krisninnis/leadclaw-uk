import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PortalChat from "@/components/portal-chat";
import { SectionHeading } from "@/components/ui";

export default async function PortalSupportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div className="card-premium p-6 md:p-8">
        <SectionHeading
          eyebrow="Support"
          title="Get help inside your clinic workspace"
          description="Contact LeadClaw for onboarding, install help, billing questions, or anything affecting your clinic setup."
          maxWidth="lg"
        />

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[22px] border border-border bg-white p-5">
            <p className="text-sm font-medium text-muted">Widget help</p>
            <p className="mt-2 text-base font-semibold text-foreground">
              Need install support?
            </p>
            <p className="mt-2 text-sm leading-7 text-muted">
              Ask us to check your widget setup, live detection, or install
              placement.
            </p>
            <div className="mt-4">
              <Link href="/portal/install" className="button-secondary">
                Open install page
              </Link>
            </div>
          </div>

          <div className="rounded-[22px] border border-border bg-white p-5">
            <p className="text-sm font-medium text-muted">Billing help</p>
            <p className="mt-2 text-base font-semibold text-foreground">
              Questions about your plan?
            </p>
            <p className="mt-2 text-sm leading-7 text-muted">
              Use support for billing questions, upgrades, or access issues with
              your subscription.
            </p>
            <div className="mt-4">
              <Link href="/portal/billing" className="button-secondary">
                Open billing page
              </Link>
            </div>
          </div>

          <div className="rounded-[22px] border border-border bg-white p-5">
            <p className="text-sm font-medium text-muted">Lead follow-up</p>
            <p className="mt-2 text-base font-semibold text-foreground">
              Need help with enquiries?
            </p>
            <p className="mt-2 text-sm leading-7 text-muted">
              Ask for help understanding lead statuses, workflow, or what to do
              next with your captured enquiries.
            </p>
            <div className="mt-4">
              <Link href="/portal/leads" className="button-secondary">
                Open leads page
              </Link>
            </div>
          </div>
        </div>
      </div>

      <PortalChat />
    </div>
  );
}
