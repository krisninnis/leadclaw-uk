// Phase 3 — AI Visibility (Foundation)
// Prioritised visibility recommendations. Reuses the audit severity badge
// styling so the two features feel like one product.

import type { VisibilityRecommendation } from "@/lib/visibility/types";
import { SEVERITY_BADGE } from "@/components/audit/score-utils";

type Props = {
  recommendations: VisibilityRecommendation[];
  limit?: number;
  title?: string;
};

export default function VisibilityRecommendationsList({
  recommendations,
  limit,
  title,
}: Props) {
  const items = limit ? recommendations.slice(0, limit) : recommendations;

  if (items.length === 0) {
    return (
      <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        <p className="font-medium">Strong AI readiness foundations</p>
        <p className="mt-1 leading-7">
          Every readiness factor we can derive from your audit is in good shape.
          Re-run periodically as your site changes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {title ? (
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-2">
          {title}
        </p>
      ) : null}
      {items.map((rec) => {
        const sev = SEVERITY_BADGE[rec.severity];
        return (
          <div key={rec.id} className="rounded-[22px] border border-border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-foreground">{rec.title}</p>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted">
                  {rec.categoryLabel}
                </span>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${sev.classes}`}>
                  {sev.label}
                </span>
              </div>
            </div>
            <p className="mt-2 text-sm leading-7 text-muted">{rec.detail}</p>
          </div>
        );
      })}
    </div>
  );
}
