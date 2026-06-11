import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Workflow Automation for Service Teams | LeadClaw AI',
  description:
    'Capture requests, route work, automate follow-ups, and reduce repetitive admin with LeadClaw AI workflows.',
  alternates: {
    canonical: '/seo/ai-agent-for-dental-clinics-uk',
  },
}

export default function Page() {
  return (
    <article className="card max-w-3xl p-6">
      <h1 className="text-3xl font-bold">AI Workflow Automation for Service Teams</h1>
      <p className="mt-3 text-slate-700">
        This legacy vertical route remains available for compatibility while
        LeadClaw expands into a global AI workflow automation suite for request
        capture, follow-up, data cleanup, document extraction, and reporting.
      </p>
    </article>
  )
}
