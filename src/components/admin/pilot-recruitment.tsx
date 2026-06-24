"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Pilot Recruitment — Command Centre section.
//
// Read/filter/act layer over EXISTING scraped leads. Fetches the read-only
// aggregate from /api/admin/pilot-recruitment and writes pilot metadata via
// POST /api/admin/pilot-recruitment/[leadId]. It never touches the scraper,
// the import pipeline, or core lead fields — only the lead_pilot_recruitment
// overlay.

type PilotStatus =
  | "candidate"
  | "contacted"
  | "interested"
  | "pilot"
  | "customer"
  | "not_fit"
  | "no_response";

type Candidate = {
  leadId: string;
  companyName: string;
  trade: string;
  tradeLabel: string;
  city: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  leadStatus: string | null;
  score: number;
  pilotStatus: PilotStatus;
  pilotNotes: string | null;
  notesPreview: string | null;
  followUpAt: string | null;
  lastContactedAt: string | null;
  contactedCount: number;
  followUpDue: boolean;
  priorityScore: number;
  signals: string[];
  nextAction: string;
};

type Summary = {
  newCandidates: number;
  contacted: number;
  interested: number;
  pilot: number;
  customer: number;
  notFit: number;
  noResponse: number;
  followUpsDue: number;
  total: number;
};

type TradeCount = { trade: string; label: string; count: number };

type Payload = {
  ok: boolean;
  error?: string;
  generatedAt: string;
  summary: Summary;
  tradeCounts: TradeCount[];
  candidates: Candidate[];
  pilotTableReady: boolean;
};

const STATUS_META: Record<PilotStatus, { label: string; cls: string }> = {
  candidate: { label: "Candidate", cls: "bg-slate-100 text-slate-700" },
  contacted: { label: "Contacted", cls: "bg-sky-100 text-sky-700" },
  interested: { label: "Interested", cls: "bg-violet-100 text-violet-700" },
  pilot: { label: "Pilot", cls: "bg-indigo-100 text-indigo-700" },
  customer: { label: "Customer", cls: "bg-emerald-100 text-emerald-700" },
  not_fit: { label: "Not fit", cls: "bg-rose-100 text-rose-700" },
  no_response: { label: "No response", cls: "bg-amber-100 text-amber-700" },
};

