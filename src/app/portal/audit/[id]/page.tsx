import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, SectionHeading } from "@/components/ui";
import { getAuditById } from "@/lib/audit/store";
import { CATEGORY_LABELS } from "@/lib/audit/types";
import AuditScoreRing from "@/components/audit/audit-score-ring";
import CategoryScoreCard from "@/components/audit/category-score-card";
import RecommendationsList from "@/components/audit/recommendations-list";
import RunAuditForm from "@/components/audit/run-audit-form";
import { Check, X, MinusCircle } from "lucide-react";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default async function AuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/portal/audit/${id}`);

  const audit = await getAuditById(user.id, id);
  if (!audit) notFound();

  const categories = audit.checks?.categories || [];

  return (
    <div className="space-y-6">
      <section className="card-premium p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <AuditScoreRing score={audit.overall_score} size={150} />
            <div className="text-center sm:text-left">
              <Badge tone="brand">Audit report</Badge>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                {audit.website_url}
              </h1>
              <p className="mt-2 text-sm text-muted">Run {formatDateTime(audit.created_at)}</p>
              <p className="mt-1 text-xs text-muted-2">
                Engine {audit.engine_version} · {audit.meta?.responseMs ?? "—"} ms ·{" "}
                {audit.meta?.statusCode ?? "no"} response
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Link href="/portal/audit" className="button-secondary">
              Back to audits
            </Link>
            <RunAuditForm defaultUrl={audit.input_url || audit.website_url} compact />
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <CategoryScoreCard label={CATEGORY_LABELS.health} score={audit.health_score} />
          <CategoryScoreCard label={CATEGORY_LABELS.seo} score={audit.seo_score} />
          <CategoryScoreCard label={CATEGORY_LABELS.trust} score={audit.trust_score} />
          <CategoryScoreCard label={CATEGORY_LABELS.conversion} score={audit.conversion_score} />
          <CategoryScoreCard label={CATEGORY_LABELS.ai_readiness} score={audit.ai_readiness_score} />
        </div>
      </section>

      <section className="card-premium p-6 md:p-8">
        <SectionHeading
          eyebrow="Recommendations"
          title="Prioritised actions"
          description="Ordered by impact — start at the top."
          maxWidth="md"
        />
        <div className="mt-6">
          <RecommendationsList recommendations={audit.recommendations || []} />
        </div>
      </section>

      {categories.map((cat) => {
        const passed = cat.checks.filter((c) => c.passed).length;
        return (
          <section key={cat.category} className="card-premium p-6 md:p-8">
            <div className="flex items-center justify-between gap-4">
              <SectionHeading eyebrow={`${passed}/${cat.checks.length} passed`} title={cat.label} maxWidth="md" />
              <span className="text-3xl font-semibold text-foreground">{cat.score}</span>
            </div>
            <div className="mt-6 space-y-2">
              {cat.checks.map((check) => {
                const Icon = check.passed ? Check : check.score > 0 ? MinusCircle : X;
                const color = check.passed
                  ? "text-emerald-600"
                  : check.score > 0
                    ? "text-amber-600"
                    : "text-rose-600";
                return (
                  <div key={check.id} className="flex items-start gap-3 rounded-[18px] border border-border bg-white p-4">
                    <Icon size={18} className={`mt-0.5 shrink-0 ${color}`} />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{check.label}</p>
                      <p className="mt-1 text-sm text-muted">{check.detail}</p>
                      {check.recommendation ? (
                        <p className="mt-1 text-sm text-brand-strong">→ {check.recommendation}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
