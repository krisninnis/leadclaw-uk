"use client";

import { useEffect, useMemo, useState } from "react";

// Read-only pipeline view (MVP). No drag-and-drop, no status writes.
// Populated from the existing /api/lead-ops/board lead statuses.
type BoardLead = {
  id: string;
  company_name: string | null;
  city: string | null;
  status: string | null;
};

type BoardResponse = {
  ok: boolean;
  leads?: BoardLead[];
};

type Column = {
  key: string;
  title: string;
  // Lead status values that map into this column.
  statuses: string[];
};

// MVP pipeline columns. Existing lead statuses are mapped onto these.
// TODO(next phase): normalise lead statuses (e.g. add explicit
// "qualified", "demo_booked", "customer" states) instead of best-effort mapping.
const COLUMNS: Column[] = [
  { key: "new", title: "New", statuses: ["new"] },
  { key: "qualified", title: "Qualified", statuses: ["qualified"] },
  { key: "contacted", title: "Contacted", statuses: ["contacted", "replied"] },
  { key: "interested", title: "Interested", statuses: ["interested"] },
  { key: "demo", title: "Demo Booked", statuses: ["demo_booked", "demo"] },
  { key: "customer", title: "Customer", statuses: ["won", "customer"] },
  {
    key: "lost",
    title: "Lost",
    statuses: ["lost", "not_interested", "do_not_contact"],
  },
];

export default function PipelineTab() {
  const [leads, setLeads] = useState<BoardLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/lead-ops/board");
        const body = (await res.json()) as BoardResponse;
        if (cancelled) return;
        if (!res.ok || !body.ok) {
          setError("Could not load pipeline data.");
          return;
        }
        setLeads(body.leads || []);
      } catch {
        if (!cancelled) setError("Could not load pipeline data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const byColumn = new Map<string, BoardLead[]>();
    for (const column of COLUMNS) byColumn.set(column.key, []);

    const mapped = new Set<string>();
    for (const column of COLUMNS) {
      for (const status of column.statuses) mapped.add(status);
    }

    let uncategorised = 0;
    for (const lead of leads) {
      const status = (lead.status || "").toLowerCase();
      const column = COLUMNS.find((c) => c.statuses.includes(status));
      if (column) {
        byColumn.get(column.key)!.push(lead);
      } else {
        uncategorised += 1;
      }
    }

    return { byColumn, uncategorised };
  }, [leads]);

  if (loading) {
    return (
      <div className="card-premium p-8 text-sm text-muted">
        Loading pipeline&hellip;
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-300 bg-rose-50 px-5 py-6 text-sm text-rose-900">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-600">
        Read-only pipeline (MVP). Columns are derived from existing lead
        statuses. Drag-and-drop and stage editing arrive in a later phase.
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((column) => {
          const columnLeads = grouped.byColumn.get(column.key) || [];
          return (
            <div
              key={column.key}
              className="card-premium flex min-h-[160px] flex-col p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  {column.title}
                </h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {columnLeads.length}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {columnLeads.length === 0 ? (
                  <p className="text-xs text-muted">No leads in this stage.</p>
                ) : (
                  columnLeads.slice(0, 12).map((lead) => (
                    <div
                      key={lead.id}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                    >
                      <div className="font-medium text-slate-900">
                        {lead.company_name || "—"}
                      </div>
                      <div className="text-slate-500">{lead.city || "—"}</div>
                    </div>
                  ))
                )}

                {columnLeads.length > 12 && (
                  <p className="text-xs text-muted">
                    +{columnLeads.length - 12} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {grouped.uncategorised > 0 && (
        <p className="text-xs text-muted">
          {grouped.uncategorised} lead(s) have a status not yet mapped to a
          pipeline column.
        </p>
      )}
    </div>
  );
}
