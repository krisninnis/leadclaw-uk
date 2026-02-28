import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Agent for Aesthetic Clinics UK | LeadClaw AI',
  description: 'Capture more Botox, skin, and aesthetics enquiries with a 24/7 AI front desk for UK clinics.',
}

export default function Page() {
  return (
    <article className="card max-w-3xl p-6">
      <h1 className="text-3xl font-bold">AI Agent for Aesthetic Clinics (UK)</h1>
      <p className="mt-3 text-slate-700">LeadClaw helps UK aesthetic clinics capture and convert out-of-hours enquiries with compliant, low-friction automation.</p>
    </article>
  )
}
