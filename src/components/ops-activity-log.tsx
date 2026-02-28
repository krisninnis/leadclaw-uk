'use client'

import { useEffect, useState } from 'react'

type EventRow = {
  id: string
  level: string
  category: string
  message: string
  created_at: string
}

export default function OpsActivityLog() {
  const [events, setEvents] = useState<EventRow[]>([])

  useEffect(() => {
    fetch('/api/ops/activity')
      .then((r) => r.json())
      .then((j) => setEvents(j.events || []))
      .catch(() => setEvents([]))
  }, [])

  return (
    <div className="rounded-xl border bg-white p-4">
      <h3 className="mb-2 font-semibold">Agent Activity Log</h3>
      <p className="mb-3 text-xs text-slate-600">Everything the automations are doing (outreach, lead updates, system actions).</p>
      <div className="max-h-72 overflow-auto text-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b"><th className="py-2">Time</th><th>Category</th><th>Message</th></tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b last:border-0">
                <td className="py-1 text-xs whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                <td className="text-xs">{e.category}</td>
                <td>{e.message}</td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr><td colSpan={3} className="py-3 text-slate-500">No activity yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
