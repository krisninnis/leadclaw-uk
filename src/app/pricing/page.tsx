import PricingHero from "./_components/pricing-hero";
import PricingGrid from "./_components/pricing-grid";
import PricingComparison from "./_components/pricing-comparison";
import PricingFaq from "./_components/pricing-faq";
import PricingCta from "./_components/pricing-cta";

export default function PricingPage() {
  return (
    <div className="space-y-0">
      <PricingHero />
      <PricingGrid />
      <PricingComparison />
      <PricingFaq />
      <PricingCta />
    </div>
  );
}
