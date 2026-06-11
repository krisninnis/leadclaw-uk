import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Request Recovery and Follow-Up Automation | LeadClaw AI',
  description:
    'Recover missed requests with AI intake capture, lead tracking, and automated follow-up workflows.',
  alternates: {
    canonical: '/seo/missed-call-recovery-uk',
  },
}

export default function Page() {
  return (
    <article className="card max-w-3xl p-6">
      <h1 className="text-3xl font-bold">Request Recovery and Follow-Up Automation</h1>
      <p className="mt-3 text-slate-700">
        LeadClaw helps teams capture missed website requests, route work into a
        workspace, and automate follow-ups so important opportunities do not sit
        unattended.
      </p>
    </article>
  )
}
