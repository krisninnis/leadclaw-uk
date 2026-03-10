import Link from "next/link";
import Section from "@/components/section";
import NewsletterSignup from "@/components/newsletter-signup";

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-slate-900 p-10 text-white">
        <p className="mb-2 text-sm uppercase tracking-wider text-slate-300">
          Built for UK Aesthetic Clinics
        </p>

        <h1 className="text-4xl font-bold">
          Never miss another clinic enquiry.
        </h1>

        <p className="mt-4 max-w-3xl text-slate-200">
          LeadClaw installs a simple enquiry widget on your website that
          captures patient enquiries and shows them instantly in your clinic
          lead inbox — even when your team is busy or out of hours.
        </p>

        <div className="mt-6 flex gap-3">
          <Link
            href="/apply"
            className="rounded-lg bg-white px-4 py-2 font-medium text-slate-900"
          >
            Start free trial
          </Link>

          <Link
            href="/pricing"
            className="rounded-lg border border-slate-500 px-4 py-2"
          >
            See pricing
          </Link>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-3">
        <Section title="Capture enquiries instantly">
          <p>
            Add a small widget to your website and capture enquiries from
            potential patients 24/7.
          </p>
        </Section>

        <Section title="See every lead in one place">
          <p>
            Every enquiry appears instantly in your LeadClaw portal so your team
            can follow up quickly.
          </p>
        </Section>

        <Section title="Built for aesthetic clinics">
          <p>
            Designed for Botox, whitening, skin, and beauty clinics that want to
            stop missing potential clients.
          </p>
        </Section>
      </div>

      <NewsletterSignup />
    </div>
  );
}
