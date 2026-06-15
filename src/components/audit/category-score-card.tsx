// Per-category score card with a slim progress bar. Reuses the card styling
// conventions used elsewhere in the portal.

import { scoreBand, scoreLabel, BAND_TEXT, BAND_STROKE } from "./score-utils";

type Props = {
  label: string;
  score: number;
  passed?: number;
  total?: number;
};

export default function CategoryScoreCard({ label, score, passed, total }: Props) {
  const band = scoreBand(score);

  return (
    <div className="rounded-2xl border border-border bg-white px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-2">{label}</p>
        <span className={`text-sm font-semibold ${BAND_TEXT[band]}`}>{scoreLabel(score)}</span>
      </div>

      <p className={`mt-2 text-3xl font-semibold ${BAND_TEXT[band]}`}>{score}</p>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, backgroundColor: BAND_STROKE[band] }}
        />
      </div>

      {typeof passed === "number" && typeof total === "number" ? (
        <p className="mt-2 text-sm text-muted">
          {passed} of {total} checks passed
        </p>
      ) : null}
    </div>
  );
}
