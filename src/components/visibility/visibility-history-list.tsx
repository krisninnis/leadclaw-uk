// Phase 3 — AI Visibility (Foundation)
// History timeline of past visibility scans. There is no per-scan detail route
// in this phase, so rows are static (not links).

import type { AiVisibilityScanRow } from "@/lib/visibility/types";
import { scoreBand, BAND_TEXT } from "@/components/audit/score-utils";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function VisibilityHistoryList({
  scans,
}: {
  scans: AiVisibilityScanRow[];
}) {
  if (scans.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-border bg-surface-2 p-6 text-sm text-muted">
        <p className="font-medium text-foreground">No readiness reports yet</p>
        <p className="mt-2 leading-7">
          Generate your first report above to start tracking how ready your site is for AI systems.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {scans.map((scan) => {
        const band = scoreBand(scan.visibility_score);
        return (
          <div
            key={scan.id}
            className="flex items-center justify-between gap-4 rounded-[22px] border border-border bg-white p-4"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{scan.website_url}</p>
              <p className="mt-1 text-sm text-muted">{formatDateTime(scan.created_at)}</p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-semibold ${BAND_TEXT[band]}`}>
                {scan.visibility_score}
              </p>
              <p className="text-xs text-muted-2">readiness</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
