"use client";

import { useEffect, useState } from "react";

// Overview reuses existing read-only endpoints. No data is mutated here.
type BoardLead = {
  id: string;
  status: string | null;
};

type BoardResponse = {
  ok: boolean;
  summary?: {
    total: number;
    contacted: number;
    replied: number;
    interested: number;
    notInterested: number;
    followUpsDue: number;
  };
  leads?: BoardLead[];
};

type QueueResponse = {
  ok: boolean;
  totalEligible?: number;
  totalChecked?: number;
};

type ActivityResponse = {
  ok: boolean;
  events?: unknown[];
};

type Metric = {
  label: string;
  value: number | null;
  hint: string;
};

export default function OverviewTab() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [partial, setPartial] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function safeJson<T>(url: string): Promise<T | null> {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return (await res.json()) as T;
      } catch {
        return null;
      }
    }

    async function load() {
      setLoading(true);

      const [board, queue, activity] = await Promise.all([
        safeJson<BoardResponse>("/api/lead-ops/board"),
        safeJson<QueueResponse>("/api/admin/outreach/queue"),
        safeJson<ActivityResponse>("/api/ops/activity"),
      ]);

      if (cancelled) return;

      const boardLeads = board?.leads || [];
      const newLeads = boardLeads.filter((l) => l.status === "new").length;
      const doNotContact = boardLeads.filter(
        (l) => l.status === "do_not_contact",
      ).length;

      const next: Metric[] = [
        {
          label: "Eligible outreach leads",
          value: queue?.ok ? queue.totalEligible ?? 0 : null,
          hint: "Leads ready for outreach review",
        },
        {
          label: "New leads",
          value: board?.ok ? newLeads : null,
          hint: "Status: new",
        },
        {
          label: "Contacted leads",
          value: board?.ok ? board.summary?.contacted ?? 0 : null,
          hint: "Contacted or further along",
        },
        {
          label: "Do not contact",
          value: board?.ok ? doNotContact : null,
          hint: "Suppressed from outreach",
        },
        {
          label: "Follow-ups due",
          value: board?.ok ? board.summary?.followUpsDue ?? 0 : null,
          hint: "Due now or overdue",
        },
        {
          label: "Recent activity",
          value: activity?.ok ? (activity.events || []).length : null,
          hint: "Recent operational events",
        },
      ];

      setMetrics(next);
      setPartial(next.some((m) => m.value === null));
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="card-premium p-8 text-sm text-muted">
        Loading overview&hellip;
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {partial && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-900">
          Some metrics could not be loaded and are shown as &ldquo;&mdash;&rdquo;.
          They will populate once their data source is available.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="card-premium p-5">
            <p className="text-sm text-muted">{metric.label}</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">
              {metric.value === null ? "—" : metric.value}
            </p>
            <p className="mt-1 text-xs text-muted">{metric.hint}</p>
          </div>
        ))}
      </div>

      <div className="card-premium p-5 text-sm text-muted">
        Overview is read-only. Use the <strong>Outreach Review</strong> tab to
        review eligible leads and take human actions (Skip, Mark Called, Do Not
        Contact). This workspace never sends outreach emails.
      </div>
    </div>
  );
}
