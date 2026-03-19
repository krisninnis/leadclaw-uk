import Link from "next/link";

export default function PricingCta() {
  return (
    <section className="section-shell pt-0">
      <div className="container-shell">
        <div className="rounded-[32px] border border-border bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(230,251,255,0.94))] p-8 shadow-[var(--shadow-pop)] md:p-12">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
              Ready to choose a plan?
            </p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
              Start with the plan that fits today and upgrade as your clinic
              grows.
            </h2>
            <p className="mt-5 text-lg leading-8 text-muted">
              Growth is the safest default for most clinics, but every LeadClaw
              plan is designed to help you capture more website opportunities.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/pricing" className="button-primary">
                Start paid plan
              </Link>
              <Link href="/free-trial?plan=growth" className="button-secondary">
                Prefer to try first?
              </Link>
            </div>

            <p className="mt-4 text-xs text-muted-2">
              Start a no-card free trial or go straight to checkout.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
