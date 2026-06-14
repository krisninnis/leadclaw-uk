import SeoArticlePage from "@/components/seo/seo-article-page";
import {
  buildSeoArticleMetadata,
  getSeoArticlePage,
} from "@/lib/seo-article-pages";

const page = getSeoArticlePage("how-much-does-an-answering-service-cost-uk");

export const dynamic = "force-static";
export const metadata = buildSeoArticleMetadata(page);

export default function AnsweringServiceCostUkPage() {
  return <SeoArticlePage page={page} />;
}
