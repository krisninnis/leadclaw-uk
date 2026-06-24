"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// SEO Content Queue — Command Centre section.
//
// Read-only view of the SEO Content Engine (curated backlog + scoring + clusters
// + next-article recommendation) with a lightweight status workflow. Status
// writes hit only the seo_content_status overlay via POST. Nothing here touches
// Lead Finder, the scraper, outreach, billing, or auth.

type ContentStatus = "backlog" | "planned" | "in_progress" | "published";

type Scores = { commercial: number; seo: number; productFit: number };

type Opportunity = {
  slug: string;
  title: string;
  primaryKeyword: string;
  cluster: string;
  industry: string;
  funnelStage: "TOFU" | "MOFU" | "BOFU";
  audience: string;
  pillar: boolean;
  scores: Scores;
  total: number;
  rank: number;
  status: ContentStatus;
  whyItMatters: string;
  internalLinks: string[];
  recommendedCta: string;
};

type NextArticle = {
  title: string;
  slug: string;
  primaryKeyword: string;
  clusterLabel: string;
  targetAudience: string;
  funnelStage: string;
  total: number;
  scores: Scores;
  whyItMatters: string;
  internalLinksToAdd: string[];
  recommendedCta: string;
} | null;

type Summary = {
  totalOpportunities: number;
  backlog: number;
  planned: number;
  inProgress: number;
  published: number;
  byCluster: { cluster: string; label: string; count: number; topTotal: number }[];
};

type Payload = {
  ok: boolean;
  error?: string;
  statusTableReady: boolean;
  nextArticle: NextArticle;
  summary: Summary;
  opportunities: Opportunity[];
  inventory: {
    summary: { total: number; byFunnel: Record<string, number>; bySource: Record<string, number> };
    duplicates: string[];
  };
};

const STATUS_META: Record<ContentStatus, { label: string; cls: string }> = {
  backlog: { label: "Backlog", cls: "bg-slate-100 text-slate-700" },
  planned: { label: "Planned", cls: "bg-sky-100 text-sky-700" },
  in_progress: { label: "In Progress", cls: "bg-amber-100 text-amber-700" },
  published: { label: "Published", cls: "bg-emerald-100 text-emerald-700" },
};

const FUNNEL_CLS: Record<string, string> = {
  TOFU: "bg-violet-100 text-violet-700",
  MOFU: "bg-indigo-100 text-indigo-700",
  BOFU: "bg-emerald-100 text-emerald-700",
};

const NEXT_STATUS: { value: ContentStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "published", label: "Published" },
  { value: "backlog", label: "Backlog" },
];

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

