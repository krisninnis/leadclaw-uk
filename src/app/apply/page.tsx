'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { LEGAL_VERSION } from '@/lib/legal'

export default function ApplyPage() {
  const [status, setStatus] = useState('')

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formEl = e.currentTarget
    setStatus('Submitting...')
    const formData = new FormData(formEl)
    const payload = Object.fromEntries(formData.entries())

    const res = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      setStatus('Something went wrong. Try again.')
      return
    }

    setStatus('Application received. We will set up your trial without a sales call.')
    formEl.reset()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Quick application</h1>
      <p className="text-slate-600">No phone call required. 3-5 minute form.</p>

      <form onSubmit={onSubmit} className="grid gap-4 rounded-xl border bg-white p-6 md:grid-cols-2">
        <Input name="clinicName" label="Clinic name" required />
        <Input name="contactName" label="Contact name" required />
        <Input name="email" label="Email" type="email" required />
        <Input name="phone" label="Phone" required />
        <Input name="city" label="City" required />
        <Input name="website" label="Website/Instagram" />
        <Input name="services" label="Services offered" placeholder="Botox, whitening, spray tan" required />
        <Input name="leadVolume" label="Approx leads per month" />
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium">Notes</label>
          <textarea name="notes" className="w-full rounded-lg border border-slate-300 p-2" rows={4} />
        </div>

        <input type="hidden" name="termsVersion" value={LEGAL_VERSION} />

        <div className="md:col-span-2 rounded-lg border border-slate-200 p-3 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" name="agree" required className="mt-1" />
            <span>
              I agree to the{' '}
              <Link className="underline" href="/legal/terms" target="_blank">Terms</Link>,{' '}
              <Link className="underline" href="/legal/privacy" target="_blank">Privacy Policy</Link>, and{' '}
              <Link className="underline" href="/legal/trial-waiver" target="_blank">Trial Terms/Waiver</Link>
              .
            </span>
          </label>
          <p className="mt-2 text-xs text-slate-500">Legal version: {LEGAL_VERSION}</p>
        </div>

        <button className="md:col-span-2 rounded-lg bg-slate-900 px-4 py-2 text-white" type="submit">
          Submit application
        </button>
        {status && <p className="md:col-span-2 text-sm text-slate-700">{status}</p>}
      </form>
    </div>
  )
}

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input {...props} className="w-full rounded-lg border border-slate-300 p-2" />
    </div>
  )
}
