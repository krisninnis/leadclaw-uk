import Link from "next/link";

/**
 * Testimonials scaffold.
 *
 * Intentionally ships with OBVIOUS placeholders, not invented quotes. LeadClaw
 * does not yet have published customer proof, and the homepage must never fake
 * it. When real, verifiable testimonials exist (e.g. a signed quote from a
 * named clinic), drop them into the `testimonials` array below and the section
 * renders them automatically. Until then it shows an honest "early access"
 * placeholder and a route to become a first customer.
 */

type Testimonial = {
  quote: string;
  name: string;
  role: string;
};

// Real customer quotes go here. Empty by design — do not populate with
// invented or unverified testimonials.
const testimonials: Testimonial[] = [];

export default function Testimonials() {
  const hasRealProof = testimonials.length > 0;

  return (
    <section className="section-shell">
      <div className="container-shell">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
            Early access
          </p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {hasRealProof
              ? "What UK teams say about LeadClaw"
              : "Be one of our first customer stories"}
          </h2>
          <p className="mt-4 text-lg leading-8 text-muted">
            {hasRealProof
              ? "Real words from the teams using LeadClaw to capture and follow up on every enquiry."
              : "LeadClaw is early access and founder-led. We would rather show real customer results than invent them — so this space is reserved for verified stories from our first UK teams."}
          </p>
        </div>

        {hasRealProof ? (
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {testimonials.map((item) => (
              <figure key={item.name} className="card-premium p-6">
                <blockquote className="text-base leading-7 text-foreground">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-4 text-sm text-muted">
                  <span className="font-semibold text-foreground">
                    {item.name}
                  </span>
                  <br />
                  {item.role}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="card-premium border-dashed p-6 text-center"
                aria-hidden="true"
              >
                <div className="mx-auto h-2.5 w-2.5 rounded-full bg-brand-soft" />
                <p className="mt-4 text-sm leading-7 text-muted-2">
                  Verified customer story coming soon
                </p>
              </div>
            ))}
          </div>
        )}

        {!hasRealProof && (
          <div className="mt-8 flex justify-center">
            <Link href="/free-trial" className="button-secondary">
              Start a free trial
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
