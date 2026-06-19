import type { Metadata } from "next";
import PublicAuditWidget from "@/components/audit/public-audit-widget";

export const metadata: Metadata = {
  title: "Free AI Website Audit | LeadClaw",
  description:
    "Run a free AI website audit and get an instant score, category breakdown, and prioritised recommendations.",
  alternates: { canonical: "/free-audit" },
};

export default function FreeAuditPage() {
  return (
    <div className="page-hero section-shell">
      <div className="container-shell">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <div className="badge-soft">
              <span className="h-2 w-2 rounded-full bg-brand" />
              Public website audit
            </div>
            <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Find the website gaps costing you enquiries
            </h1>
            <p className="mt-5 text-lg leading-8 text-muted">
              Run LeadClaw’s website audit for an instant overall score,
              category scores, and practical actions across website health,
              SEO, trust, conversion, and AI readiness.
            </p>
          </div>

          <PublicAuditWidget />
        </div>
      </div>
    </div>
  );
}