const STATUS_ACTIONS: { status: PilotStatus; label: string }[] = [
  { status: "interested", label: "Interested" },
  { status: "pilot", label: "Pilot" },
  { status: "customer", label: "Customer" },
  { status: "not_fit", label: "Not fit" },
  { status: "no_response", label: "No response" },
];

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "—";
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function dateText(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "danger" | "good";
}) {
  const valueCls =
    tone === "danger"
      ? "text-rose-600"
      : tone === "good"
        ? "text-emerald-600"
        : "text-foreground";
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${valueCls}`}>{value}</p>
    </div>
  );
}

export default function PilotRecruitment() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trade, setTrade] = useState<string>("all");
  const [busyLead, setBusyLead] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/pilot-recruitment", {
        cache: "no-store",
      });
      const body = (await res.json()) as Payload;
      if (!res.ok || !body.ok) {
        setError(body.error || `Request failed (${res.status})`);
        setData(null);
      } else {
        setData(body);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (leadId: string, body: Record<string, unknown>) => {
      setBusyLead(leadId);
      try {
        const res = await fetch(`/api/admin/pilot-recruitment/${leadId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setError(json.error || `Action failed (${res.status})`);
        } else {
          await load();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "action_failed");
      } finally {
        setBusyLead(null);
      }
    },
    [load],
  );

  const candidates = useMemo(() => {
    if (!data) return [];
    return trade === "all"
      ? data.candidates
      : data.candidates.filter((c) => c.trade === trade);
  }, [data, trade]);

  const summary = data?.summary;

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
            Pilot Recruitment
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Recruit missed-call-recovery pilots from leads LeadClaw already found
            — plumbers, electricians & roofers first.
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

          {data && !data.pilotTableReady ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Pilot metadata table not found yet — showing candidates from
              existing leads. Apply migration{" "}
              <code>20260624_add_pilot_recruitment.sql</code> to enable saving
              pilot actions.
            </div>
          ) : null}

          {/* Summary cards */}
          {summary ? (
            <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Metric label="New candidates" value={summary.newCandidates} />
              <Metric label="Contacted" value={summary.contacted} />
              <Metric label="Interested" value={summary.interested} />
              <Metric label="Pilot" value={summary.pilot} tone="good" />
              <Metric label="Customer" value={summary.customer} tone="good" />
              <Metric
                label="Follow-ups due"
                value={summary.followUpsDue}
                tone={summary.followUpsDue > 0 ? "danger" : undefined}
              />
            </div>
          ) : null}

          {/* Trade filters */}
          {data ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {data.tradeCounts.map((t) => (
                <button
                  key={t.trade}
                  type="button"
                  onClick={() => setTrade(t.trade)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    trade === t.trade
                      ? "border-brand bg-brand/10 text-brand-strong"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t.label} ({t.count})
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
            <p className="text-sm text-muted">Loading candidates…</p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-muted">
              No pilot candidates match this filter yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Business</th>
                    <th className="pr-3">Trade</th>
                    <th className="pr-3">Phone</th>
                    <th className="pr-3">Website</th>
                    <th className="pr-3">Score</th>
                    <th className="pr-3">Pilot status</th>
                    <th className="pr-3">Last contacted</th>
                    <th className="pr-3">Follow-up</th>
                    <th className="pr-3">Next action</th>
                    <th className="pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => {
                    const meta = STATUS_META[c.pilotStatus];
                    const busy = busyLead === c.leadId;
                    return (
                      <tr
                        key={c.leadId}
                        className={`border-b align-top last:border-0 ${
                          c.followUpDue ? "bg-amber-50/60" : ""
                        }`}
                      >
                        <td className="py-3 pr-3">
                          <div className="font-medium text-slate-900">
                            {c.companyName}
                          </div>
                          <div className="text-xs text-slate-500">
                            {c.city || "—"}
                          </div>
                          {c.notesPreview ? (
                            <div className="mt-1 max-w-[16rem] text-xs italic text-slate-500">
                              “{c.notesPreview}”
                            </div>
                          ) : null}
                        </td>
                        <td className="pr-3 text-slate-600">{c.tradeLabel}</td>
                        <td className="pr-3 text-slate-600">
                          {c.phone ? (
                            <a
                              href={`tel:${c.phone}`}
                              className="text-brand-strong hover:underline"
                            >
                              {c.phone}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="pr-3 text-slate-600">
                          {c.website ? (
                            <a
                              href={
                                c.website.startsWith("http")
                                  ? c.website
                                  : `https://${c.website}`
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand-strong hover:underline"
                            >
                              site
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="pr-3 font-medium">{c.score}</td>
                        <td className="pr-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${meta.cls}`}
                          >
                            {meta.label}
                          </span>
                          {c.contactedCount > 0 ? (
                            <div className="mt-1 text-[10px] text-slate-400">
                              {c.contactedCount}× contacted
                            </div>
                          ) : null}
                        </td>
                        <td className="pr-3 text-xs text-slate-500">
                          {relativeTime(c.lastContactedAt)}
                        </td>
                        <td className="pr-3 text-xs">
                          <span
                            className={
                              c.followUpDue
                                ? "font-medium text-amber-700"
                                : "text-slate-500"
                            }
                          >
                            {dateText(c.followUpAt)}
                          </span>
                        </td>
                        <td className="pr-3 text-xs text-slate-600">
                          {c.nextAction}
                        </td>
                        <td className="pr-3">
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void act(c.leadId, { markContacted: true })
                              }
                              className="rounded border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                            >
                              Mark contacted
                            </button>
                            <div className="flex flex-wrap gap-1">
                              {STATUS_ACTIONS.map((sa) => (
                                <button
                                  key={sa.status}
                                  type="button"
                                  disabled={busy || c.pilotStatus === sa.status}
                                  onClick={() =>
                                    void act(c.leadId, {
                                      pilot_status: sa.status,
                                    })
                                  }
                                  className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                                >
                                  {sa.label}
                                </button>
                              ))}
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                              <input
                                type="date"
                                disabled={busy}
                                defaultValue={
                                  c.followUpAt
                                    ? c.followUpAt.slice(0, 10)
                                    : ""
                                }
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v)
                                    void act(c.leadId, {
                                      follow_up_at: new Date(v).toISOString(),
                                    });
                                }}
                                className="rounded border border-slate-200 px-1 py-0.5 text-[11px] text-slate-600"
                                aria-label="Set follow-up date"
                              />
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  const note = window.prompt(
                                    "Pilot notes",
                                    c.pilotNotes || "",
                                  );
                                  if (note !== null)
                                    void act(c.leadId, { pilot_notes: note });
                                }}
                                className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                              >
                                Notes
                              </button>
                            </div>
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