export default function SeoContentQueue() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cluster, setCluster] = useState<string>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/seo-content", { cache: "no-store" });
      const body = (await res.json()) as Payload;
      if (!res.ok || !body.ok) {
        setError(body.error || `Request failed (${res.status})`);
        setData(null);
      } else {
        setData(body);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = useCallback(
    async (slug: string, status: ContentStatus) => {
      setBusy(slug);
      try {
        const res = await fetch(`/api/admin/seo-content/${slug}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) setError(json.error || `Action failed (${res.status})`);
        else await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "action_failed");
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  const clusters = useMemo(() => {
    if (!data) return [];
    return [
      { cluster: "all", label: "All", count: data.summary.totalOpportunities },
      ...data.summary.byCluster,
    ];
  }, [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    return cluster === "all"
      ? data.opportunities
      : data.opportunities.filter((o) => o.cluster === cluster);
  }, [data, cluster]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-base font-semibold text-foreground md:text-lg">
            SEO Content Queue
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            What LeadClaw should publish next — scored, clustered, and ranked.
          </p>
        </div>
        <span className="text-slate-400">{open ? "▾" : "▸"}</span>
      </button>

      {open ? (
        <div className="border-t border-slate-100 p-5">
          {error ? (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {data && !data.statusTableReady ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Status table not found yet — the queue is fully functional but status
              changes won&apos;t persist. Apply migration{" "}
              <code>20260624_add_seo_content_status.sql</code> to enable saving.
            </div>
          ) : null}

          {/* Next Article Recommendation */}
          {data?.nextArticle ? (
            <div className="mb-5 rounded-xl border border-brand/30 bg-brand/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-strong">
                ▶ Publish next
              </p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">
                {data.nextArticle.title}
              </h3>
              <div className="mt-2 grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <span className="text-slate-500">Primary keyword:</span>{" "}
                  <span className="font-medium">{data.nextArticle.primaryKeyword}</span>
                </div>
                <div>
                  <span className="text-slate-500">Audience:</span>{" "}
                  {data.nextArticle.targetAudience}
                </div>
                <div>
                  <span className="text-slate-500">Cluster:</span>{" "}
                  {data.nextArticle.clusterLabel} · {data.nextArticle.funnelStage}
                </div>
                <div>
                  <span className="text-slate-500">Score:</span>{" "}
                  <span className="font-semibold">{data.nextArticle.total}/30</span>{" "}
                  <span className="text-xs text-slate-400">
                    (C{data.nextArticle.scores.commercial}/S{data.nextArticle.scores.seo}/P
                    {data.nextArticle.scores.productFit})
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                <span className="text-slate-500">Why it matters:</span>{" "}
                {data.nextArticle.whyItMatters}
              </p>
              <p className="mt-2 text-sm">
                <span className="text-slate-500">Internal links to add:</span>{" "}
                {data.nextArticle.internalLinksToAdd.map((l, i) => (
                  <span key={l}>
                    {i > 0 ? ", " : ""}
                    <code className="text-brand-strong">{l}</code>
                  </span>
                ))}
              </p>
              <p className="mt-2 text-sm">
                <span className="text-slate-500">Recommended CTA:</span>{" "}
                <span className="font-medium">{data.nextArticle.recommendedCta}</span>
              </p>
            </div>
          ) : null}

          {/* Summary cards */}
          {data ? (
            <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Metric label="Opportunities" value={data.summary.totalOpportunities} />
              <Metric label="Backlog" value={data.summary.backlog} />
              <Metric label="Planned" value={data.summary.planned} />
              <Metric label="In Progress" value={data.summary.inProgress} />
              <Metric label="Published" value={data.summary.published} />
            </div>
          ) : null}

          {/* Audit line */}
          {data ? (
            <p className="mb-4 text-xs text-slate-500">
              Audited {data.inventory.summary.total} existing pages (
              {data.inventory.summary.byFunnel.BOFU || 0} BOFU ·{" "}
              {data.inventory.summary.byFunnel.MOFU || 0} MOFU ·{" "}
              {data.inventory.summary.byFunnel.TOFU || 0} TOFU). Duplicate slugs in
              backlog: {data.inventory.duplicates.length}.
            </p>
          ) : null}

          {/* Cluster filters */}
          {data ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {clusters.map((c) => (
                <button
                  key={c.cluster}
                  type="button"
                  onClick={() => setCluster(c.cluster)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    cluster === c.cluster
                      ? "border-brand bg-brand/10 text-brand-strong"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {c.label} ({c.count})
                </button>
              ))}
              <button
                type="button"
                onClick={() => void load()}
                className="ml-auto rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                ↻ Refresh
              </button>
            </div>
          ) : null}

          {loading && !data ? (
            <p className="text-sm text-muted">Loading content queue…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted">No opportunities in this cluster.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">#</th>
                    <th className="pr-3">Opportunity</th>
                    <th className="pr-3">Industry</th>
                    <th className="pr-3">Funnel</th>
                    <th className="pr-3">Score</th>
                    <th className="pr-3">Status</th>
                    <th className="pr-3">Set status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => {
                    const meta = STATUS_META[o.status];
                    const isBusy = busy === o.slug;
                    return (
                      <tr key={o.slug} className="border-b align-top last:border-0">
                        <td className="py-3 pr-3 text-slate-400">{o.rank}</td>
                        <td className="py-3 pr-3">
                          <div className="font-medium text-slate-900">
                            {o.title}
                            {o.pillar ? (
                              <span className="ml-2 rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-strong">
                                PILLAR
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-slate-500">{o.primaryKeyword}</div>
                        </td>
                        <td className="pr-3 text-slate-600">{o.industry}</td>
                        <td className="pr-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                              FUNNEL_CLS[o.funnelStage] || "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {o.funnelStage}
                          </span>
                        </td>
                        <td className="pr-3">
                          <span className="font-semibold">{o.total}</span>
                          <span className="text-[10px] text-slate-400">
                            {" "}
                            C{o.scores.commercial}/S{o.scores.seo}/P{o.scores.productFit}
                          </span>
                        </td>
                        <td className="pr-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${meta.cls}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="pr-3">
                          <div className="flex flex-wrap gap-1">
                            {NEXT_STATUS.map((s) => (
                              <button
                                key={s.value}
                                type="button"
                                disabled={isBusy || o.status === s.value}
                                onClick={() => void setStatus(o.slug, s.value)}
                                className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
