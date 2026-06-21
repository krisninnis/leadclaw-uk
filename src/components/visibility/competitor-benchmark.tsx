// AI Readiness — Competitor Benchmarking V1
// Server-rendered comparison: summary stats (your score, competitor average,
// your rank, gap to leader), a side-by-side table (overall + the four category
// scores), and the suggested actions where competitors beat you. The
// interactive add/remove/run controls live in the CompetitorManager client
// component embedded at the top.

import { StatCard } from "@/components/ui";
import { scoreBand, BAND_TEXT } from "@/components/audit/score-utils";
import {
  VISIBILITY_CATEGORY_LABELS,
  type VisibilityScores,
} from "@/lib/visibility/types";
import type {
  BenchmarkSummary,
  CompetitorWithScan,
} from "@/lib/visibility/competitors-types";
import { competitorLabel } from "@/lib/visibility/competitor-benchmark";
import CompetitorManager, {
  type ManagerCompetitor,
} from "./competitor-manager";

const LIMITATION =
  "This compares AI readiness signals from website audits. It does not yet measure live ChatGPT, Perplexity or Claude rankings.";

type Props = {
  hasReadiness: boolean;
  yourWebsiteUrl: string | null;
  yourScores: VisibilityScores | null;
  yourCheckedAt: string | null;
  competitors: CompetitorWithScan[];
  benchmark: BenchmarkSummary | null;
  max: number;
};

type RowState = "scored" | "failed" | "pending";

