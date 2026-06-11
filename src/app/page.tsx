import type { Metadata } from "next";
import Link from "next/link";
import SolutionsByClinicType from "@/components/seo/solutions-by-clinic-type";
import TrialCtaLink from "@/components/trial-cta-link";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "LeadClaw",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "AI workflow automation suite that helps businesses capture requests, organise work, automate follow-ups, and reduce repetitive admin.",
  url: "https://www.leadclaw.uk",
  offers: [
    {
      "@type": "Offer",
      name: "Basic",
      price: "0",
      priceCurrency: "GBP",
      description: "Free AI intake widget for business websites",
    },
    {
      "@type": "Offer",
      name: "Growth",
      price: "79",
      priceCurrency: "GBP",
      description: "AI workflows with follow-ups and work tracking",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "149",
      priceCurrency: "GBP",
      description: "Advanced automation for teams with complex operations",
    },
  ],
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "5",
    ratingCount: "1",
  },
};

const painPoints = [
  "Requests get missed when nobody replies quickly",
  "Teams lose time moving data between tools",
  "Follow-ups slip when work is spread across inboxes",
];

const features = [
  {
    title: "AI Receptionist",
    description:
      "Capture website requests the moment someone is ready to ask for help, even when your team is busy or offline.",
  },
  {
    title: "Lead Tracker",
    description:
      "Keep new requests organised in one workspace so your team can see what is new, contacted, assigned, completed, or lost.",
  },
  {
    title: "Follow-Up Assistant",
    description:
      "Trigger reminders, replies, and next steps so important work does not depend on someone remembering manually.",
  },
  {
    title: "Data Cleaner",
    description:
      "Turn messy forms, lists, and notes into cleaner records your team can actually use.",
  },
  {
    title: "Document Extractor",
    description:
      "Pull useful details from documents, messages, and submissions so repetitive admin takes less time.",
  },
  {
    title: "Weekly Report Bot",
    description:
      "Summarise intake, follow-up activity, and operational progress into a simple recurring report for the team.",
  },
];

const stats = [
  { label: "24/7 intake capture", value: "Always on" },
  { label: "Setup style", value: "Lightweight widget" },
  { label: "Team workflow", value: "Workspace based" },
  { label: "Best for", value: "Busy teams" },
];

const steps = [
  {
    step: "01",
    title: "Someone sends a request",
    description:
      "A customer, prospect, or teammate submits a question, lead, document, or admin task.",
  },
  {
    step: "02",
    title: "LeadClaw captures the intake",
    description:
      "The AI workflow collects the details, classifies the intent, and stores the request in your workspace.",
  },
  {
    step: "03",
    title: "Your team follows up faster",
    description:
      "The right person sees the next action, while automations handle reminders, follow-ups, and routine updates.",
  },
];

const trustPoints = [
  "Designed around simple workspace workflows",
  "Portal-based request visibility for your team",
  "Website widget installation model already in place",
  "Built to support multiple business workflows over time",
];

