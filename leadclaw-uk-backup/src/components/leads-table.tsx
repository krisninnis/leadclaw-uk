'use client'

import { useEffect, useState } from 'react'

type Lead = {
  id: string
  niche: string
  company_name: string
  city: string | null
  source: string
  score: number
  status: string
}

export default function LeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([])

  useEffect(() => {
    fetch('/api/leads')
      .then((r) => r.json())
      .then((d) => setLeads(d.leads || []))
      .catch(() => setLeads([]))
  }, [])

  return (
    <div className="rounded-xl border bg-white p-4">
      <h3 className="mb-3 font-semibold">Lead queue</h3>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b"><th className="py-2">Company</th><th>Niche</th><th>City</th><th>Score</th><th>Status</th></tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} className="border-b last:border-0">
              <td className="py-2">{l.company_name}</td><td>{l.niche}</td><td>{l.city || '-'}</td><td>{l.score}</td><td>{l.status}</td>
            </tr>
          ))}
          {leads.length === 0 && <tr><td colSpan={5} className="py-3 text-slate-500">No leads yet.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
