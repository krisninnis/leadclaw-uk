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
              Start free, try full automation, and upgrade when your clinic is
              ready.
            </h2>
            <p className="mt-5 text-lg leading-8 text-muted">
              Start on a 7-day Growth trial to experience the full LeadClaw
              workflow, then keep Growth, upgrade to Pro, or switch to the free
              Basic plan.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/free-trial?plan=growth" className="button-primary">
                Start 7-day free trial
              </Link>
              <Link href="/pricing" className="button-secondary">
                Compare plans
              </Link>
            </div>

            <p className="mt-4 text-xs text-muted-2">
              No card required to try Growth. Switch to Basic anytime if you
              want the free widget-only option.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
