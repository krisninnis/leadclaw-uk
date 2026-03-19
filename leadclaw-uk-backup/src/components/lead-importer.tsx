'use client'

import { FormEvent, useState } from 'react'

const SAMPLE = `[
  {"niche":"aesthetics","company_name":"Glow Clinic","website":"https://example.com","contact_email":"hello@example.com","contact_phone":"02070000000","city":"London","source":"google-maps"}
]`

export default function LeadImporter() {
  const [json, setJson] = useState(SAMPLE)
  const [status, setStatus] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setStatus('Importing...')

    let leads
    try {
      leads = JSON.parse(json)
    } catch {
      setStatus('Invalid JSON')
      return
    }

    const res = await fetch('/api/leads/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads }),
    })
    const data = await res.json()
    if (!res.ok) {
      setStatus(`Failed: ${data.error || 'unknown'}`)
      return
    }

    setStatus(`Imported ${data.inserted} leads`)
  }

  return (
    <form onSubmit={submit} className="rounded-xl border bg-white p-4">
      <h3 className="mb-2 font-semibold">Lead import (JSON)</h3>
      <textarea value={json} onChange={(e) => setJson(e.target.value)} rows={8} className="w-full rounded border p-2 font-mono text-xs" />
      <button className="mt-3 rounded bg-slate-900 px-3 py-2 text-white">Import leads</button>
      {status && <p className="mt-2 text-sm text-slate-600">{status}</p>}
    </form>
  )
}
