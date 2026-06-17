"use client";

import { useEffect, useMemo, useState } from "react";

// Read-only, searchable lead list. No editing in this task.
type SalesLead = {
  id: string;
  company_name: string | null;
  niche: string | null;
  city: string | null;
  lead_quality_score: number | null;
  status: string | null;
  contact_email: string | null;
  website: string | null;
};

type LeadsResponse = {
  ok: boolean;
  leads?: SalesLead[];
  error?: string;
};

export default function LeadDatabaseTab() {
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/sales/leads");
        const body = (await res.json()) as LeadsResponse;
        if (cancelled) return;
        if (!res.ok || !body.ok) {
          setError(body.error || "Could not load leads.");
          return;
        }
        setLeads(body.leads || []);
      } catch {
        if (!cancelled) setError("Could not load leads.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    for (const lead of leads) {
      if (lead.status) set.add(lead.status);
    }
    return Array.from(set).sort();
  }, [leads]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (statusFilter && lead.status !== statusFilter) return false;
      if (!term) return true;
      const haystack = [
        lead.company_name,
        lead.niche,
        lead.city,
        lead.contact_email,
        lead.website,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [leads, search, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="card-premium p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-foreground">Search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Company, niche, city, email or website"
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="card-premium p-8 text-sm text-muted">
          Loading leads&hellip;
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-5 py-6 text-sm text-rose-900">
          {error}
        </div>
      ) : leads.length === 0 ? (
        <div className="card-premium p-8 text-sm text-muted">
          No leads in the database yet.
        </div>
      ) : (
        <div className="card-premium overflow-hidden">
          <div className="border-b px-5 py-4 text-sm text-muted">
            Showing {filtered.length} of {leads.length} leads.
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Niche</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Website</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-muted">
                      No leads match the current filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((lead) => (
                    <tr key={lead.id} className="border-t align-top">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {lead.company_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {lead.niche || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {lead.city || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {lead.lead_quality_score ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {lead.status || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {lead.contact_email || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {lead.website ? (
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Open site
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
