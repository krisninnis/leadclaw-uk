'use client'

import { FormEvent, useState } from 'react'

export default function NewsletterSignup() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('Joining...')

    const res = await fetch('/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    })

    if (!res.ok) {
      setStatus('Could not subscribe right now.')
      return
    }

    setStatus('Subscribed. Weekly updates coming through.')
    setEmail('')
    setName('')
  }

  return (
    <form onSubmit={onSubmit} className="card mt-8 p-5">
      <h3 className="text-lg font-semibold">Join the LeadClaw Weekly</h3>
      <p className="mt-1 text-sm text-slate-600">Weekly product updates, wins, and playbooks.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="rounded-xl border border-slate-300 px-3 py-2" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" placeholder="Email" className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2" />
      </div>
      <button className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">Subscribe</button>
      {status && <p className="mt-2 text-xs text-slate-500">{status}</p>}
    </form>
  )
}
