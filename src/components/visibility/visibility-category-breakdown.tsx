// Phase 3 — AI Visibility (Foundation)
// Per-category factor breakdown for the latest scan. Mirrors the audit detail
// view's check list (pass / partial / fail icons) for a consistent feel.

import { Check, X, MinusCircle } from "lucide-react";
import type { VisibilityCategoryResult } from "@/lib/visibility/types";
import { scoreBand, BAND_TEXT, BAND_STROKE } from "@/components/audit/score-utils";

function FactorIcon({ score }: { score: number }) {
  if (score >= 0.999)
    return <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="pass" />;
  if (score <= 0.001)
    return <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-label="fail" />;
  return <MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-label="partial" />;
}

export default function VisibilityCategoryBreakdown({
  categories,
}: {
  categories: VisibilityCategoryResult[];
}) {
  if (!categories || categories.length === 0) return null;

  return (
    <div className="space-y-4">
      {categories.map((cat) => {
        const band = scoreBand(cat.score);
        return (
          <div key={cat.category} className="rounded-[22px] border border-border bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-foreground">{cat.label}</h3>
                <p className="mt-1 text-sm leading-7 text-muted">{cat.description}</p>
              </div>
              <span className={`shrink-0 text-2xl font-semibold ${BAND_TEXT[band]}`}>
                {cat.score}
              </span>
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full"
                style={{ width: `${cat.score}%`, backgroundColor: BAND_STROKE[band] }}
              />
            </div>

            {cat.factors.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {cat.factors.map((f) => (
                  <li key={f.id} className="flex items-start gap-2 text-sm">
                    <FactorIcon score={f.score} />
                    <span className="min-w-0">
                      <span className="font-medium text-foreground">{f.label}</span>
                      <span className="text-muted"> — {f.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted">
                No factors available for this category yet.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
