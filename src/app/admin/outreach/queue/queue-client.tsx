"use client";

import { useEffect, useMemo, useState } from "react";

export type QueueLead = {
  id: string;
  company_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  city: string | null;
  niche: string | null;
  lead_quality_score: number | null;
  pecr_classification: string | null;
  email_quality: string | null;
  draft_subject: string | null;
  draft_body: string | null;
};

export type QueueResponse = {
  ok: boolean;
  leads?: QueueLead[];
  totalChecked?: number;
  totalEligible?: number;
  templateMissing?: boolean;
  error?: string;
};

const EMAIL_QUALITY_OPTIONS = ["high", "medium", "low", "invalid"];

function emailQualityClass(quality: string | null | undefined) {
  if (quality === "high") return "bg-emerald-100 text-emerald-700";
  if (quality === "medium") return "bg-sky-100 text-sky-700";
  if (quality === "low") return "bg-amber-100 text-amber-700";
  if (quality === "invalid") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

export default function QueueClient() {
  const [leads, setLeads] = useState<QueueLead[]>([]);
  const [totalChecked, setTotalChecked] = useState(0);
  const [totalEligible, setTotalEligible] = useState(0);
  const [templateMissing, setTemplateMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Client-side filters (no API filter work for this step).
  const [minScore, setMinScore] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [nicheFilter, setNicheFilter] = useState("");
  const [emailQualityFilter, setEmailQualityFilter] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/outreach/queue");
        const body = (await res.json()) as QueueResponse;

        if (cancelled) return;

        if (!res.ok || !body.ok) {
          setError(body.error || `Request failed (${res.status})`);
          return;
        }

        setLeads(body.leads || []);
        setTotalChecked(body.totalChecked || 0);
        setTotalEligible(body.totalEligible || 0);
        setTemplateMissing(Boolean(body.templateMissing));
      } catch {
        if (!cancelled) setError("Could not load the outreach queue.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const niches = useMemo(() => {
    const set = new Set<string>();
    for (const lead of leads) {
      if (lead.niche) set.add(lead.niche);
    }
    return Array.from(set).sort();
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const min = Number.parseInt(minScore, 10);
    const city = cityFilter.trim().toLowerCase();
    return leads.filter((lead) => {
      if (Number.isFinite(min) && (lead.lead_quality_score ?? 0) < min) {
        return false;
      }
      if (city && !(lead.city || "").toLowerCase().includes(city)) {
        return false;
      }
      if (nicheFilter && lead.niche !== nicheFilter) {
        return false;
      }
      if (emailQualityFilter && lead.email_quality !== emailQualityFilter) {
        return false;
      }
      return true;
    });
  }, [leads, minScore, cityFilter, nicheFilter, emailQualityFilter]);

  return (
    <div className="space-y-6">
      <div
        role="alert"
        className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-900"
      >
        Preview only. This page does not send outreach emails.
      </div>

      {templateMissing && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-5 py-4 text-sm text-rose-900">
          No active outreach template found. Create an active template before
          sending outreach.
        </div>
      )}

      <div className="card-premium p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Minimum score</span>
            <input
              type="number"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              placeholder="e.g. 80"
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">City</span>
            <input
              type="text"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              placeholder="e.g. London"
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Niche</span>
            <select
              value={nicheFilter}
              onChange={(e) => setNicheFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">All niches</option>
              {niches.map((niche) => (
                <option key={niche} value={niche}>
                  {niche}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Email quality</span>
            <select
              value={emailQualityFilter}
              onChange={(e) => setEmailQualityFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">All qualities</option>
              {EMAIL_QUALITY_OPTIONS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="card-premium p-8 text-sm text-muted">
          Loading outreach queue&hellip;
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-5 py-6 text-sm text-rose-900">
          Could not load the outreach queue: {error}
        </div>
      ) : leads.length === 0 ? (
        <div className="card-premium p-8 text-sm text-muted">
          No eligible outreach leads right now.
        </div>
      ) : (
        <div className="card-premium overflow-hidden">
          <div className="border-b px-5 py-4 text-sm text-muted">
            Showing {filteredLeads.length} of {leads.length} eligible leads
            {" "}
            (checked {totalChecked}, eligible {totalEligible}).
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Website</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Niche</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">PECR</th>
                  <th className="px-4 py-3">Email quality</th>
                  <th className="px-4 py-3">Draft subject</th>
                  <th className="px-4 py-3">Draft</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-6 text-center text-muted"
                    >
                      No leads match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => {
                    const expanded = expandedId === lead.id;
                    const hasDraft = Boolean(
                      lead.draft_subject || lead.draft_body,
                    );
                    return (
                      <FragmentRow
                        key={lead.id}
                        lead={lead}
                        expanded={expanded}
                        hasDraft={hasDraft}
                        onToggle={() =>
                          setExpandedId(expanded ? null : lead.id)
                        }
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function FragmentRow({
  lead,
  expanded,
  hasDraft,
  onToggle,
}: {
  lead: QueueLead;
  expanded: boolean;
  hasDraft: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-t align-top">
        <td className="px-4 py-3 font-medium text-slate-900">
          {lead.company_name || "-"}
        </td>
        <td className="px-4 py-3 text-slate-700">{lead.contact_email || "-"}</td>
        <td className="px-4 py-3 text-slate-700">{lead.contact_phone || "-"}</td>
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
            "-"
          )}
        </td>
        <td className="px-4 py-3 text-slate-700">{lead.city || "-"}</td>
        <td className="px-4 py-3 text-slate-700">{lead.niche || "-"}</td>
        <td className="px-4 py-3 text-slate-700">
          {lead.lead_quality_score ?? "-"}
        </td>
        <td className="px-4 py-3 text-slate-700">
          {lead.pecr_classification || "-"}
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${emailQualityClass(
              lead.email_quality,
            )}`}
          >
            {lead.email_quality || "-"}
          </span>
        </td>
        <td className="px-4 py-3 text-slate-700">{lead.draft_subject || "-"}</td>
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={onToggle}
            disabled={!hasDraft}
            className="button-secondary disabled:cursor-not-allowed disabled:opacity-50"
            aria-expanded={expanded}
          >
            {expanded ? "Hide draft" : "Preview draft"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t bg-slate-50">
          <td colSpan={11} className="px-4 py-4">
            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">
                  Subject
                </div>
                <div className="text-sm text-slate-900">
                  {lead.draft_subject || "(no subject)"}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">
                  Body
                </div>
                <pre className="whitespace-pre-wrap break-words font-sans text-sm text-slate-800">
                  {lead.draft_body || "(no body)"}
                </pre>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
