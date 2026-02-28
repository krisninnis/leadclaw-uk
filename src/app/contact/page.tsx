'use client'

import { useState } from 'react'

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    clinic: '',
    website: '',
    planInterest: 'starter',
    issueType: 'general',
    message: '',
  })
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setStatus('Sending…')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        setStatus(data?.error || 'Could not send your message right now.')
        return
      }
      setStatus('Thanks — message sent. Our AI support will respond quickly, and priority plans get faster human follow-up.')
      setForm({ name: '', email: '', clinic: '', website: '', planInterest: 'starter', issueType: 'general', message: '' })
    } catch {
      setStatus('Could not send your message right now.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Contact Us</h1>
        <p className="mt-2 text-slate-600">Talk to LeadClaw AI support. Instant AI handling by default, with higher-touch support on higher plans.</p>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-xl font-semibold">How support works</h2>
        <ul className="mt-3 list-disc pl-6 text-sm text-slate-700 space-y-1">
          <li><strong>Starter:</strong> AI-first support and guided self-serve setup.</li>
          <li><strong>Growth:</strong> AI-first + faster human escalation when needed.</li>
          <li><strong>Pro:</strong> Priority support and deeper implementation help.</li>
        </ul>
      </div>

      <form onSubmit={submit} className="rounded-xl border bg-white p-6 space-y-4 max-w-2xl">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Your name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
          <Field label="Clinic / business" value={form.clinic} onChange={(v) => setForm({ ...form, clinic: v })} required />
          <Field label="Website" value={form.website} onChange={(v) => setForm({ ...form, website: v })} />
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Plan interest</span>
          <select
            className="w-full rounded-lg border border-slate-300 p-2"
            value={form.planInterest}
            onChange={(e) => setForm({ ...form, planInterest: e.target.value })}
          >
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="pro">Pro (priority support)</option>
            <option value="unsure">Not sure yet</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Issue type</span>
          <select
            className="w-full rounded-lg border border-slate-300 p-2"
            value={form.issueType}
            onChange={(e) => setForm({ ...form, issueType: e.target.value })}
          >
            <option value="general">General question</option>
            <option value="setup">Setup help</option>
            <option value="billing">Billing</option>
            <option value="complaint">Complaint (priority escalation)</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Message</span>
          <textarea
            className="min-h-28 w-full rounded-lg border border-slate-300 p-2"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder="What do you need help with?"
            required
          />
        </label>

        <button disabled={loading} className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
          {loading ? 'Sending…' : 'Send message'}
        </button>

        {status && <p className="text-sm text-slate-700">{status}</p>}
      </form>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  required,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  type?: string
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        type={type}
        className="w-full rounded-lg border border-slate-300 p-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </label>
  )
}
