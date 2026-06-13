import PricingHero from "./_components/pricing-hero";
import PricingGrid from "./_components/pricing-grid";
import PricingComparison from "./_components/pricing-comparison";
import PricingFaq from "./_components/pricing-faq";
import PricingCta from "./_components/pricing-cta";
import { faqs } from "./pricing-data";
import type { Metadata } from "next";
import GaEventOnMount from "@/components/analytics/ga-event-on-mount";

export const metadata: Metadata = {
  title: "LeadClaw Pricing | AI Receptionist Software",
  description:
    "Simple pricing for LeadClaw AI receptionist software. Start free, try Growth for 7 days with no card, and upgrade when your team is ready.",
  alternates: {
    canonical: "/pricing",
  },
};

const isEarlyAccess = process.env.EARLY_ACCESS_MODE === "true";

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <GaEventOnMount
        name="pricing_viewed"
        params={{ route: "/pricing" }}
      />
      <div className="space-y-0">
        <PricingHero />
        <PricingGrid isEarlyAccess={isEarlyAccess} />
        <PricingComparison />
        <PricingFaq />
        <PricingCta />
      </div>
    </>
  );
}
