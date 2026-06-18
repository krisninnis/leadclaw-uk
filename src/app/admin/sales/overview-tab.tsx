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

type MetricMap = Record<string, Metric>;

export default function OverviewTab() {
  const [metrics, setMetrics] = useState<MetricMap | null>(null);
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

      const next: MetricMap = {
        eligible: {
          label: "Eligible outreach leads",
          value: queue?.ok ? queue.totalEligible ?? 0 : null,
          hint: "Ready for outreach review",
        },
        newLeads: {
          label: "New leads",
          value: board?.ok ? newLeads : null,
          hint: "Status: new",
        },
        followUps: {
          label: "Follow-ups due",
          value: board?.ok ? board.summary?.followUpsDue ?? 0 : null,
          hint: "Due now or overdue",
        },
        contacted: {
          label: "Contacted leads",
          value: board?.ok ? board.summary?.contacted ?? 0 : null,
          hint: "Contacted or further along",
        },
        doNotContact: {
          label: "Do not contact",
          value: board?.ok ? doNotContact : null,
          hint: "Suppressed from outreach",
        },
        recentActivity: {
          label: "Recent activity",
          value: activity?.ok ? (activity.events || []).length : null,
          hint: "Recent operational events",
        },
      };

      setMetrics(next);
      setPartial(Object.values(next).some((m) => m.value === null));
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !metrics) {
    return (
      <div className="space-y-6" aria-busy="true">
        {[0, 1].map((section) => (
          <div key={section} className="space-y-3">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((card) => (
                <div key={card} className="card-premium animate-pulse p-5">
                  <div className="h-3 w-28 rounded bg-slate-200" />
                  <div className="mt-3 h-8 w-12 rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-20 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const todayMetrics = [metrics.eligible, metrics.newLeads, metrics.followUps];
  const pipelineMetrics = [
    metrics.contacted,
    metrics.doNotContact,
    metrics.recentActivity,
  ];

  return (
    <div className="space-y-8">
      {partial && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-900">
          Some metrics could not be loaded and are shown as &ldquo;&mdash;&rdquo;.
          They will populate once their data source is available.
        </div>
      )}

      <Section
        title="Today"
        copy="What needs a human eye now: leads ready to review, fresh arrivals, and follow-ups that are due."
        metrics={todayMetrics}
      />

      <Section
        title="Pipeline"
        copy="The wider state of your pipeline: who's been contacted, who's suppressed, and recent activity across the system."
        metrics={pipelineMetrics}
      />

      <div className="card-premium p-5 text-sm text-muted">
        Overview is read-only. Use the <strong>Outreach Review</strong> tab to
        review eligible leads and take human actions (Skip, Mark Called, Do Not
        Contact). This workspace never sends outreach emails.
      </div>
    </div>
  );
}

function Section({
  title,
  copy,
  metrics,
}: {
  title: string;
  copy: string;
  metrics: Metric[];
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <p className="mt-1 text-sm text-muted">{copy}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
    </section>
  );
}
