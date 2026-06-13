import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Missed Call Recovery for UK Businesses | LeadClaw",
  description:
    "Recover missed calls and website enquiries with LeadClaw's AI receptionist, lead tracker, and follow-up support.",
  alternates: {
    canonical: "/seo/missed-call-recovery-uk",
  },
};

export default function Page() {
  return (
    <article className="card-premium max-w-3xl p-6">
      <h1 className="text-3xl font-bold">
        Missed call recovery for UK businesses
      </h1>
      <p className="mt-3 text-slate-700">
        LeadClaw helps service teams capture missed calls and website enquiries,
        organise callback details, and follow up before warm leads go cold.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Link href="/ai-receptionist-uk" className="button-primary">
          See the AI receptionist
        </Link>
        <Link href="/free-trial" className="button-secondary">
          Start free trial
        </Link>
      </div>
    </article>
  );
}
