// Phase 3 — AI Visibility (Foundation)
// Trend section. When 2+ historical scans exist we render a lightweight SVG
// sparkline of the overall visibility score over time. Until then (and for the
// richer per-provider trends that arrive with real integrations) we show a
// tasteful "Coming soon" placeholder so the section never feels broken.

import type { AiVisibilityScanRow } from "@/lib/visibility/types";
import { BAND_STROKE, scoreBand } from "@/components/audit/score-utils";

function Sparkline({ scores }: { scores: number[] }) {
  const w = 560;
  const h = 120;
  const pad = 8;
  const max = 100;
  const n = scores.length;
  const stepX = (w - pad * 2) / Math.max(1, n - 1);
  const points = scores.map((s, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - s / max) * (h - pad * 2);
    return [x, y] as const;
  });
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const last = scores[scores.length - 1];
  const stroke = BAND_STROKE[scoreBand(last)];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-32 w-full"
      role="img"
      aria-label="AI readiness score trend"
      preserveAspectRatio="none"
    >
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#e5e7eb" strokeWidth={1} />
      <path d={path} fill="none" stroke={stroke} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3.5} fill={stroke} />
      ))}
    </svg>
  );
}

export default function VisibilityTrend({ history }: { history: AiVisibilityScanRow[] }) {
  // Oldest → newest for the timeline direction.
  const ordered = [...history].reverse();
  const scores = ordered.map((s) => s.visibility_score);

  if (scores.length >= 2) {
    return (
      <div>
        <Sparkline scores={scores} />
        <div className="mt-3 flex items-center justify-between text-xs text-muted-2">
          <span>{new Date(ordered[0].created_at).toLocaleDateString()}</span>
          <span>Overall readiness score over time</span>
          <span>{new Date(ordered[ordered.length - 1].created_at).toLocaleDateString()}</span>
        </div>
        <p className="mt-4 rounded-[18px] border border-dashed border-border bg-surface-2 px-4 py-3 text-sm text-muted">
          Per-engine trends (ChatGPT, Perplexity, Google AI Overviews, Claude) are coming soon.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[22px] border border-dashed border-border bg-surface-2 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl shadow-sm">
        📈
      </div>
      <p className="mt-3 font-medium text-foreground">Trend chart coming soon</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted">
        Generate a few reports over time and your AI readiness trend will appear here —
        with per-engine breakdowns once provider tracking goes live.
      </p>
    </div>
  );
}
