// Renders the concrete proof behind a finding (the `evidence` on a check or
// recommendation). Purely additive: shows nothing when there is no evidence.

import type { CheckEvidence } from "@/lib/audit/types";

type Props = {
  evidence?: CheckEvidence;
  className?: string;
};

function hasContent(e?: CheckEvidence): e is CheckEvidence {
  if (!e) return false;
  return (
    typeof e.snippet === "string" ||
    typeof e.found === "string" ||
    typeof e.count === "number" ||
    (Array.isArray(e.sample) && e.sample.length > 0)
  );
}

export default function AuditEvidence({ evidence, className }: Props) {
  if (!hasContent(evidence)) return null;

  return (
    <div
      className={`mt-2 rounded-[14px] border border-border bg-surface-2 px-3 py-2 text-xs text-muted ${className ?? ""}`}
    >
      <span className="font-semibold uppercase tracking-[0.12em] text-muted-2">
        Evidence
      </span>
      <div className="mt-1 space-y-1">
        {evidence.found ? (
          <p>
            Found: <span className="font-medium text-foreground">{evidence.found}</span>
          </p>
        ) : null}
        {evidence.snippet ? (
          <p className="break-words">
            <span className="font-mono text-foreground">“{evidence.snippet}”</span>
          </p>
        ) : null}
        {typeof evidence.count === "number" ? (
          <p>
            Count: <span className="font-medium text-foreground">{evidence.count}</span>
          </p>
        ) : null}
        {evidence.sample && evidence.sample.length > 0 ? (
          <ul className="list-inside list-disc break-words">
            {evidence.sample.map((s, idx) => (
              <li key={idx} className="font-mono text-foreground">
                {s}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
