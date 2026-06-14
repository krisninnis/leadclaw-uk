import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Badge from "@/components/ui/badge";
import TrialCtaLink from "@/components/trial-cta-link";
import type { SeoArticlePage as SeoArticlePageData } from "@/lib/seo-article-pages";
import {
  buildSeoArticleJsonLd,
  buildSeoArticleFaqJsonLd,
} from "@/lib/seo-article-pages";

type SeoArticlePageProps = {
  page: SeoArticlePageData;
};

function JsonLdScript({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default function SeoArticlePage({ page }: SeoArticlePageProps) {
  return (
    <>
      <JsonLdScript data={buildSeoArticleJsonLd(page)} />
      <JsonLdScript data={buildSeoArticleFaqJsonLd(page)} />

      <article className="space-y-14">
        <section className="section-shell pb-8">
          <div className="container-shell">
            <div className="max-w-4xl">
              <Badge>{page.badge}</Badge>
              <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
                {page.h1}
              </h1>
              <div className="mt-6 space-y-5 text-lg leading-8 text-muted md:text-xl md:leading-9">
                {page.intro.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <TrialCtaLink
                  href="/free-trial"
                  className="button-primary"
                  location={`seo_article_hero_${page.slug}`}
                >
                  Start free trial
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </TrialCtaLink>
                <Link href="/ai-receptionist-uk" className="button-secondary">
                  AI receptionist overview
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="section-shell pt-0">
          <div className="container-shell grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
            <aside className="card-premium h-fit p-6 lg:sticky lg:top-24">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
                In this guide
              </p>
              <nav className="mt-4 grid gap-3 text-sm text-muted">
                {page.sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="hover:text-foreground"
                  >
                    {section.title}
                  </a>
                ))}
                <a href="#faq" className="hover:text-foreground">
                  FAQ
                </a>
              </nav>

              <div className="mt-8 rounded-2xl border border-border bg-white p-4">
                <p className="text-sm font-semibold text-foreground">
                  Compare next steps
                </p>
                <div className="mt-3 grid gap-2 text-sm">
                  <Link href="/compare" className="text-muted hover:text-foreground">
                    Compare options
                  </Link>
                  <Link href="/pricing" className="text-muted hover:text-foreground">
                    View pricing
                  </Link>
                  <TrialCtaLink
                    href="/free-trial"
                    className="text-muted hover:text-foreground"
                    location={`seo_article_sidebar_${page.slug}`}
                  >
                    Start free trial
                  </TrialCtaLink>
                </div>
              </div>
            </aside>

            <div className="space-y-10">
              {page.sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="card-premium p-6 md:p-8"
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
                    {section.eyebrow}
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                    {section.title}
                  </h2>
                  <div className="mt-5 space-y-5 text-base leading-8 text-muted">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>

                  {section.bullets && (
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      {section.bullets.map((bullet) => (
                        <div
                          key={bullet}
                          className="flex gap-3 rounded-2xl border border-border bg-white p-4"
                        >
                          <CheckCircle2
                            className="mt-1 h-5 w-5 shrink-0 text-brand-strong"
                            aria-hidden="true"
                          />
                          <p className="text-sm leading-7 text-muted">
                            {bullet}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ))}

              <section id="faq" className="card-premium p-6 md:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
                  FAQ
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                  {page.faqHeading}
                </h2>
                <div className="mt-6 grid gap-4">
                  {page.faq.map((item) => (
                    <details
                      key={item.question}
                      className="rounded-2xl border border-border bg-white p-5"
                    >
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

              <section className="rounded-[28px] border border-border bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(230,251,255,0.94))] p-6 shadow-[var(--shadow-card)] md:p-8">
                <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                      Try LeadClaw for your next enquiry
                    </h2>
                    <p className="mt-3 max-w-2xl text-base leading-8 text-muted">
                      LeadClaw helps UK businesses capture enquiries, recover
                      missed calls, organise follow-up, and reduce repetitive
                      admin without a heavy setup project.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                    <TrialCtaLink
                      href="/free-trial"
                      className="button-primary"
                      location={`seo_article_bottom_${page.slug}`}
                    >
                      Start free trial
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </TrialCtaLink>
                    <Link href="/pricing" className="button-secondary">
                      View pricing
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
            </div>
          </div>
        </section>
      </article>
    </>
  );
}
