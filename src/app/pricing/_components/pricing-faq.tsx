import { faqs } from "../pricing-data";

export default function PricingFaq() {
  return (
    <section className="section-shell">
      <div className="container-shell">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card-premium p-6 md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
              Value framing
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              The real cost is usually the admin your team repeats every week.
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted">
              Businesses spend time chasing enquiries, returning missed calls,
              and following up manually. LeadClaw helps reduce that friction
              with an AI receptionist and simple follow-up support.
            </p>

            <div className="mt-8 rounded-[24px] border border-border bg-white p-5">
              <p className="text-sm font-medium text-muted">Simple ROI idea</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                One saved admin hour can outweigh the subscription.
              </p>
              <p className="mt-2 text-sm leading-7 text-muted">
                That makes enquiry capture, missed call recovery, and follow-up
                support easy to value.
              </p>
            </div>
          </div>

          <div className="card-premium p-6 md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
              Frequently asked questions
            </p>

            <div className="mt-5 space-y-4">
              {faqs.map((faq) => (
                <div
                  key={faq.question}
                  className="rounded-[22px] border border-border bg-white p-5"
                >
                  <h3 className="text-base font-semibold text-foreground">
                    {faq.question}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-muted">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
