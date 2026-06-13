import SeoLandingPage from "@/components/seo/seo-landing-page";
import { getAiReceptionistPage } from "@/lib/ai-receptionist-pages";
import { buildSeoPageMetadata } from "@/lib/seo-metadata";

function loadPage() {
  const page = getAiReceptionistPage("ai-receptionist-for-roofers-uk");
  if (!page) {
    throw new Error("Missing SEO page data for ai-receptionist-for-roofers-uk");
  }
  return page;
}

const page = loadPage();

export const dynamic = "force-static";
export const metadata = buildSeoPageMetadata(page);

export default function Page() {
  return <SeoLandingPage page={page} />;
}
