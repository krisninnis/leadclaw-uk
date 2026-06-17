// ClawLabsLocal — Landing Page Builder (Phase A)
// Public renderer for a DB-driven local landing page. Shared by /lp/[slug] and
// the admin draft preview so "what you preview is what publishes". Uses the
// existing card-premium / Badge / SectionHeading primitives, and emits the
// LocalBusiness / Service / FAQPage JSON-LD via buildLandingJsonLd().

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Badge from "@/components/ui/badge";
import SectionHeading from "@/components/ui/section-heading";
import { buildLandingJsonLd } from "@/lib/landing/schema";
import type { PublicLandingPage as PublicLandingPageData } from "@/lib/landing/types";

type Props = {
  page: PublicLandingPageData;
};

function locationLabel(page: PublicLandingPageData): string {
  return [page.city, page.region].filter(Boolean).join(", ");
}

export default function PublicLandingPage({ page }: Props) {
  const content = page.content;
  const jsonLd = buildLandingJsonLd({
    slug: page.slug,
    niche: page.niche,
    city: page.city,
    region: page.region,
    country: page.country,
    canonicalPath: page.canonical_path,
    content,
    businessSchema: page.business_schema,
  });

  const location = locationLabel(page);
  const badgeText = [page.niche, page.city].filter(Boolean).join(" · ") || "Local";

  return (
    <>
      {jsonLd.map((node, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(node) }}
        />
      ))}

      <article className="space-y-16">
        <section className="section-shell pb-8">
          <div className="max-w-4xl">
            <Badge>{badgeText}</Badge>
            <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
              {content.h1}
            </h1>
            {content.subheading ? (
              <p className="mt-6 max-w-3xl text-lg leading-8 text-muted md:text-xl md:leading-9">
                {content.subheading}
              </p>
            ) : null}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/demo" className="button-primary">
                Book a demo
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/free-trial" className="button-secondary">
                Start free trial
              </Link>
            </div>
          </div>
        </section>

        {content.pains.length ? (
          <section>
            <SectionHeading
              eyebrow="The problem"
              title={
                location
                  ? `Common enquiry gaps in ${location}`
                  : "Common enquiry gaps"
              }
            />
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {content.pains.map((pain) => (
                <div key={pain} className="card-premium p-5">
                  <p className="text-sm leading-7 text-muted">{pain}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {content.features.length ? (
          <section>
            <SectionHeading eyebrow="How it works" title="How it works" />
            <ol className="mt-8 grid gap-4 md:grid-cols-4">
              {content.features.map((feature, index) => (
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
        ) : null}

        {content.useCases.length ? (
          <section className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <SectionHeading eyebrow="Use cases" title="Ways teams use this" />
            </div>
            <div className="grid gap-4">
              {content.useCases.map((useCase) => (
                <div
                  key={useCase}
                  className="flex gap-3 rounded-lg border border-border bg-white p-4"
                >
                  <CheckCircle2
                    className="mt-1 h-5 w-5 shrink-0 text-brand-strong"
                    aria-hidden="true"
                  />
                  <p className="text-sm leading-7 text-muted">{useCase}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {content.benefits.length ? (
          <section>
            <SectionHeading eyebrow="Benefits" title="What you get back" />
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {content.benefits.map((benefit) => (
                <div key={benefit} className="card-premium p-5">
                  <p className="text-sm leading-7 text-muted">{benefit}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {content.faq.length ? (
          <section>
            <SectionHeading eyebrow="FAQ" title="Frequently asked questions" />
            <div className="mt-8 grid gap-4">
              {content.faq.map((item) => (
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
        ) : null}

        <section className="card-premium p-6 md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                {location
                  ? `See how LeadClaw could fit your reception process in ${location}`
                  : "See how LeadClaw could fit your reception process"}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
                Start with enquiry capture and lead tracking, then add follow-up
                support, missed call recovery, and reporting as your process
                matures.
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

        {content.relatedLinks.length ? (
          <nav aria-label="Related pages" className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              Related pages
            </h2>
            <div className="flex flex-wrap gap-3">
              {content.relatedLinks.map((link) => (
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
        ) : null}
      </article>
    </>
  );
}
