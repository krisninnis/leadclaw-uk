import { comparisonRows } from "../pricing-data";

export default function PricingComparison() {
  return (
    <>
      <section className="section-shell">
        <div className="container-shell">
          <div className="card-premium p-6 md:p-8">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
                  Which plan is right for you?
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                  Pick the plan that matches your team&apos;s current workflow.
                </h2>
                <p className="mt-4 text-lg leading-8 text-muted">
                  Basic is for simple request capture. Growth adds core
                  follow-up automation. Pro is for teams that need more advanced
                  extraction, reporting, and support.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 p-5">
                  <p className="text-sm font-medium text-amber-800">Basic</p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                    Capture requests
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Best for businesses starting with a lightweight intake
                    widget and lead inbox.
                  </p>
                </div>

                <div className="rounded-[24px] border border-violet-200 bg-violet-50/80 p-5">
                  <p className="text-sm font-medium text-violet-800">Growth</p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                    Automate follow-up
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    The strongest all-round choice for teams ready to automate
                    common intake and follow-up work.
                  </p>
                </div>

                <div className="rounded-[24px] border border-cyan-200 bg-cyan-50/80 p-5">
                  <p className="text-sm font-medium text-cyan-800">Pro</p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                    Extend workflows
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Ideal for teams that need document extraction, reporting,
                    analytics, and priority onboarding.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell bg-white/40">
        <div className="container-shell">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
              Compare plans
            </p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              A clear view of what changes as your workflows grow
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted">
              Keep the choice simple. Every plan captures requests. The
              difference is how much automation, reporting, and support your
              workspace needs.
            </p>
          </div>

          <div className="mt-10 overflow-hidden rounded-[28px] border border-border bg-white shadow-[var(--shadow-card)]">
            <div className="grid grid-cols-4 border-b border-border bg-surface-2 text-sm font-semibold text-foreground">
              <div className="p-4 md:p-5">Feature</div>
              <div className="p-4 text-center md:p-5">Basic</div>
              <div className="bg-violet-50/70 p-4 text-center md:p-5">
                Growth
              </div>
              <div className="p-4 text-center md:p-5">Pro</div>
            </div>

            {comparisonRows.map((row, index) => (
              <div
                key={row.label}
                className={[
                  "grid grid-cols-4 text-sm",
                  index !== comparisonRows.length - 1
                    ? "border-b border-border"
                    : "",
                ].join(" ")}
              >
                <div className="p-4 font-medium text-foreground md:p-5">
                  {row.label}
                </div>
                <div className="p-4 text-center text-muted md:p-5">
                  {row.values[0]}
                </div>
                <div className="bg-violet-50/40 p-4 text-center text-muted md:p-5">
                  {row.values[1]}
                </div>
                <div className="p-4 text-center text-muted md:p-5">
                  {row.values[2]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
