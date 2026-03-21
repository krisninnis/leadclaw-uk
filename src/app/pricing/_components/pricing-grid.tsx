import Image from "next/image";
import Link from "next/link";
import { plans } from "../pricing-data";

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-5 w-5 text-brand-strong"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.26a1 1 0 0 1-1.42 0L3.29 9.164a1 1 0 0 1 1.414-1.414l4.096 4.096 6.49-6.55a1 1 0 0 1 1.414-.006Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function mascotSrc(slug: "basic" | "growth" | "pro") {
  if (slug === "basic") return "/brand/mascots/fox-starter.png";
  if (slug === "growth") return "/brand/mascots/panther-growth.jpg";
  return "/brand/mascots/dragon-elite.png";
}

function glowClass(slug: "basic" | "growth" | "pro") {
  if (slug === "basic") return "bg-amber-300/30";
  if (slug === "growth") return "bg-violet-500/45";
  return "bg-cyan-300/28";
}

function mascotWrapClass(slug: "basic" | "growth" | "pro") {
  if (slug === "growth") {
    return "border-violet-200 bg-white shadow-[0_12px_30px_rgba(139,92,246,0.18)]";
  }
  if (slug === "basic") {
    return "border-amber-100 bg-white shadow-lg";
  }
  return "border-cyan-100 bg-white shadow-lg";
}

function primaryHref(slug: "basic" | "growth" | "pro") {
  if (slug === "basic") return "/signup?plan=basic";
  return `/free-trial?plan=${slug}`;
}

function primaryLabel(slug: "basic" | "growth" | "pro") {
  if (slug === "basic") return "Start free Basic";
  return "Start 7-day free trial";
}

function supportCopy(slug: "basic" | "growth" | "pro") {
  if (slug === "basic") {
    return "Free forever • no card required";
  }

  if (slug === "growth") {
    return "Try the full Growth package for 7 days • no card required";
  }

  return "Try Pro free for 7 days • no card required";
}

function planSummary(slug: "basic" | "growth" | "pro") {
  if (slug === "basic") {
    return "Built for clinics that want a simple free enquiry widget with self-serve setup.";
  }

  if (slug === "growth") {
    return "Most clinics should start here to experience LeadClaw’s full automation and follow-up workflow.";
  }

  return "Built for clinics that want advanced automation, stronger performance insight, and premium support.";
}

export default function PricingGrid() {
  return (
    <section className="section-shell pt-0">
      <div className="container-shell">
        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.slug}
              className={[
                "relative rounded-[28px] border p-6 pt-16 shadow-[var(--shadow-card)] transition duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[var(--shadow-card-hover)] md:p-8 md:pt-16",
                plan.themeClass,
                plan.featured
                  ? "ring-2 ring-violet-400/70 shadow-[0_18px_45px_rgba(139,92,246,0.14)]"
                  : "",
              ].join(" ")}
            >
              <div className="absolute -top-10 left-1/2 z-10 -translate-x-1/2">
                <div className="relative flex h-20 w-20 items-center justify-center">
                  <div
                    className={[
                      "pointer-events-none absolute h-20 w-20 rounded-full blur-2xl transition duration-300",
                      glowClass(plan.slug),
                    ].join(" ")}
                  />

                  <div
                    className={[
                      "relative flex h-16 w-16 items-center justify-center rounded-full border transition duration-300 hover:scale-[1.04]",
                      mascotWrapClass(plan.slug),
                    ].join(" ")}
                  >
                    <Image
                      src={mascotSrc(plan.slug)}
                      alt={`${plan.name} mascot`}
                      width={56}
                      height={56}
                      className="h-auto w-auto object-contain"
                    />
                  </div>
                </div>
              </div>

              <div className="text-center">
                <div
                  className={[
                    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                    plan.badgeClass,
                  ].join(" ")}
                >
                  {plan.name} • {plan.mascot}
                </div>

                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                  {plan.name}
                </h2>

                <p className="mt-3 text-sm leading-7 text-muted">
                  {plan.description}
                </p>
              </div>

              <div className="mt-8 flex items-end justify-center gap-1">
                <span className="text-5xl font-semibold tracking-tight text-foreground">
                  {plan.price}
                </span>
                <span className="pb-1 text-sm text-muted">{plan.period}</span>
              </div>

              <p className="mt-3 text-center text-sm text-muted">
                {planSummary(plan.slug)}
              </p>

              <div className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <CheckIcon />
                    <span className="text-sm leading-7 text-muted">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-8 text-center">
                <Link
                  href={primaryHref(plan.slug)}
                  className={plan.buttonClass}
                >
                  {primaryLabel(plan.slug)}
                </Link>

                <p className="mt-3 text-xs font-medium text-muted-2">
                  {supportCopy(plan.slug)}
                </p>

                {plan.slug === "growth" ? (
                  <p className="mt-2 text-xs text-muted-2">
                    After your trial, keep Growth, upgrade to Pro, or switch to
                    free Basic.
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
