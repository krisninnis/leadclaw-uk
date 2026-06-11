import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Workflow Automation for Businesses | LeadClaw AI',
  description:
    'LeadClaw helps businesses capture requests, organise work, automate follow-ups, and reduce repetitive admin with AI.',
  alternates: {
    canonical: '/seo/ai-agent-for-aesthetic-clinics-uk',
  },
}

export default function Page() {
  return (
    <article className="card max-w-3xl p-6">
      <h1 className="text-3xl font-bold">AI Workflow Automation for Businesses</h1>
      <p className="mt-3 text-slate-700">
        This legacy vertical route now points to LeadClaw&apos;s broader AI workflow
        suite: AI Receptionist, Lead Tracker, Follow-Up Assistant, Data Cleaner,
        Document Extractor, and Weekly Report Bot.
      </p>
    </article>
  )
}
