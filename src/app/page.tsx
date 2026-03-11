import Link from "next/link";
import Section from "@/components/section";
import NewsletterSignup from "@/components/newsletter-signup";

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-slate-900 p-10 text-white">
        <p className="mb-2 text-sm uppercase tracking-wider text-slate-300">
          Built for UK aesthetic clinics
        </p>

        <h1 className="text-4xl font-bold">
          Capture more website enquiries without adding more admin.
        </h1>

        <p className="mt-4 max-w-3xl text-slate-200">
          LeadClaw adds a simple enquiry widget to your website so potential
          patients can get in touch even when your team is busy or out of hours.
          Every enquiry appears instantly in your clinic portal so your staff
          can follow up quickly.
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
        <Section title="Capture enquiries 24/7">
          <p>
            Add a lightweight widget to your website so visitors can leave their
            details whenever they are ready to enquire.
          </p>
        </Section>

        <Section title="See every lead in one portal">
          <p>
            Every enquiry is stored in your LeadClaw portal, helping your team
            keep track of new, contacted, booked, and lost leads.
          </p>
        </Section>

        <Section title="Built for clinic teams">
          <p>
            Designed for aesthetic, skin, whitening, and beauty clinics that
            want a simple way to stop missing website opportunities.
          </p>
        </Section>
      </div>

      <NewsletterSignup />
    </div>
  );
}
