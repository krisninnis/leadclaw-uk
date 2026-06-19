// Severity-aware conversion block for the audit report.
//
// Routing rule (V2.1a):
//   • Any high-severity finding  -> primary CTA "Book a demo" (/demo)
//   • Otherwise                  -> primary CTA "Start free trial" (/free-trial)
//   • Secondary CTA always       -> re-run the audit
//
// Pure presentational + a client re-run form. No tracking, no schema.

import Link from "next/link";
import type { Recommendation } from "@/lib/audit/types";
import RunAuditForm from "./run-audit-form";

type Props = {
  recommendations: Recommendation[];
  // URL to prefill into the re-run form (the audited site).
  rerunUrl?: string;
};

export function hasHighSeverity(recommendations: Recommendation[]): boolean {
  return recommendations.some((r) => r.severity === "high");
}

export default function AuditCta({ recommendations, rerunUrl }: Props) {
  const highSeverity = hasHighSeverity(recommendations);

  const primary = highSeverity
    ? {
        href: "/demo",
        label: "Book a demo",
        heading: "Some high-priority issues need attention",
        body: "These gaps are the kind that quietly cost you customers. Book a demo and we’ll walk through fixing them for you.",
      }
    : {
        href: "/free-trial",
        label: "Start free trial",
        heading: "You’re in good shape — let’s push it further",
        body: "No critical issues stand out. Start a free trial to tighten the remaining gaps and track your score over time.",
      };

  return (
    <section className="card-premium p-6 md:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {primary.heading}
          </h2>
          <p className="mt-2 text-sm leading-7 text-muted">{primary.body}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-3">
          <Link href={primary.href} className="button-primary whitespace-nowrap text-center">
            {primary.label}
          </Link>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-2">
              Re-run audit
            </p>
            <RunAuditForm defaultUrl={rerunUrl} compact />
          </div>
        </div>
      </div>
    </section>
  );
}
