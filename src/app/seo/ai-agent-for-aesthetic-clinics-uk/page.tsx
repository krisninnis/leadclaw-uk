import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AI Receptionist for Aesthetic Clinics UK | LeadClaw",
  description:
    "LeadClaw helps aesthetic clinics capture consultation enquiries, recover missed calls, and keep non-clinical follow-up organised.",
  alternates: {
    canonical: "/ai-receptionist-for-aesthetic-clinics-uk",
  },
};

export default function Page() {
  return (
    <article className="card-premium max-w-3xl p-6">
      <h1 className="text-3xl font-bold">
        AI receptionist for aesthetic clinics
      </h1>
      <p className="mt-3 text-slate-700">
        This legacy route remains available for compatibility. The current
        LeadClaw page explains how aesthetic clinics can capture consultation
        enquiries, recover missed calls, and keep staff in control of every
        clinical decision.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/ai-receptionist-for-aesthetic-clinics-uk"
          className="button-primary"
        >
          View aesthetic clinic page
        </Link>
        <Link href="/demo" className="button-secondary">
          Book a demo
        </Link>
      </div>
    </article>
  );
}
