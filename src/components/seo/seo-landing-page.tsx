import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Badge from "@/components/ui/badge";
import SectionHeading from "@/components/ui/section-heading";
import type { SeoPage } from "@/lib/seo-pages";

const siteUrl = "https://www.leadclaw.uk";

type SeoLandingPageProps = {
  page: SeoPage;
};

export default function SeoLandingPage({ page }: SeoLandingPageProps) {
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: page.h1,
    serviceType: "AI workflow automation",
    description: page.metaDescription,
    url: `${siteUrl}${page.canonicalPath}`,
    provider: {
      "@type": "Organization",
      name: "LeadClaw",
      url: siteUrl,
    },
    areaServed: {
      "@type": "Country",
      name: "United Kingdom",
    },
    audience: {
      "@type": "Audience",
      audienceType: page.audience,
    },
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/pricing`,
      availability: "https://schema.org/InStock",
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <article className="space-y-16">
        <section className="section-shell pb-8">
          <div className="max-w-4xl">
            <Badge>{page.niche}</Badge>
            <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
              {page.h1}
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-muted md:text-xl md:leading-9">
              {page.subheading}
            </p>
            <p className="mt-5 max-w-3xl text-base leading-8 text-muted">
              LeadClaw helps {page.niche.toLowerCase()} capture requests,
              organise operational work, automate follow-ups, and save time on
              repetitive admin with AI. It supports teams with intake and
              workflow visibility while your people stay in control of review,
              advice, and decisions.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/demo" className="button-primary">
                View demo
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/free-trial" className="button-secondary">
                Start free trial
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <div className="card-premium p-6 md:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Built for {page.audience}
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted">
              The system is designed around practical admin work: capturing the
              request, recording useful context, routing the next step, and
              keeping follow-up visible.
            </p>
          </div>

          <div className="card-premium p-6 md:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              What it avoids
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted">
              LeadClaw does not replace professional judgement, clinical
              review, medical advice, treatment planning, or reception staff.
              It helps your team handle the admin around those workflows.
            </p>
          </div>
        </section>

        <section>
          <SectionHeading
            eyebrow="Pain points"
            title={`Common workflow gaps for ${page.niche.toLowerCase()}`}
            description="These are the kinds of operational issues LeadClaw is designed to make easier to track, route, and follow up."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {page.pains.map((pain) => (
              <div key={pain} className="card-premium p-5">
                <p className="text-sm leading-7 text-muted">{pain}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading
            eyebrow="How it works"
            title="AI receptionist plus workflow automation"
            description="LeadClaw gives your team a structured path from first request to follow-up, without making sensitive decisions on your behalf."
          />
          <ol className="mt-8 grid gap-4 md:grid-cols-4">
            {page.features.map((feature, index) => (
              <li key={feature} className="card-premium p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  {feature}
                </h3>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <SectionHeading
              eyebrow="Use cases"
              title={`Ways ${page.niche.toLowerCase()} use LeadClaw`}
              description="The workflow can start with request capture and expand into follow-up, reporting, document handling, and data cleanup."
            />
          </div>
          <div className="grid gap-4">
            {page.useCases.map((useCase) => (
              <div key={useCase} className="flex gap-3 rounded-lg border border-border bg-white p-4">
                <CheckCircle2
                  className="mt-1 h-5 w-5 shrink-0 text-brand-strong"
                  aria-hidden="true"
                />
                <p className="text-sm leading-7 text-muted">{useCase}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading
            eyebrow="Benefits"
            title="What the team gets back"
            description="LeadClaw is useful when small admin delays create bigger operational drag across a busy week."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {page.benefits.map((benefit) => (
              <div key={benefit} className="card-premium p-5">
                <p className="text-sm leading-7 text-muted">{benefit}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading
            eyebrow="FAQ"
            title={`Questions about LeadClaw for ${page.niche.toLowerCase()}`}
          />
          <div className="mt-8 grid gap-4">
            {page.faq.map((item) => (
              <details key={item.question} className="card-premium p-5">
                <summary className="cursor-pointer text-base font-semibold text-foreground">
                  {item.question}
                </summary>
                <p className="mt-3 text-sm leading-7 text-muted">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="card-premium p-6 md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                See how LeadClaw could fit your workflow
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
                Start with intake and lead tracking, then add follow-up
                automation, data cleanup, document extraction, and reporting as
                your operations mature.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <Link href="/demo" className="button-secondary">
                View demo
              </Link>
              <Link href="/free-trial" className="button-primary">
                Start free trial
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <nav aria-label="Related pages" className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Related LeadClaw pages
          </h2>
          <div className="flex flex-wrap gap-3">
            {page.relatedLinks.map((link) => (
              <Link
                key={`${link.href}-${link.label}`}
                href={link.href}
                className="rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-foreground hover:border-border-strong hover:bg-surface-2"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      </article>
    </>
  );
}
