import type { Metadata } from "next";
import Link from "next/link";
import TrialCtaLink from "@/components/trial-cta-link";

const siteUrl = "https://www.leadclaw.uk";

export const metadata: Metadata = {
  title: "Compare AI Receptionist Options for UK Businesses | LeadClaw",
  description:
    "How LeadClaw compares to other AI receptionists, human answering services, DIY voice-AI tools, and doing nothing. See which option fits a UK service business.",
  alternates: { canonical: "/compare" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: `${siteUrl}/compare`,
    siteName: "LeadClaw",
    title: "Compare AI Receptionist Options for UK Businesses | LeadClaw",
    description:
      "How LeadClaw compares to other AI receptionists, human answering services, DIY voice-AI tools, and doing nothing.",
  },
};

const options = [
  {
    name: "LeadClaw",
    best: "UK service businesses that want enquiries answered and followed up without big setup.",
    notes:
      "24/7 AI receptionist, missed-call recovery, lead capture and follow-up in one place. UK-focused, with a free trial and no card required to start.",
    highlight: true,
  },
  {
    name: "Other AI receptionists",
    best: "Businesses that only need a phone bot and nothing around it.",
    notes:
      "Many answer calls well but stop there: no lead inbox, follow-up, or web enquiry capture. Pricing and UK support vary widely.",
    highlight: false,
  },
  {
    name: "Human answering services",
    best: "High-value calls where a person must handle every conversation.",
    notes:
      "Reliable but typically the most expensive option, often priced per call or per minute, and limited outside contracted hours.",
    highlight: false,
  },
  {
    name: "DIY voice-AI builders",
    best: "Technical teams happy to build and maintain their own flows.",
    notes:
      "Powerful and flexible, but you do the building, testing, and upkeep. Slower to launch for a busy clinic or service team.",
    highlight: false,
  },
  {
    name: "Doing nothing / voicemail",
    best: "Businesses with very low enquiry volume.",
    notes:
      "Free, but every missed call and unanswered enquiry is potential revenue lost to the next business on the list.",
    highlight: false,
  },
];

export default function ComparePage() {
  return (
    <div className="space-y-12">
      <section className="section-shell pb-0">
        <div className="container-shell max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
            Compare
          </p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            How LeadClaw compares to the alternatives
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted">
            There are a few ways to make sure a UK service business never misses
            an enquiry. Here is an honest look at where each option fits, and
            where LeadClaw is the strongest choice.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <TrialCtaLink href="/free-trial" className="button-primary" location="compare_hero">
              Start free trial
            </TrialCtaLink>
            <Link href="/demo" className="button-secondary">
              Book a demo
            </Link>
          </div>
        </div>
      </section>

      <section className="section-shell pt-0">
        <div className="container-shell grid gap-4 md:grid-cols-2">
          {options.map((option) => (
            <div
              key={option.name}
              className={[
                "card-premium p-6",
                option.highlight ? "border-brand" : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  {option.name}
                </h2>
                {option.highlight && (
                  <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-strong">
                    Recommended
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">
                Best for: <span className="font-normal text-muted">{option.best}</span>
              </p>
              <p className="mt-3 text-sm leading-7 text-muted">{option.notes}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section-shell pt-0">
        <div className="container-shell">
          <div className="card-premium p-6 md:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              See LeadClaw for your business
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
              Explore how LeadClaw works for your industry, or start a free trial
              today - no card required, cancel anytime.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/ai-receptionist-for-dentists-uk" className="button-secondary">
                For dentists
              </Link>
              <Link href="/ai-receptionist-for-aesthetic-clinics-uk" className="button-secondary">
                For aesthetic clinics
              </Link>
              <Link href="/ai-receptionist-for-plumbers-uk" className="button-secondary">
                For plumbers
              </Link>
              <Link href="/ai-receptionist-for-electricians-uk" className="button-secondary">
                For electricians
              </Link>
              <Link href="/ai-receptionist-uk" className="button-secondary">
                All industries
              </Link>
              <Link href="/pricing" className="button-secondary">
                Pricing
              </Link>
              <TrialCtaLink href="/free-trial" className="button-primary" location="compare_bottom">
                Start free trial
              </TrialCtaLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
