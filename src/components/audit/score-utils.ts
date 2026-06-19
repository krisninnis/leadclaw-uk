// Shared presentation helpers for audit scores.

export type ScoreBand = "good" | "fair" | "poor";

// Urgency bands shown across the audit UI:
//   Healthy (80–100) · Needs work (60–79) · At risk (<60)
export function scoreBand(score: number): ScoreBand {
  if (score >= 80) return "good";
  if (score >= 60) return "fair";
  return "poor";
}

export function scoreLabel(score: number): string {
  const band = scoreBand(score);
  return band === "good"
    ? "Healthy"
    : band === "fair"
      ? "Needs work"
      : "At risk";
}

// Tailwind colour classes per band (text + ring + soft background).
export const BAND_TEXT: Record<ScoreBand, string> = {
  good: "text-emerald-600",
  fair: "text-amber-600",
  poor: "text-rose-600",
};

export const BAND_STROKE: Record<ScoreBand, string> = {
  good: "#059669", // emerald-600
  fair: "#d97706", // amber-600
  poor: "#e11d48", // rose-600
};

export const BAND_BADGE: Record<ScoreBand, "brand" | "amber" | "neutral"> = {
  good: "brand",
  fair: "amber",
  poor: "neutral",
};

export const SEVERITY_BADGE: Record<
  "high" | "medium" | "low",
  { label: string; classes: string }
> = {
  high: { label: "High priority", classes: "border-rose-200 bg-rose-50 text-rose-700" },
  medium: { label: "Medium", classes: "border-amber-200 bg-amber-50 text-amber-700" },
  low: { label: "Low", classes: "border-sky-200 bg-sky-50 text-sky-700" },
};
