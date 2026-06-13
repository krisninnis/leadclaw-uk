import type { Metadata } from "next";
import Link from "next/link";
import TrialCtaLink from "@/components/trial-cta-link";

const siteUrl = "https://www.leadclaw.uk";

export const metadata: Metadata = {
  title: "Resources - AI Receptionist Guides for UK Businesses | LeadClaw",
  description:
    "Guides and resources on AI receptionists, missed-call recovery, and lead capture for UK service businesses, plus how LeadClaw works for your industry.",
  alternates: { canonical: "/resources" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: `${siteUrl}/resources`,
    siteName: "LeadClaw",
    title: "Resources - AI Receptionist Guides for UK Businesses | LeadClaw",
    description:
      "Guides and resources on AI receptionists, missed-call recovery, and lead capture for UK service businesses.",
  },
};

const sections = [
  {
    title: "Get started",
    links: [
      { href: "/how-it-works", label: "How LeadClaw works" },
      { href: "/demo", label: "Book a demo" },
      { href: "/pricing", label: "Plans & pricing" },
      { href: "/help", label: "Help & support" },
    ],
  },
  {
    title: "By industry",
    links: [
      { href: "/ai-receptionist-for-dentists-uk", label: "AI receptionist for dentists" },
      { href: "/ai-receptionist-for-aesthetic-clinics-uk", label: "AI receptionist for aesthetic clinics" },
      { href: "/ai-receptionist-for-physiotherapists-uk", label: "AI receptionist for physiotherapists" },
      { href: "/ai-receptionist-for-chiropractors-uk", label: "AI receptionist for chiropractors" },
      { href: "/ai-receptionist-for-vets-uk", label: "AI receptionist for vets" },
      { href: "/ai-receptionist-for-plumbers-uk", label: "AI receptionist for plumbers" },
      { href: "/ai-receptionist-for-electricians-uk", label: "AI receptionist for electricians" },
      { href: "/ai-receptionist-for-roofers-uk", label: "AI receptionist for roofers" },
      { href: "/ai-receptionist-for-locksmiths-uk", label: "AI receptionist for locksmiths" },
      { href: "/ai-receptionist-for-garages-uk", label: "AI receptionist for garages" },
      { href: "/ai-receptionist-for-cleaning-companies-uk", label: "AI receptionist for cleaning companies" },
      { href: "/ai-receptionist-for-estate-agents-uk", label: "AI receptionist for estate agents" },
      { href: "/ai-receptionist-for-accountants-uk", label: "AI receptionist for accountants" },
      { href: "/ai-receptionist-for-law-firms-uk", label: "AI receptionist for law firms" },
    ],
  },
  {
    title: "Topics",
    links: [
      { href: "/ai-receptionist-uk", label: "What is an AI receptionist?" },
      { href: "/seo/missed-call-recovery-uk", label: "Missed-call recovery for UK businesses" },
      { href: "/compare", label: "Compare AI receptionist options" },
    ],
  },
];

export default function ResourcesPage() {
  return (
    <div className="space-y-12">
      <section className="section-shell pb-0">
        <div className="container-shell max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
            Resources
          </p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Guides for never missing another enquiry
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted">
            Practical resources on AI receptionists, missed-call recovery, and
            lead capture for UK service businesses - plus how LeadClaw works for
            your industry.
          </p>
        </div>
      </section>

      <section className="section-shell pt-0">
        <div className="container-shell grid gap-6 md:grid-cols-3">
          {sections.map((section) => (
            <div key={section.title} className="card-premium p-6">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {section.title}
              </h2>
              <ul className="mt-4 space-y-3">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="section-shell pt-0">
        <div className="container-shell">
          <div className="card-premium p-6 md:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Ready to try LeadClaw?
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
              Start a 7-day free trial - no card required, cancel anytime.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <TrialCtaLink href="/free-trial" className="button-primary" location="resources_cta">
                Start free trial
              </TrialCtaLink>
              <Link href="/demo" className="button-secondary">
                Book a demo
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
