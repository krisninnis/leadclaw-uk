import Link from "next/link";
import TrialCtaLink from "@/components/trial-cta-link";

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "LeadClaw",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "AI front desk for UK aesthetic clinics. Captures missed website enquiries 24/7 and sends them to your clinic portal.",
  url: "https://www.leadclaw.uk",
  offers: [
    {
      "@type": "Offer",
      name: "Basic",
      price: "0",
      priceCurrency: "GBP",
      description: "Free AI enquiry widget for clinic websites",
    },
    {
      "@type": "Offer",
      name: "Growth",
      price: "79",
      priceCurrency: "GBP",
      description: "Full automation with follow-ups and lead dashboard",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "149",
      priceCurrency: "GBP",
      description: "Advanced automation for clinics serious about growth",
    },
  ],
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "5",
    ratingCount: "1",
  },
};

const painPoints = [
  "Website visitors leave when nobody replies quickly",
  "Busy reception teams miss enquiries during treatments",
  "Out-of-hours traffic disappears without follow-up",
];

const features = [
  {
    title: "AI website front desk",
    description:
      "Give every clinic website a modern enquiry assistant that captures interest the moment a visitor is ready to ask about treatments.",
  },
  {
    title: "Missed enquiry capture",
    description:
      "Stop losing potential patients when your team is busy, offline, or focused on appointments in clinic.",
  },
  {
    title: "Lead inbox for clinics",
    description:
      "Keep new enquiries organised in one simple portal so your staff can track who is new, contacted, booked, or lost.",
  },
  {
    title: "Faster follow-up",
    description:
      "Make it easier for your team to respond quickly while leads are still warm and likely to convert.",
  },
  {
    title: "Built for aesthetic clinics",
    description:
      "Designed for aesthetic, skin, whitening, beauty, and cosmetic clinics that need a cleaner lead flow without extra admin.",
  },
  {
    title: "Simple setup",
    description:
      "Add a lightweight widget to your website and start capturing opportunities without rebuilding your existing site.",
  },
];

const stats = [
  { label: "24/7 enquiry capture", value: "Always on" },
  { label: "Setup style", value: "Lightweight widget" },
  { label: "Team workflow", value: "Portal based" },
  { label: "Best for", value: "UK clinics" },
];

const steps = [
  {
    step: "01",
    title: "Visitor asks about treatment",
    description:
      "A potential patient lands on your clinic site and wants to ask about a treatment, price, or booking.",
  },
  {
    step: "02",
    title: "LeadClaw captures the enquiry",
    description:
      "Your website widget collects the enquiry even when your team is busy or out of hours.",
  },
  {
    step: "03",
    title: "Your clinic follows up faster",
    description:
      "The lead appears in your portal so your team can contact them while interest is still high.",
  },
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
                Built for UK aesthetic clinics
              </div>

              <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Capture missed website enquiries with an AI front desk that
                works 24/7.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted sm:text-xl">
                LeadClaw adds a smart enquiry assistant to your clinic website
                so visitors can get in touch whenever they are ready. Every
                enquiry flows into your clinic portal so your team can follow up
                faster and convert more opportunities.
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
                      AI front desk preview
                    </p>
                    <p className="text-sm text-muted">
                      Example visitor journey
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
                          LeadClaw Widget
                        </p>
                        <p className="text-xs text-muted">
                          Friendly AI front desk
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-surface-2 px-4 py-3 text-foreground">
                        Hi 👋 Welcome to the clinic. Can I help with treatments,
                        pricing, or booking?
                      </div>
                      <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-md bg-brand-soft px-4 py-3 text-foreground">
                        I&apos;m interested in lip filler and would like
                        pricing.
                      </div>
                      <div className="max-w-[90%] rounded-2xl rounded-tl-md bg-surface-2 px-4 py-3 text-foreground">
                        Great — leave your details and the clinic can follow up
                        with the right information.
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-border bg-surface p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Clinic portal
                        </p>
                        <p className="text-xs text-muted">
                          New lead arrives instantly
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        New enquiry
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

              <div className="pointer-events-none absolute -right-4 -top-4 hidden h-24 w-24 rounded-full bg-brand/10 blur-2xl md:block" />
              <div className="pointer-events-none absolute -bottom-4 left-6 hidden h-24 w-24 rounded-full bg-violet-500/10 blur-2xl md:block" />
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
                  Why clinics miss enquiries
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                  Most lost leads are not lost because of demand.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted md:text-lg">
                  They are lost because the website visitor arrives at the wrong
                  moment. The team is busy, the clinic is closed, or nobody
                  replies fast enough. LeadClaw helps capture that interest
                  before it disappears.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[24px] border border-border bg-white p-5">
                  <p className="text-sm font-medium text-muted">
                    Busy front desk
                  </p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                    Treatments first
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Reception teams are often serving in-clinic patients, not
                    monitoring every website enquiry live.
                  </p>
                </div>

                <div className="rounded-[24px] border border-border bg-white p-5">
                  <p className="text-sm font-medium text-muted">
                    Out-of-hours traffic
                  </p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                    Interest fades
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Evening and weekend visitors still browse treatments even
                    when your team is unavailable.
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
                    The longer the delay, the more likely that visitor books
                    elsewhere or forgets the enquiry.
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
              A simple 3-step flow that helps turn website visits into leads
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted">
              No bloated setup. No complicated process. Just a cleaner path from
              website interest to clinic follow-up.
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
                Core product benefits
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                A cleaner lead system for modern clinics
              </h2>
              <p className="mt-4 text-lg leading-8 text-muted">
                LeadClaw is not trying to replace your clinic team. It helps
                them capture more opportunities and respond with less friction.
              </p>
            </div>

            <div className="rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-muted shadow-sm">
              Lightweight setup • Faster follow-up • Clinic focused
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

      <section className="section-shell">
        <div className="container-shell">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
            <div className="card-premium p-6 md:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
                Built for conversion
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                One recovered treatment enquiry can easily justify the platform.
              </h2>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
                If your clinic already gets website traffic, the real problem is
                often missed intent rather than lack of demand. LeadClaw helps
                you capture more of the opportunities you are already paying for
                through SEO, ads, and word of mouth.
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
                {[
                  "Designed around a simple clinic workflow",
                  "Portal-based lead visibility for your team",
                  "Website widget installation model already in place",
                  "Focused specifically on UK aesthetic and beauty clinics",
                ].map((item) => (
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
                Ready to stop missing website opportunities?
              </p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                Give your clinic an AI front desk that captures more leads.
              </h2>
              <p className="mt-5 text-lg leading-8 text-muted">
                Start with a free trial, see how the workflow fits your clinic,
                and turn more website visitors into real follow-up
                opportunities.
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
