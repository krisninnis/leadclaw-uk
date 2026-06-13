import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AI Receptionist for Dental Clinics UK | LeadClaw",
  description:
    "LeadClaw helps dental practices capture patient enquiries, recover missed calls, and organise non-clinical follow-up.",
  alternates: {
    canonical: "/ai-receptionist-for-dentists-uk",
  },
};

export default function Page() {
  return (
    <article className="card-premium max-w-3xl p-6">
      <h1 className="text-3xl font-bold">AI receptionist for dental clinics</h1>
      <p className="mt-3 text-slate-700">
        This legacy route remains available for compatibility. The current
        LeadClaw page explains how dental practices can capture new-patient
        enquiries, recover missed calls, and keep reception follow-up organised
        without giving clinical advice.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Link href="/ai-receptionist-for-dentists-uk" className="button-primary">
          View dental page
        </Link>
        <Link href="/demo" className="button-secondary">
          Book a demo
        </Link>
      </div>
    </article>
  );
}
