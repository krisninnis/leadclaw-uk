import { redirect } from "next/navigation";
import TrackOnMount from "@/components/analytics/track-on-mount";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, SectionHeading, StatCard } from "@/components/ui";
import { getLatestAudit } from "@/lib/audit/store";
import { getLatestScan, getScanHistory } from "@/lib/visibility/store";
import { VISIBILITY_CATEGORY_LABELS } from "@/lib/visibility/types";
import AuditScoreRing from "@/components/audit/audit-score-ring";
import CategoryScoreCard from "@/components/audit/category-score-card";
import RunVisibilityForm from "@/components/visibility/run-visibility-form";
import VisibilityRecommendationsList from "@/components/visibility/visibility-recommendations-list";
import VisibilityCategoryBreakdown from "@/components/visibility/visibility-category-breakdown";
import VisibilityTrend from "@/components/visibility/visibility-trend";
import ProviderCoverage from "@/components/visibility/provider-coverage";
import CompetitorPlaceholder from "@/components/visibility/competitor-placeholder";
import VisibilityHistoryList from "@/components/visibility/visibility-history-list";
import AuditScopeNotice from "@/components/audit/audit-scope-notice";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default async function PortalVisibilityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/portal/visibility");

  const [latest, history, latestAudit] = await Promise.all([
    getLatestScan(user.id),
    getScanHistory(user.id, 10),
    getLatestAudit(user.id),
  ]);

  const hasAudit = Boolean(latestAudit);
  const categories = latest?.meta?.breakdown?.categories || [];

  return (
    <div className="space-y-6">
      <TrackOnMount event="portal_viewed" props={{ section: "visibility" }} />
      {/* Hero */}
      <section className="card-premium p-6 md:p-8">
        <Badge tone="violet">AI Readiness</Badge>
        <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          AI Readiness
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
          See how well your website is set up for AI assistants like ChatGPT, Perplexity, Google
          AI Overviews and Claude to understand, trust, and recommend your business. Your AI
          Readiness Score is built from your latest website audit — it measures how prepared your
          site is, not your live ranking inside any AI system.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {hasAudit ? (
            <RunVisibilityForm
              label={latest ? "Refresh readiness report" : "Generate readiness report"}
            />
          ) : (
            <Link href="/portal/audit" className="button-primary">
              Run a website audit first
            </Link>
          )}
          {hasAudit ? (
            <span className="text-sm text-muted-2">
              Based on your audit of {latestAudit?.website_url}
            </span>
          ) : null}
        </div>
        <AuditScopeNotice className="mt-6 max-w-2xl" />
      </section>

      {latest ? (
        <>
          {/* Score overview */}
          <section className="card-premium p-6 md:p-8">
            <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col items-center gap-4 lg:flex-row lg:gap-8">
                <AuditScoreRing score={latest.visibility_score} label="AI readiness score" />
                <div className="text-center lg:text-left">
                  <p className="text-sm text-muted-2">Latest report</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">
                    {latest.website_url}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Generated {formatDateTime(latest.created_at)}
                  </p>
                  <p className="mt-1 text-xs text-muted-2">
                    Engine {latest.meta?.engineVersion ?? "v1"} · derived from audit run{" "}
                    {formatDateTime(latest.meta?.auditedAt ?? null)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <CategoryScoreCard
                label={VISIBILITY_CATEGORY_LABELS.content}
                score={latest.content_score}
              />
              <CategoryScoreCard
                label={VISIBILITY_CATEGORY_LABELS.authority}
                score={latest.authority_score}
              />
              <CategoryScoreCard
                label={VISIBILITY_CATEGORY_LABELS.citation}
                score={latest.citation_score}
              />
              <CategoryScoreCard
                label={VISIBILITY_CATEGORY_LABELS.schema}
                score={latest.schema_score}
              />
            </div>
          </section>

          {/* Category breakdown */}
          <section className="card-premium p-6 md:p-8">
            <SectionHeading
              eyebrow="Breakdown"
              title="What drives your score"
              description="Each factor is read from your latest website audit and reframed for AI readiness."
              maxWidth="md"
            />
            <div className="mt-6">
              <VisibilityCategoryBreakdown categories={categories} />
            </div>
          </section>

          {/* Recommendations */}
          <section className="card-premium p-6 md:p-8">
            <SectionHeading
              eyebrow="Priority actions"
              title="Improve your AI readiness"
              description="The highest-impact changes to help AI systems find, trust, and recommend you."
              maxWidth="md"
            />
            <div className="mt-6">
              <VisibilityRecommendationsList
                recommendations={latest.recommendations || []}
                limit={8}
              />
            </div>
          </section>
        </>
      ) : (
        <section className="card-premium p-6 md:p-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="AI readiness" value="—" hint="Generate a report to see your score." />
            <StatCard label="Content" value="—" hint="Clarity AI can summarise." />
            <StatCard label="Authority" value="—" hint="Expertise & reputation (E-E-A-T)." />
            <StatCard label="Schema" value="—" hint="Machine-readable structured data." />
          </div>
          <p className="mt-6 text-sm leading-7 text-muted">
            {hasAudit
              ? "Generate your first readiness report above — it’s built instantly from your latest website audit."
              : "Run a website audit first. Your AI readiness report is derived from it, so there’s nothing extra to fill in."}
          </p>
        </section>
      )}

      {/* Trend */}
      <section className="card-premium p-6 md:p-8">
        <SectionHeading
          eyebrow="Trend"
          title="Readiness over time"
          description="Track how your AI readiness moves as you ship improvements."
          maxWidth="md"
        />
        <div className="mt-6">
          <VisibilityTrend history={history} />
        </div>
      </section>

      {/* Competitors (placeholder) */}
      <section className="card-premium p-6 md:p-8">
        <SectionHeading
          eyebrow="Competitors"
          title="How you compare"
          description="Benchmark your AI readiness against the businesses you compete with."
          maxWidth="md"
        />
        <div className="mt-6">
          <CompetitorPlaceholder />
        </div>
      </section>

      {/* Providers */}
      <section className="card-premium p-6 md:p-8">
        <SectionHeading
          eyebrow="Coverage"
          title="AI engines we track"
          description="Live tracking of how each AI system surfaces your business is coming soon."
          maxWidth="md"
        />
        <div className="mt-6">
          <ProviderCoverage />
        </div>
      </section>

      {/* History */}
      <section className="card-premium p-6 md:p-8">
        <SectionHeading
          eyebrow="History"
          title="AI Readiness History"
          description="Every readiness report you’ve generated."
          maxWidth="md"
        />
        <div className="mt-6">
          <VisibilityHistoryList scans={history} />
        </div>
      </section>
    </div>
  );
}
