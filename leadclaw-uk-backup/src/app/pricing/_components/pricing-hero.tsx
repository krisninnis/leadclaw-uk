import Link from "next/link";

export default function PricingHero() {
  return (
    <section className="page-hero section-shell">
      <div className="container-shell">
        <div className="mx-auto max-w-3xl text-center">
          <div className="badge-soft mb-5">
            <span className="h-2 w-2 rounded-full bg-brand" />
            Simple SaaS pricing for UK aesthetic clinics
          </div>

          <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Choose the LeadClaw plan that fits your clinic growth stage.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted sm:text-xl">
            Every plan is built to help your clinic capture missed website
            enquiries and turn more visitor interest into follow-up-ready leads.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/demo" className="button-secondary">
              View demo
            </Link>
            <Link href="/contact" className="button-primary">
              Talk to us
            </Link>
          </div>

          <p className="mt-5 text-sm text-muted">
            One recovered treatment enquiry can often justify the monthly cost.
          </p>
        </div>
      </div>
    </section>
  );
}
