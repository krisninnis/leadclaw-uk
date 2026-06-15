// Audit history timeline — links each past run to its detail page.

import Link from "next/link";
import type { WebsiteAuditRow } from "@/lib/audit/types";
import { scoreBand, BAND_TEXT } from "./score-utils";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function AuditHistoryList({ audits }: { audits: WebsiteAuditRow[] }) {
  if (audits.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-border bg-surface-2 p-6 text-sm text-muted">
        <p className="font-medium text-foreground">No audits yet</p>
        <p className="mt-2 leading-7">
          Run your first website audit above to see your scores and recommendations here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {audits.map((audit) => {
        const band = scoreBand(audit.overall_score);
        return (
          <Link
            key={audit.id}
            href={`/portal/audit/${audit.id}`}
            className="flex items-center justify-between gap-4 rounded-[22px] border border-border bg-white p-4 transition hover:border-brand hover:shadow-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{audit.website_url}</p>
              <p className="mt-1 text-sm text-muted">
                {formatDateTime(audit.created_at)}
                {audit.status === "failed" ? " · could not load site" : ""}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-semibold ${BAND_TEXT[band]}`}>{audit.overall_score}</p>
              <p className="text-xs text-muted-2">overall</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
