import SeoArticlePage from "@/components/seo/seo-article-page";
import {
  buildSeoArticleMetadata,
  getSeoArticlePage,
} from "@/lib/seo-article-pages";

const page = getSeoArticlePage("ai-receptionist-vs-virtual-receptionist");

export const dynamic = "force-static";
export const metadata = buildSeoArticleMetadata(page);

export default function AiReceptionistVsVirtualReceptionistPage() {
  return <SeoArticlePage page={page} />;
}
