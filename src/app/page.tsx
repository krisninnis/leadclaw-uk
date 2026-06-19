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
    "AI receptionist software that helps UK businesses capture enquiries, recover missed calls, follow up faster, and book more appointments.",
  url: "https://www.leadclaw.uk",
  offers: [
    {
      "@type": "Offer",
      name: "Basic",
      price: "0",
      priceCurrency: "GBP",
      description: "Free AI receptionist intake widget for business websites",
    },
    {
      "@type": "Offer",
      name: "Growth",
      price: "79",
      priceCurrency: "GBP",
      description: "AI receptionist with lead capture and follow-up support",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "149",
      priceCurrency: "GBP",
      description: "Advanced AI receptionist support for busy teams",
    },
  ],
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "LeadClaw",
  legalName: "LeadClaw AI Ltd",
  url: "https://www.leadclaw.uk",
  logo: "https://www.leadclaw.uk/brand/icons/leadclaw-logo.png",
  image: "https://www.leadclaw.uk/brand/og/leadclaw-og.png",
  description:
    "LeadClaw is AI receptionist software for UK businesses and clinics. It captures website enquiries, supports missed call recovery, and keeps follow-ups organised 24/7.",
  areaServed: { "@type": "Country", name: "United Kingdom" },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    url: "https://www.leadclaw.uk/contact",
    availableLanguage: "English",
  },
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "LeadClaw AI Receptionist",
  serviceType: "AI receptionist and lead capture software",
  description:
    "An AI receptionist for UK service businesses that captures website enquiries, supports missed call recovery, and keeps follow-up organised so fewer leads slip away.",
  url: "https://www.leadclaw.uk",
  provider: {
    "@type": "Organization",
    name: "LeadClaw",
    url: "https://www.leadclaw.uk",
  },
  areaServed: { "@type": "Country", name: "United Kingdom" },
  offers: [
    { "@type": "Offer", name: "Basic", price: "0", priceCurrency: "GBP" },
    { "@type": "Offer", name: "Growth", price: "79", priceCurrency: "GBP" },
    { "@type": "Offer", name: "Pro", price: "149", priceCurrency: "GBP" },
  ],
};

