// Overall-score radial gauge. Pure SVG, server-renderable.

import { scoreBand, scoreLabel, BAND_STROKE, BAND_TEXT } from "./score-utils";

type Props = {
  score: number;
  size?: number;
  label?: string;
};

export default function AuditScoreRing({ score, size = 180, label = "Overall score" }: Props) {
  const band = scoreBand(score);
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${score} out of 100`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={BAND_STROKE[band]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="46%"
          textAnchor="middle"
          dominantBaseline="middle"
          className={`fill-current ${BAND_TEXT[band]}`}
          style={{ fontSize: size * 0.26, fontWeight: 700 }}
        >
          {score}
        </text>
        <text
          x="50%"
          y="64%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-current text-muted"
          style={{ fontSize: size * 0.08 }}
        >
          / 100
        </text>
      </svg>
      <p className={`mt-2 text-sm font-semibold ${BAND_TEXT[band]}`}>{scoreLabel(score)}</p>
    </div>
  );
}
