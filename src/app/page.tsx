import Link from 'next/link'
import Section from '@/components/section'
import NewsletterSignup from '@/components/newsletter-signup'

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-slate-900 p-10 text-white">
        <p className="mb-2 text-sm uppercase tracking-wider text-slate-300">UK Aesthetic Clinics</p>
        <h1 className="text-4xl font-bold">No calls. No pressure. 7-day free AI front-desk trial.</h1>
        <p className="mt-4 max-w-3xl text-slate-200">
          We install a discreet AI enquiry assistant that captures Botox, whitening, and spray-tan leads 24/7.
          No credit card for trial. Start paying only when satisfied.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/apply" className="rounded-lg bg-white px-4 py-2 font-medium text-slate-900">Start free trial</Link>
          <Link href="/pricing" className="rounded-lg border border-slate-500 px-4 py-2">See pricing</Link>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-3">
        <Section title="Lead capture">
          <p>Replies in under 60 seconds, qualifies treatment intent, captures contact details.</p>
        </Section>
        <Section title="Portal + analytics">
          <p>Client dashboard with lead inbox, statuses, trial progress, and simple performance metrics.</p>
        </Section>
        <Section title="Compliance-first">
          <p>Clear trial waiver, cooling-off period language, and cancellation-friendly monthly terms.</p>
        </Section>
      </div>

      <NewsletterSignup />
    </div>
  )
}
