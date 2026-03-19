import Link from "next/link";
import Badge from "@/components/ui/badge";

type PlanCardProps = {
  name: string;
  slug: "starter" | "growth" | "pro";
  price: string;
  period?: string;
  description: string;
  mascot: string;
  features: string[];
  ctaHref: string;
  ctaLabel: string;
  featured?: boolean;
};

const themeMap = {
  starter: {
    card: "border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.95),rgba(255,255,255,0.96))]",
    badge: "amber" as const,
    button:
      "inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-600",
  },
  growth: {
    card: "border-violet-200 bg-[linear-gradient(180deg,rgba(248,245,255,0.96),rgba(255,255,255,0.96))]",
    badge: "violet" as const,
    button: "button-primary",
  },
  pro: {
    card: "border-cyan-200 bg-[linear-gradient(180deg,rgba(236,254,255,0.96),rgba(255,255,255,0.96))]",
    badge: "cyan" as const,
    button:
      "inline-flex items-center justify-center rounded-full bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700",
  },
};

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

export default function PlanCard({
  name,
  slug,
  price,
  period = "/month",
  description,
  mascot,
  features,
  ctaHref,
  ctaLabel,
  featured = false,
}: PlanCardProps) {
  const theme = themeMap[slug];

  return (
    <article
      className={[
        "relative rounded-[28px] border p-6 shadow-[var(--shadow-card)] transition duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)] md:p-8",
        theme.card,
        featured ? "ring-2 ring-violet-400/70" : "",
      ].join(" ")}
    >
      {featured ? (
        <div className="absolute -top-3 left-6 rounded-full bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm">
          Most popular
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge tone={theme.badge}>
            {name} • {mascot}
          </Badge>

          <h3 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
            {name}
          </h3>

          <p className="mt-3 text-sm leading-7 text-muted">{description}</p>
        </div>

        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/70 bg-white/80 text-lg font-bold text-foreground shadow-sm">
          {mascot.charAt(0)}
        </div>
      </div>

      <div className="mt-8 flex items-end gap-1">
        <span className="text-5xl font-semibold tracking-tight text-foreground">
          {price}
        </span>
        <span className="pb-1 text-sm text-muted">{period}</span>
      </div>

      <div className="mt-8 space-y-3">
        {features.map((feature) => (
          <div key={feature} className="flex items-start gap-3">
            <CheckIcon />
            <span className="text-sm leading-7 text-muted">{feature}</span>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Link href={ctaHref} className={theme.button}>
          {ctaLabel}
        </Link>
      </div>
    </article>
  );
}
