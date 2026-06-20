import Link from "next/link";

/**
 * Concise, conversion-focused industries block for the homepage.
 *
 * Leads with aesthetic clinics (the flagship vertical for this pass) but keeps
 * the product multi-industry: a handful of recognisable examples plus a single
 * "View all industries" link to the full index. The exhaustive 34-link grid
 * lives on the dedicated /industries index page and on the supporting pages
 * (via SolutionsByClinicType) — it is intentionally kept off the homepage to
 * protect conversion.
 *
 * All hrefs point at existing, unchanged SEO landing pages.
 */

const flagship = {
  href: "/ai-receptionist-for-aesthetic-clinics-uk",
  label: "Aesthetic clinics",
  description:
    "Capture consultation and treatment enquiries from your website around the clock, and follow up before prospective clients book elsewhere.",
};

const examples = [
  { href: "/ai-receptionist-for-dentists-uk", label: "Dentists" },
  { href: "/ai-receptionist-for-physiotherapists-uk", label: "Physiotherapists" },
  { href: "/ai-receptionist-for-plumbers-uk", label: "Plumbers" },
  { href: "/ai-receptionist-for-electricians-uk", label: "Electricians" },
  { href: "/ai-receptionist-for-marketing-agencies-uk", label: "Marketing agencies" },
  { href: "/ai-receptionist-for-accountants-uk", label: "Accountants" },
];

export default function FlagshipIndustries() {
  return (
    <section className="section-shell bg-white/40">
      <div className="container-shell">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
            Built for service businesses
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Made for aesthetic clinics — and dozens of other UK industries
          </h2>
          <p className="mt-4 text-base leading-7 text-muted md:text-lg">
            Aesthetic clinics are where LeadClaw shines: high-value enquiries
            that can&apos;t be left waiting. The same enquiry capture and
            follow-up works for trades, agencies, accountants, dentists, vets,
            and any team that can&apos;t afford to miss a lead.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
          <Link
            href={flagship.href}
            className="group card-premium card-premium-hover flex flex-col justify-between p-6 md:p-8"
          >
            <div>
              <span className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-strong">
                Flagship
              </span>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight text-foreground group-hover:text-brand-strong">
                {flagship.label}
              </h3>
              <p className="mt-3 text-sm leading-7 text-muted">
                {flagship.description}
              </p>
            </div>
            <span className="mt-6 text-sm font-semibold text-brand-strong">
              See LeadClaw for aesthetic clinics →
            </span>
          </Link>

          <div className="card-premium p-6 md:p-8">
            <p className="text-sm font-semibold text-foreground">
              Other industries we serve
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {examples.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium text-muted transition hover:border-border-strong hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <Link
              href="/industries"
              className="mt-6 inline-flex text-sm font-semibold text-brand-strong hover:underline"
            >
              View all industries →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