// FAQ copy is drawn from existing LeadClaw messaging (pricing, free-trial,
// how-it-works) - nothing here is invented. The same array powers both the
// on-page FAQ section and the FAQPage structured data, so they never drift.
const faqs = [
  {
    question: "What is LeadClaw?",
    answer:
      "LeadClaw is AI receptionist software for UK businesses and clinics. It captures website enquiries, supports missed call recovery, and keeps follow-ups organised so fewer leads slip away while your team is busy or closed.",
  },
  {
    question: "Do I need a phone number to use LeadClaw?",
    answer:
      "No. LeadClaw works as a lightweight widget on your website, capturing enquiries and questions 24/7. It complements however you already take calls - you do not need to publish a new phone line.",
  },
  {
    question: "How does the free trial work?",
    answer:
      "You can start with a 7-day free trial. No card is required to begin, and you can cancel anytime. You only continue to a monthly subscription if you are happy with how LeadClaw fits your team.",
  },
  {
    question: "How long does setup take?",
    answer:
      "Most businesses are live within 48-72 hours. You submit a short application (around 3-5 minutes), approve the trial terms, and we configure your AI receptionist - no lengthy onboarding calls required.",
  },
  {
    question: "How much does LeadClaw cost?",
    answer:
      "LeadClaw has three plans: Basic at GBP 0/month (a free intake widget), Growth at GBP 79/month (lead capture and follow-up support), and Pro at GBP 149/month (advanced support for busier teams). You can compare them in full on the pricing page.",
  },
  {
    question: "Will LeadClaw replace my reception team?",
    answer:
      "No. LeadClaw is built to support your team, not replace them. It answers faster, captures the right details, recovers missed enquiries, and keeps follow-up visible so your people can focus on customers.",
  },
  {
    question: "What does LeadClaw capture from an enquiry?",
    answer:
      "It collects the key details of each enquiry - name, contact details, the service someone is asking about, preferred times, and notes - and stores them in one simple workspace inbox for your team to action.",
  },
  {
    question: "Which businesses is LeadClaw for?",
    answer:
      "LeadClaw is designed for UK service businesses and clinics - from dentists, aesthetic clinics, physiotherapists, and chiropractors to plumbers, electricians, and other teams that cannot afford to miss enquiries.",
  },
  {
    question: "How does LeadClaw handle my data?",
    answer:
      "LeadClaw is built in the UK and designed around UK GDPR expectations. Enquiry data lives in your portal workspace, and our privacy policy, terms, and DPA set out exactly how information is handled.",
  },
  {
    question: "Can I cancel at any time?",
    answer:
      "Yes. There is no long lock-in. The free trial requires no card, and paid plans can be cancelled anytime if LeadClaw is not the right fit for your business.",
  },
  {
    question: "How do I get started or see it in action?",
    answer:
      "You can start a free trial, book a demo, or run a free website audit to see where you are losing enquiries today. The team behind LeadClaw is UK-based and happy to help you get set up - just get in touch via the contact page.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

// Honest, mechanism-based proof - no invented customer numbers or testimonials.
// Each block describes how the product changes the maths of enquiry handling.
const outcomeProof = [
  {
    metric: "1 enquiry",
    label: "can cover the plan",
    body:
      "For most service businesses, the value of a single recovered job is more than a month of LeadClaw. The platform is designed to pay for itself on the enquiries you are currently missing.",
  },
  {
    metric: "24/7",
    label: "enquiry capture",
    body:
      "Enquiries rarely arrive only in office hours. LeadClaw captures website questions and requests around the clock, so an after-hours enquiry becomes a tracked next action instead of a lost lead.",
  },
  {
    metric: "48-72h",
    label: "to go live",
    body:
      "There is no drawn-out implementation. A short application, trial-terms approval, and configuration is typically all it takes to start capturing enquiries within a few days.",
  },
];

const painPoints = [
  "Enquiries arrive while your team is busy with customers",
  "Missed calls and forms turn into cold leads",
  "Follow-ups slip when details are spread across inboxes",
];

const features = [
  {
    title: "24/7 AI Receptionist",
    description:
      "Capture website enquiries the moment someone is ready to ask for help, even when your team is busy or closed.",
  },
  {
    title: "Missed Call Recovery",
    description:
      "Give callers and website visitors a clear next step instead of leaving warm leads unanswered.",
  },
  {
    title: "Lead Capture",
    description:
      "Collect names, phone numbers, services, preferred times, and notes in one simple workspace.",
  },
  {
    title: "Follow-Up Assistant",
    description:
      "Prompt timely replies and reminders so potential customers are not left waiting.",
  },
  {
    title: "Reception Inbox",
    description:
      "Keep new enquiries, callback notes, and next actions visible for your team.",
  },
  {
    title: "Weekly Enquiry Summary",
    description:
      "See where enquiries came from, which services people asked about, and what needs attention.",
  },
];

const stats = [
  { label: "24/7 enquiry capture", value: "Always on" },
  { label: "Setup style", value: "Lightweight widget" },
  { label: "Follow-up", value: "Tracked" },
  { label: "Best for", value: "UK service teams" },
];

const steps = [
  {
    step: "01",
    title: "Someone makes an enquiry",
    description:
      "A visitor asks a question, requests a callback, or submits an appointment enquiry.",
  },
  {
    step: "02",
    title: "LeadClaw captures the details",
    description:
      "The AI receptionist collects the key information and stores the enquiry in your workspace.",
  },
  {
    step: "03",
    title: "Your team follows up faster",
    description:
      "Your team sees the next action clearly, with follow-up support to keep warm leads moving.",
  },
];

const trustPoints = [
  "Built in the UK for businesses that cannot afford to miss enquiries",
  "Portal-based enquiry visibility for your team",
  "Website widget installation model already in place",
  "No invented ratings, fake testimonials, or hidden card requirement",
];

export default function Home() {
  return (
    <div className="space-y-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <section className="page-hero section-shell">
        <div className="container-shell relative">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="max-w-3xl">
              <div className="badge-soft mb-5">
                <span className="h-2 w-2 rounded-full bg-brand" />
                AI receptionist for UK businesses
              </div>

              <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Never miss another enquiry. LeadClaw captures, follows up, and
                helps you book more appointments.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted sm:text-xl">
                LeadClaw is AI receptionist software for UK businesses and
                clinics. It captures website enquiries, supports missed call
                recovery, and keeps follow-ups organised 24/7.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <TrialCtaLink
                  href="/free-trial"
                  className="button-primary"
                  location="homepage_bottom_cta"
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
                      AI receptionist preview
                    </p>
                    <p className="text-sm text-muted">
                      Example enquiry
                    </p>
                  </div>
                  <div className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-strong">
                    Live enquiry capture
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
                          Answers calls &amp; enquiries 24/7
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-surface-2 px-4 py-3 text-foreground">
                        Hi, thanks for getting in touch. I can book you in or
                        take a message - how can I help?
                      </div>
                      <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-md bg-brand-soft px-4 py-3 text-foreground">
                        I&apos;d like to book an appointment this week.
                      </div>
                      <div className="max-w-[90%] rounded-2xl rounded-tl-md bg-surface-2 px-4 py-3 text-foreground">
                        Of course - leave your name and number and the team will
                        confirm your slot shortly.
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
                          New enquiry arrives instantly
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
                  Why enquiries get missed
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                  Most lost customers are not caused by a lack of demand.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted md:text-lg">
                  They slip because enquiries arrive while the team is busy,
                  details are scattered across tools, or nobody follows up fast
                  enough. LeadClaw captures the enquiry and keeps the next
                  action visible.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[24px] border border-border bg-white p-5">
                  <p className="text-sm font-medium text-muted">Busy team</p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                    Customers first
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Teams are often serving customers, not watching every call,
                    form, or inbox in real time.
                  </p>
                </div>

                <div className="rounded-[24px] border border-border bg-white p-5">
                  <p className="text-sm font-medium text-muted">
                    Scattered details
                  </p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                    Details drift
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Contact details, service needs, and callback times get
                    copied, postponed, or left in the wrong place.
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
                    The longer the delay, the more likely a customer or
                    prospect moves on.
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
              A simple 3-step flow from enquiry to organised follow-up
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted">
              No bloated setup. No complicated process. Just a clearer path
              from incoming enquiries to visible next actions.
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
                What LeadClaw does
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                A practical AI receptionist for busy service teams
              </h2>
              <p className="mt-4 text-lg leading-8 text-muted">
                LeadClaw is not trying to replace your team. It helps them
                answer faster, capture the right details, recover missed
                enquiries, and keep follow-up visible.
              </p>
            </div>

            <div className="rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-muted shadow-sm">
              Lightweight setup | Faster follow-up | Reception focused
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
                The maths is simple
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                One recovered enquiry can quickly justify the platform.
              </h2>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
                If your business already receives calls, website enquiries, or
                quote requests, the real problem is usually response speed.
                LeadClaw helps capture the details and keep follow-up moving.
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

      <section className="section-shell">
        <div className="container-shell">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
              Why teams choose LeadClaw
            </p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Outcomes that change the maths of every enquiry
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted">
              We do not publish invented ratings or fake testimonials. Instead,
              here is the honest case for LeadClaw - how it changes what happens
              to an enquiry the moment it arrives.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {outcomeProof.map((item) => (
              <div key={item.label} className="card-premium p-6">
                <p className="text-4xl font-semibold tracking-tight text-brand-strong">
                  {item.metric}
                </p>
                <p className="mt-1 text-sm font-semibold uppercase tracking-[0.14em] text-muted-2">
                  {item.label}
                </p>
                <p className="mt-4 text-sm leading-7 text-muted">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div className="card-premium p-6 md:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
                How the proof works
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                A worked example, not a promise
              </h3>
              <p className="mt-4 text-sm leading-7 text-muted">
                Suppose ten enquiries reach your business in a week and two
                arrive while everyone is busy. If LeadClaw captures those two and
                keeps the follow-up visible, recovering even one is usually worth
                more than a month of the platform. The figures are illustrative -
                the mechanism is real: capture the enquiry, make the next action
                obvious, and let the results show up in your workspace.
              </p>
            </div>
            <div className="card-premium p-6 md:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
                Built in the UK
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                Real software, run by a real team
              </h3>
              <p className="mt-4 text-sm leading-7 text-muted">
                LeadClaw is built and run in the United Kingdom by our team at
                LeadClaw AI Ltd. Enquiry data lives in your portal
                workspace, handled in line with UK GDPR - set out plainly in our
                privacy policy, terms, and DPA. No hidden card requirement, no
                invented reviews.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell pt-0">
        <div className="container-shell">
          <div className="overflow-hidden rounded-[32px] bg-slate-950 p-8 text-white shadow-xl md:p-12">
            <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">
                  Free website audit
                </p>
                <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
                  See where your website is losing enquiries - free
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
                  Get an instant score across website health, SEO, trust,
                  conversion, and AI readiness, with prioritised actions you can
                  use straight away. No call required.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link href="/free-audit" className="button-primary text-center">
                  Get your free audit
                </Link>
                <Link
                  href="/demo"
                  className="button-secondary border-white/20 bg-white/10 text-center text-white hover:bg-white/20"
                >
                  Book a demo
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell pt-0">
        <div className="container-shell">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
              Frequently asked questions
            </p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Common questions about LeadClaw
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted">
              Everything UK service teams ask before they start. Still unsure?
              Contact us or book a demo and we will walk you through it.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-3xl space-y-3">
            {faqs.map((item) => (
              <details
                key={item.question}
                className="group rounded-[20px] border border-border bg-white p-5 md:p-6"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-foreground">
                  {item.question}
                  <span className="ml-2 shrink-0 text-brand-strong transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-7 text-muted">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section-shell pt-0">
        <div className="container-shell">
          <div className="rounded-[32px] border border-border bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(230,251,255,0.94))] p-8 shadow-[var(--shadow-pop)] md:p-12">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
                Ready to stop missing enquiries?
              </p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                Give your business an AI receptionist that captures enquiries.
              </h2>
              <p className="mt-5 text-lg leading-8 text-muted">
                Start with a free trial, see how LeadClaw fits your team, and
                turn more incoming enquiries into clear next actions.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <TrialCtaLink
                  href="/free-trial"
                  className="button-primary"
                  location="homepage_hero"
                >
                  Start free trial
                </TrialCtaLink>
                <Link href="/demo" className="button-secondary">
                  Book a demo
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