type TableRow = {
  key: string;
  label: string;
  websiteUrl: string;
  isYou: boolean;
  state: RowState;
  scores: VisibilityScores | null;
  lastCheckedAt: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function rowState(c: CompetitorWithScan): RowState {
  const scan = c.latestScan;
  if (!scan) return "pending";
  return scan.status === "completed" ? "scored" : "failed";
}

export default function CompetitorBenchmark({
  hasReadiness,
  yourWebsiteUrl,
  yourScores,
  yourCheckedAt,
  competitors,
  benchmark,
  max,
}: Props) {
  const managerRows: ManagerCompetitor[] = competitors.map((c) => ({
    id: c.competitor.id,
    websiteUrl: c.competitor.website_url,
    label: competitorLabel(c),
    state: rowState(c),
    lastCheckedAt: c.latestScan?.created_at ?? null,
  }));

  const hasComparison =
    hasReadiness &&
    !!benchmark &&
    !!yourScores &&
    benchmark.scoredCompetitorCount > 0;

  // Build the comparison table: you + each competitor, ranked by overall score
  // (unscored rows sink to the bottom) so the user can read their rank visually.
  const rows: TableRow[] = [];
  if (hasComparison && yourScores) {
    rows.push({
      key: "you",
      label: "You",
      websiteUrl: yourWebsiteUrl ?? "",
      isYou: true,
      state: "scored",
      scores: yourScores,
      lastCheckedAt: yourCheckedAt,
    });
    for (const c of competitors) {
      const state = rowState(c);
      rows.push({
        key: c.competitor.id,
        label: competitorLabel(c),
        websiteUrl: c.competitor.website_url,
        isYou: false,
        state,
        scores: state === "scored" ? c.latestScan!.scores : null,
        lastCheckedAt: c.latestScan?.created_at ?? null,
      });
    }
    rows.sort((a, b) => overallOf(b) - overallOf(a));
  }

  return (
    <div className="space-y-6">
      <CompetitorManager competitors={managerRows} max={max} />

      {!hasReadiness ? (
        <p className="rounded-[18px] border border-dashed border-border bg-surface-2 p-4 text-sm leading-7 text-muted">
          Generate your AI readiness report above first — then add competitors to
          see how you compare.
        </p>
      ) : null}

      {hasReadiness && !hasComparison && competitors.length > 0 ? (
        <p className="rounded-[18px] border border-dashed border-border bg-surface-2 p-4 text-sm leading-7 text-muted">
          Run the benchmark to audit your competitors and see how your AI
          readiness compares.
        </p>
      ) : null}

      {hasComparison && benchmark ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Your score"
              value={`${benchmark.yourScore}`}
              hint="AI readiness"
            />
            <StatCard
              label="Competitor average"
              value={`${benchmark.competitorAverage ?? "—"}`}
              hint={`Across ${benchmark.scoredCompetitorCount} competitor${
                benchmark.scoredCompetitorCount === 1 ? "" : "s"
              }`}
            />
            <StatCard
              label="Your rank"
              value={
                benchmark.yourRank
                  ? `${benchmark.yourRank} of ${benchmark.fieldSize}`
                  : "—"
              }
              hint={
                benchmark.yourRank === 1
                  ? "You lead the field"
                  : "Among you + competitors"
              }
            />
            <StatCard
              label="Gap to leader"
              value={
                benchmark.gapToLeader === 0
                  ? "Leading"
                  : `${benchmark.gapToLeader} pts`
              }
              hint={
                benchmark.gapToLeader === 0
                  ? "No one is ahead of you"
                  : benchmark.best
                    ? `Behind ${benchmark.best.label}`
                    : "Behind the leader"
              }
            />
          </div>

          <div className="overflow-x-auto rounded-[22px] border border-border bg-white">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-[0.12em] text-muted-2">
                  <th className="px-4 py-3 font-medium">Website</th>
                  <th className="px-3 py-3 text-center font-medium">Score</th>
                  <th className="px-3 py-3 text-center font-medium">
                    {VISIBILITY_CATEGORY_LABELS.content}
                  </th>
                  <th className="px-3 py-3 text-center font-medium">
                    {VISIBILITY_CATEGORY_LABELS.authority}
                  </th>
                  <th className="px-3 py-3 text-center font-medium">
                    {VISIBILITY_CATEGORY_LABELS.citation}
                  </th>
                  <th className="px-3 py-3 text-center font-medium">
                    {VISIBILITY_CATEGORY_LABELS.schema}
                  </th>
                  <th className="px-4 py-3 font-medium">Last checked</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.key}
                    className={`border-b border-border last:border-0 ${
                      row.isYou ? "bg-brand-soft" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {row.label}
                        </span>
                        {row.isYou ? (
                          <span className="rounded-full bg-brand-strong px-2 py-0.5 text-[11px] font-semibold text-white">
                            You
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-2">
                        {row.websiteUrl}
                      </p>
                    </td>
                    {row.state === "scored" && row.scores ? (
                      <>
                        <ScoreCell value={row.scores.visibility_score} strong />
                        <ScoreCell value={row.scores.content_score} />
                        <ScoreCell value={row.scores.authority_score} />
                        <ScoreCell value={row.scores.citation_score} />
                        <ScoreCell value={row.scores.schema_score} />
                      </>
                    ) : (
                      <td
                        colSpan={5}
                        className="px-3 py-3 text-center text-xs text-muted-2"
                      >
                        {row.state === "failed"
                          ? "Couldn't check this site"
                          : "Not checked yet"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-xs text-muted">
                      {formatDateTime(row.lastCheckedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-2">
              Where competitors beat you
            </p>
            {benchmark.topGaps.length > 0 ? (
              <div className="mt-3 space-y-3">
                {benchmark.topGaps.map((gap) => (
                  <div
                    key={gap.category}
                    className="rounded-[18px] border border-border bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-foreground">
                        Improve your {gap.categoryLabel.toLowerCase()} signals
                      </p>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        Est. +{gap.estimatedPointGain} to your score
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-muted">
                      You score {gap.yourScore} on {gap.categoryLabel}. The best
                      competitor ({gap.competitorBestLabel}) scores{" "}
                      {gap.competitorBest} and the competitor average is{" "}
                      {gap.competitorAverage} — closing this {gap.gap}-point gap
                      is where you’ll gain the most ground.
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-[18px] border border-emerald-200 bg-emerald-50 p-4 text-sm leading-7 text-emerald-900">
                You match or beat your competitors on every readiness category we
                measure. Keep your audit fresh to hold the lead.
              </p>
            )}
          </div>
        </>
      ) : null}

      <p className="rounded-[18px] border border-border bg-surface-2 p-4 text-xs leading-6 text-muted">
        {LIMITATION}
      </p>
    </div>
  );
}

function overallOf(row: TableRow): number {
  return row.state === "scored" && row.scores
    ? row.scores.visibility_score
    : -1;
}

function ScoreCell({ value, strong }: { value: number; strong?: boolean }) {
  const band = scoreBand(value);
  return (
    <td className="px-3 py-3 text-center">
      <span
        className={`${strong ? "text-base font-semibold" : "text-sm font-medium"} ${BAND_TEXT[band]}`}
      >
        {value}
      </span>
    </td>
  );
}
