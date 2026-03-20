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
          description="Contact LeadClaw for onboarding, install help, billing questions, bug reports, or anything affecting your clinic setup."
          maxWidth="lg"
        />

        <div className="mt-6 rounded-[24px] border border-sky-200 bg-sky-50 p-5">
          <h2 className="text-lg font-semibold text-sky-950">
            Built with real clinic feedback
          </h2>
          <p className="mt-2 text-sm leading-7 text-sky-900">
            LeadClaw is an early-stage product built closely with real clinic
            feedback. If you spot an issue, want something improved, or have an
            idea that would make the platform more useful for your clinic, send
            us a message here. We review every report carefully and ship
            improvements continuously.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              Use support for billing questions, upgrades, subscription access,
              or payment-related issues.
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

          <div className="rounded-[22px] border border-border bg-white p-5">
            <p className="text-sm font-medium text-muted">Product feedback</p>
            <p className="mt-2 text-base font-semibold text-foreground">
              Found an issue or want something improved?
            </p>
            <p className="mt-2 text-sm leading-7 text-muted">
              Report bugs, request features, or tell us what would make LeadClaw
              better for your clinic.
            </p>
            <div className="mt-4">
              <a href="#support-chat" className="button-secondary">
                Send feedback
              </a>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-[24px] border border-border bg-white p-5">
          <h2 className="text-lg font-semibold text-foreground">
            How to get faster help
          </h2>
          <p className="mt-2 text-xs text-muted">
            We aim to review messages as quickly as possible. Urgent billing or
            access issues are prioritised.
          </p>
          <div className="mt-3 space-y-2 text-sm leading-7 text-muted">
            <p>
              Include your clinic name and the page where the issue happened.
            </p>
            <p>
              Tell us what you expected to happen and what happened instead.
            </p>
            <p>
              If possible, include a screenshot so we can review it more
              quickly.
            </p>
            <p>
              Urgent billing or account-access issues should be mentioned
              clearly in your message.
            </p>
          </div>
        </div>
      </div>

      <div id="support-chat">
        <PortalChat />
      </div>
    </div>
  );
}
