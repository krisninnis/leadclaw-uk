'use client'

import { useEffect, useState } from 'react'

type Lead = {
  id: string
  company_name: string
  contact_email: string | null
  city: string | null
  status: string
  outcome_label?: string | null
  follow_up_due_at?: string | null
  last_contact_at?: string | null
}

type BoardData = {
  summary: {
    total: number
    contacted: number
    replied: number
    interested: number
    notInterested: number
    followUpsDue: number
  }
  leads: Lead[]
}

const STATUSES = ['new', 'contacted', 'replied', 'interested', 'not_interested', 'do_not_contact', 'won', 'lost']

export default function LeadCommandCenter() {
  const [data, setData] = useState<BoardData | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  async function load() {
    const r = await fetch('/api/lead-ops/board')
    const j = await r.json()
    if (j.ok) setData({ summary: j.summary, leads: j.leads })
  }

  useEffect(() => {
    load().catch(() => setData(null))
  }, [])

  async function saveLead(lead: Lead, next: { status: string; followUpDueAt?: string; outcomeLabel?: string }) {
    setSaving(lead.id)
    try {
      await fetch('/api/lead-ops/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          status: next.status,
          followUpDueAt: next.followUpDueAt || null,
          outcomeLabel: next.outcomeLabel || null,
          note: 'updated from admin lead command center',
        }),
      })
      await load()
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="rounded-xl border bg-white p-4 space-y-4">
      <h3 className="font-semibold">Lead Command Center</h3>
      <p className="text-xs text-slate-600">Tracks contacted/replied/interested outcomes + follow-ups due.</p>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
        <Stat label="Total" value={data?.summary.total || 0} />
        <Stat label="Contacted" value={data?.summary.contacted || 0} />
        <Stat label="Replied" value={data?.summary.replied || 0} />
        <Stat label="Interested" value={data?.summary.interested || 0} />
        <Stat label="Not interested" value={data?.summary.notInterested || 0} />
        <Stat label="Follow-ups due" value={data?.summary.followUpsDue || 0} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Company</th>
              <th>Email</th>
              <th>Status</th>
              <th>Follow-up</th>
              <th>Outcome</th>
              <th>Last contact</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(data?.leads || []).slice(0, 80).map((l) => (
              <LeadRow key={l.id} lead={l} onSave={saveLead} saving={saving === l.id} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border p-2">
      <div className="text-slate-500">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  )
}

function LeadRow({
  lead,
  onSave,
  saving,
}: {
  lead: Lead
  onSave: (lead: Lead, next: { status: string; followUpDueAt?: string; outcomeLabel?: string }) => Promise<void>
  saving: boolean
}) {
  const [status, setStatus] = useState(lead.status)
  const [followUpDueAt, setFollowUpDueAt] = useState((lead.follow_up_due_at || '').slice(0, 10))
  const [outcomeLabel, setOutcomeLabel] = useState(lead.outcome_label || '')

  return (
    <tr className="border-b last:border-0">
      <td className="py-2">{lead.company_name}</td>
      <td>{lead.contact_email || '-'}</td>
      <td>
        <select className="border rounded px-1 py-0.5" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input
          type="date"
          className="border rounded px-1 py-0.5"
          value={followUpDueAt}
          onChange={(e) => setFollowUpDueAt(e.target.value)}
        />
      </td>
      <td>
        <input
          className="border rounded px-1 py-0.5 w-40"
          value={outcomeLabel}
          onChange={(e) => setOutcomeLabel(e.target.value)}
          placeholder="e.g. asked for demo"
        />
      </td>
      <td className="text-xs">{lead.last_contact_at ? new Date(lead.last_contact_at).toLocaleString() : '-'}</td>
      <td>
        <button
          className="rounded bg-slate-900 text-white px-2 py-1 text-xs disabled:opacity-50"
          onClick={() => onSave(lead, { status, followUpDueAt: followUpDueAt || undefined, outcomeLabel: outcomeLabel || undefined })}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </td>
    </tr>
  )
}