export default function Home() {
  return (
    <div className="space-y-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <section className="page-hero section-shell">
        <div className="container-shell relative">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="max-w-3xl">
              <div className="badge-soft mb-5">
                <span className="h-2 w-2 rounded-full bg-brand" />
                AI workflow automation for busy teams
              </div>

              <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Capture requests, organise work, and automate follow-ups with
                AI.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted sm:text-xl">
                LeadClaw helps businesses capture requests, organise
                operational work, automate follow-ups, and save hours on
                repetitive admin and data tasks with AI.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <TrialCtaLink
                  href="/pricing"
                  className="button-primary"
                  location="homepage_bottom_cta"
                >
                  Start free trial
                </TrialCtaLink>
                <Link href="/demo" className="button-secondary">
                  View demo
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
                {painPoints.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm text-muted shadow-sm"
                  >
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-brand" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="card-premium p-5 md:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      AI workflow preview
                    </p>
                    <p className="text-sm text-muted">
                      Example request journey
                    </p>
                  </div>
                  <div className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-strong">
                    Live capture flow
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-[20px] border border-border bg-surface p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-soft text-sm font-bold text-brand-strong">
                        LC
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          LeadClaw AI Receptionist
                        </p>
                        <p className="text-xs text-muted">
                          Friendly request assistant
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-surface-2 px-4 py-3 text-foreground">
                        Hi! I can help capture requests, documents, follow-ups,
                        or general questions.
                      </div>
                      <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-md bg-brand-soft px-4 py-3 text-foreground">
                        I need help with a customer request and a weekly report.
                      </div>
                      <div className="max-w-[90%] rounded-2xl rounded-tl-md bg-surface-2 px-4 py-3 text-foreground">
                        Great - leave your details and the right workflow can
                        route this to your team.
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-border bg-surface p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Workspace inbox
                        </p>
                        <p className="text-xs text-muted">
                          New request arrives instantly
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        New request
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {stats.map((stat) => (
                        <div
                          key={stat.label}
                          className="rounded-2xl border border-border bg-white px-4 py-4"
                        >
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-2">
                            {stat.label}
                          </p>
                          <p className="mt-2 text-lg font-semibold text-foreground">
                            {stat.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell pt-0">
        <div className="container-shell">
          <div className="card-premium p-6 md:p-8">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
                  Why operational work slips
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                  Most missed opportunities are not caused by lack of demand.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted md:text-lg">
                  They slip because requests arrive while the team is busy,
                  details are scattered across tools, or nobody follows up fast
                  enough. LeadClaw captures the intake and keeps the next action
                  visible.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[24px] border border-border bg-white p-5">
                  <p className="text-sm font-medium text-muted">Busy team</p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                    Work first
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Teams are often doing the work, not watching every inbox,
                    form, or spreadsheet in real time.
                  </p>
                </div>

                <div className="rounded-[24px] border border-border bg-white p-5">
                  <p className="text-sm font-medium text-muted">
                    Manual data work
                  </p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                    Details drift
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Important details get copied, retyped, postponed, or left
                    in the wrong place.
                  </p>
                </div>

                <div className="rounded-[24px] border border-border bg-white p-5">
                  <p className="text-sm font-medium text-muted">
                    Slow follow-up
                  </p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                    Warm leads cool
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    The longer the delay, the more likely a customer, prospect,
                    or internal requester moves on.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell">
        <div className="container-shell">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
              How LeadClaw works
            </p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              A simple 3-step flow from request to organised follow-up
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted">
              No bloated setup. No complicated process. Just a cleaner path from
              incoming requests to visible next actions.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((item) => (
              <div
                key={item.step}
                className="card-premium card-premium-hover p-6"
              >
                <div className="mb-5 inline-flex rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-strong">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-foreground">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-muted">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-shell bg-white/40">
        <div className="container-shell">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
                Core product categories
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                A practical AI workflow suite for modern teams
              </h2>
              <p className="mt-4 text-lg leading-8 text-muted">
                LeadClaw is not trying to replace your team. It helps them
                capture requests, organise work, clean data, extract details,
                and respond with less friction.
              </p>
            </div>

            <div className="rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-muted shadow-sm">
              Lightweight setup | Faster follow-up | Workflow focused
            </div>
          </div>

          <div className="mt-10 grid-auto-fit">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="card-premium card-premium-hover p-6"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-lg font-bold text-brand-strong">
                  +
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-muted">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SolutionsByClinicType />

      <section className="section-shell">
        <div className="container-shell">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
            <div className="card-premium p-6 md:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
                Built for useful automation
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                One saved admin hour can quickly justify the platform.
              </h2>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
                If your business already receives requests, documents, leads, or
                recurring reporting work, the real problem is usually friction.
                LeadClaw helps capture the work, route it, and automate the
                repetitive steps around it.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/pricing" className="button-primary">
                  See pricing
                </Link>
                <Link href="/contact" className="button-secondary">
                  Talk to us
                </Link>
              </div>
            </div>

            <div className="card-premium p-6 md:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
                Trust and clarity
              </p>
              <div className="mt-5 space-y-4">
                {trustPoints.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-white px-4 py-4"
                  >
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-brand" />
                    <span className="text-sm leading-7 text-muted">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell pt-0">
        <div className="container-shell">
          <div className="rounded-[32px] border border-border bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(230,251,255,0.94))] p-8 shadow-[var(--shadow-pop)] md:p-12">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
                Ready to reduce repetitive admin?
              </p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                Give your business AI workflows that capture and organise work.
              </h2>
              <p className="mt-5 text-lg leading-8 text-muted">
                Start with a free trial, see how the workflow fits your team,
                and turn more incoming requests into clear next actions.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <TrialCtaLink
                  href="/pricing"
                  className="button-primary"
                  location="homepage_hero"
                >
                  Start free trial
                </TrialCtaLink>
                <Link href="/demo" className="button-secondary">
                  View demo
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
