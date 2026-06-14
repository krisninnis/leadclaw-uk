import SeoArticlePage from "@/components/seo/seo-article-page";
import {
  buildSeoArticleMetadata,
  getSeoArticlePage,
} from "@/lib/seo-article-pages";

const page = getSeoArticlePage("missed-call-statistics-uk");

export const dynamic = "force-static";
export const metadata = buildSeoArticleMetadata(page);

export default function MissedCallStatisticsUkPage() {
  return <SeoArticlePage page={page} />;
}
