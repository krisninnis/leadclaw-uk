import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, SectionHeading, StatCard } from "@/components/ui";
import { getLatestAudit, getAuditHistory } from "@/lib/audit/store";
import { CATEGORY_LABELS } from "@/lib/audit/types";
import AuditScoreRing from "@/components/audit/audit-score-ring";
import CategoryScoreCard from "@/components/audit/category-score-card";
import RecommendationsList from "@/components/audit/recommendations-list";
import RunAuditForm from "@/components/audit/run-audit-form";
import AuditHistoryList from "@/components/audit/audit-history-list";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default async function PortalAuditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/portal/audit");

  const [latest, history] = await Promise.all([
    getLatestAudit(user.id),
    getAuditHistory(user.id, 10),
  ]);

  const defaultUrl = latest?.input_url || latest?.website_url || "";

  return (
    <div className="space-y-6">
      <section className="card-premium p-6 md:p-8">
        <Badge tone="brand">Website audit</Badge>
        <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          AI Website Audit
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
          Enter your website and we&apos;ll score its health, SEO, trust, conversion, and
          AI readiness — with a prioritised list of fixes.
        </p>
        <div className="mt-6 max-w-2xl">
          <RunAuditForm defaultUrl={defaultUrl} compact />
        </div>
      </section>

      {latest ? (
        <>
          {latest.status === "failed" ? (
            <div className="rounded-[24px] border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
              <p className="font-semibold">We couldn&apos;t fully load {latest.website_url}</p>
              <p className="mt-1 leading-7">
                {latest.error || "The site did not respond."} Scores below reflect what we could
                see. Check the URL and try again.
              </p>
            </div>
          ) : null}

          <section className="card-premium p-6 md:p-8">
            <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col items-center gap-4 lg:flex-row lg:gap-8">
                <AuditScoreRing score={latest.overall_score} />
                <div className="text-center lg:text-left">
                  <p className="text-sm text-muted-2">Latest audit</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{latest.website_url}</p>
                  <p className="mt-1 text-sm text-muted">Run {formatDateTime(latest.created_at)}</p>
                  <div className="mt-4">
                    <Link href={`/portal/audit/${latest.id}`} className="button-secondary">
                      View full report
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <CategoryScoreCard label={CATEGORY_LABELS.health} score={latest.health_score} />
              <CategoryScoreCard label={CATEGORY_LABELS.seo} score={latest.seo_score} />
              <CategoryScoreCard label={CATEGORY_LABELS.trust} score={latest.trust_score} />
              <CategoryScoreCard label={CATEGORY_LABELS.conversion} score={latest.conversion_score} />
              <CategoryScoreCard label={CATEGORY_LABELS.ai_readiness} score={latest.ai_readiness_score} />
            </div>
          </section>

          <section className="card-premium p-6 md:p-8">
            <SectionHeading
              eyebrow="Priority actions"
              title="Your top fixes"
              description="The highest-impact improvements from your latest audit."
              maxWidth="md"
            />
            <div className="mt-6">
              <RecommendationsList recommendations={latest.recommendations || []} limit={5} />
            </div>
            <div className="mt-4">
              <Link href={`/portal/audit/${latest.id}`} className="button-secondary">
                See all recommendations
              </Link>
            </div>
          </section>
        </>
      ) : (
        <section className="card-premium p-6 md:p-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Overall" value="—" hint="Run your first audit to see scores." />
            <StatCard label="SEO" value="—" hint="Title, meta, headings, local signals." />
            <StatCard label="Trust" value="—" hint="Contact, reviews, policies." />
            <StatCard label="AI readiness" value="—" hint="Structured data, FAQ, expertise." />
          </div>
        </section>
      )}

      <section className="card-premium p-6 md:p-8">
        <SectionHeading
          eyebrow="History"
          title="Past audits"
          description="Track how your scores change over time."
          maxWidth="md"
        />
        <div className="mt-6">
          <AuditHistoryList audits={history} />
        </div>
      </section>
    </div>
  );
}
