import PricingHero from "./_components/pricing-hero";
import PricingGrid from "./_components/pricing-grid";
import PricingComparison from "./_components/pricing-comparison";
import PricingFaq from "./_components/pricing-faq";
import PricingCta from "./_components/pricing-cta";
import { faqs } from "./pricing-data";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LeadClaw Pricing | AI Front Desk for UK Aesthetic Clinics",
  description:
    "Simple, transparent pricing for UK aesthetic clinics. Start free, try Growth for 7 days, upgrade when ready. From £79/month.",
};

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
      <div className="space-y-0">
        <PricingHero />
        <PricingGrid />
        <PricingComparison />
        <PricingFaq />
        <PricingCta />
      </div>
    </>
  );
}
