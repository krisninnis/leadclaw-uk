'use client'

import { useState } from 'react'

export default function PortalPlanUpgrade({ email }: { email?: string | null }) {
  const [plan, setPlan] = useState('starter')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function activatePaid() {
    setLoading(true)
    setStatus('Opening secure checkout…')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, email: email || '' }),
      })
      const data = await res.json()
      if (!res.ok || !data?.url) {
        setStatus(data?.error || 'Checkout unavailable right now.')
        return
      }
      window.location.assign(data.url)
    } catch {
      setStatus('Checkout unavailable right now.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border bg-white p-6 space-y-3">
      <h2 className="text-lg font-semibold">Activate a paid package</h2>
      <p className="text-sm text-slate-600">Upgrade from trial when you’re ready.</p>
      <div className="flex items-center gap-2">
        <select className="rounded border px-2 py-1 text-sm" value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="starter">Starter</option>
          <option value="growth">Growth</option>
          <option value="pro">Pro</option>
        </select>
        <button onClick={activatePaid} disabled={loading} className="rounded-lg bg-slate-900 px-3 py-1.5 text-white text-sm disabled:opacity-50">
          {loading ? 'Opening…' : 'Activate monthly subscription'}
        </button>
      </div>
      {status && <p className="text-xs text-slate-600">{status}</p>}
    </div>
  )
}
