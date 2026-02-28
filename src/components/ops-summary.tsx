'use client'

import { useEffect, useState } from 'react'

type OpsData = {
  ok: boolean
  generatedAt?: string
  metrics?: {
    applicationsTotal: number
    messagesTotal: number
    recentErrorCount: number
  }
}

export default function OpsSummary() {
  const [data, setData] = useState<OpsData | null>(null)

  useEffect(() => {
    fetch('/api/ops/daily').then((r) => r.json()).then(setData).catch(() => setData({ ok: false }))
  }, [])

  if (!data) return <div className="rounded-xl border bg-white p-4 text-sm">Loading ops summary...</div>
  if (!data.ok) return <div className="rounded-xl border bg-white p-4 text-sm text-red-600">Ops summary unavailable.</div>

  return (
    <div className="rounded-xl border bg-white p-4 text-sm">
      <p className="font-semibold">Daily Ops Snapshot</p>
      <p>Applications: {data.metrics?.applicationsTotal ?? 0}</p>
      <p>Messages: {data.metrics?.messagesTotal ?? 0}</p>
      <p>Recent errors: {data.metrics?.recentErrorCount ?? 0}</p>
      <p className="text-slate-500">Generated: {data.generatedAt}</p>
    </div>
  )
}
