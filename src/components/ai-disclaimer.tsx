import { AI_DISCLAIMER_TITLE, AI_DISCLAIMER_POINTS } from "@/lib/legal-consent";

type Props = {
  className?: string;
};

// Presentational AI-reliability disclaimer (Part 5). Pure component (no client
// state) so it can be embedded in both server and client pages. Placed in
// legal/settings/help locations only — never in the primary capture UX.
export default function AiDisclaimer({ className = "" }: Props) {
  return (
    <div
      className={`rounded-[24px] border border-border bg-surface-2 p-5 text-sm leading-7 text-muted ${className}`}
    >
      <h2 className="text-base font-semibold text-foreground">
        {AI_DISCLAIMER_TITLE}
      </h2>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        {AI_DISCLAIMER_POINTS.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </div>
  );
}
