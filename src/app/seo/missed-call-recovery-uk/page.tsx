import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Missed Call Recovery for UK Clinics | LeadClaw AI',
  description: 'Recover missed-call revenue with instant text-back and AI lead qualification workflows.',
}

export default function Page() {
  return (
    <article className="card max-w-3xl p-6">
      <h1 className="text-3xl font-bold">Missed Call Recovery (UK)</h1>
      <p className="mt-3 text-slate-700">Stop losing high-intent leads when lines are busy. Capture details instantly and route hot leads to your team.</p>
    </article>
  )
}
