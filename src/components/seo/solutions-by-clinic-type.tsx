import Link from "next/link";
import { aiReceptionistPages } from "@/lib/ai-receptionist-pages";
import { seoPages } from "@/lib/seo-pages";

type SolutionsByClinicTypeProps = {
  variant?: "homepage" | "card";
  className?: string;
};

const featuredLinks = aiReceptionistPages.map((page) => ({
  href: page.canonicalPath,
  label: page.title.replace(" UK | LeadClaw", "").replace(" | LeadClaw", ""),
  description: page.subheading,
}));

const solutionLinks = [
  ...featuredLinks,
  ...seoPages
    .filter(
      (page) =>
        page.slug !== "ai-receptionist-for-physiotherapy-clinics-uk" &&
        page.slug !== "ai-receptionist-for-chiropractors-uk",
    )
    .map((page) => ({
      href: page.canonicalPath,
      label: page.title.replace(" UK | LeadClaw", "").replace(" | LeadClaw", ""),
      description: page.subheading,
    })),
];

export default function SolutionsByClinicType({
  variant = "homepage",
  className = "",
}: SolutionsByClinicTypeProps) {
  const content = (
    <>
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
          By business type
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Solutions by industry
        </h2>
        <p className="mt-4 text-base leading-7 text-muted md:text-lg">
          See how LeadClaw captures website enquiries, keeps leads in one inbox,
          and follows up automatically for your industry - from aesthetic and
          dental clinics to physiotherapists, plumbers, agencies, and other UK
          service businesses.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {solutionLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group rounded-[22px] border border-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-card)]"
          >
            <span className="text-base font-semibold text-foreground group-hover:text-brand-strong">
              {link.label}
            </span>
            <span className="mt-2 block text-sm leading-7 text-muted">
              {link.description}
            </span>
          </Link>
        ))}
      </div>
    </>
  );

  if (variant === "card") {
    return (
      <section
        className={`rounded-[24px] border border-border bg-white p-6 md:p-8 ${className}`}
      >
        {content}
      </section>
    );
  }

  return (
    <section className={`section-shell bg-white/40 ${className}`}>
      <div className="container-shell">{content}</div>
    </section>
  );
}
