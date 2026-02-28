import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Agent for Dental Clinics UK | LeadClaw AI',
  description: 'Turn missed dental enquiries into booked appointments with a UK-focused AI front desk.',
}

export default function Page() {
  return (
    <article className="card max-w-3xl p-6">
      <h1 className="text-3xl font-bold">AI Agent for Dental Clinics (UK)</h1>
      <p className="mt-3 text-slate-700">Automate first response, qualification, and follow-up so your reception team only handles warm leads.</p>
    </article>
  )
}
