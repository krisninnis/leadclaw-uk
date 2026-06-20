import type { Metadata } from "next";
import Link from "next/link";
import SolutionsByClinicType from "@/components/seo/solutions-by-clinic-type";
import TrialCtaLink from "@/components/trial-cta-link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Industries we serve | LeadClaw",
  description:
    "LeadClaw captures website enquiries and keeps follow-up organised for UK service businesses — from aesthetic clinics and dentists to plumbers, agencies, and accountants.",
  alternates: {
    canonical: "/industries",
  },
};

export default function IndustriesIndexPage() {
  return (
    <div className="space-y-0">
      <section className="page-hero section-shell">
        <div className="container-shell">
          <div className="mx-auto max-w-3xl text-center">
            <div className="badge-soft mb-5 inline-flex">
              <span className="h-2 w-2 rounded-full bg-brand" />
              Industries we serve
            </div>
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              One way to capture every enquiry — across UK service industries
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted">
              LeadClaw works the same wherever enquiries come from: capture them
              from your website 24/7, keep them in one inbox, and follow up
              automatically. Aesthetic clinics are our flagship vertical, but the
              same approach fits dozens of other UK service businesses.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <TrialCtaLink
                href="/free-trial"
                className="button-primary"
                location="industries_hero"
              >
                Start free trial
              </TrialCtaLink>
              <Link href="/demo" className="button-secondary">
                Book a demo
              </Link>
            </div>
            <p className="mt-3 text-sm font-medium text-muted">
              7-day free trial - no card required - cancel anytime
            </p>
          </div>
        </div>
      </section>

      <SolutionsByClinicType />
    </div>
  );
}
