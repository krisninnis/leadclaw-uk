import PricingHero from "./_components/pricing-hero";
import PricingGrid from "./_components/pricing-grid";
import PricingComparison from "./_components/pricing-comparison";
import PricingFaq from "./_components/pricing-faq";
import PricingCta from "./_components/pricing-cta";
import { faqs } from "./pricing-data";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LeadClaw Pricing | AI workflow automation",
  description:
    "Simple pricing for LeadClaw's AI workflow automation suite. Start free, try Growth for 7 days, and upgrade when your team is ready.",
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
