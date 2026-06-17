// ClawLabsLocal — Landing Page Builder (Phase A)
// Create a new draft landing page.

import Link from "next/link";
import { requireAdminPageUser } from "../admin-access";
import { listActiveTemplates } from "@/lib/landing/store";
import LandingPageEditor from "@/components/landing/landing-page-editor";

export const dynamic = "force-dynamic";

export default async function NewLandingPage() {
  await requireAdminPageUser();
  const templates = await listActiveTemplates();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            New landing page
          </h1>
          <p className="mt-1 text-sm text-muted">
            Fill the structured fields, save a draft, preview, then publish.
          </p>
        </div>
        <Link href="/admin/landing-pages" className="button-secondary">
          Back to list
        </Link>
      </div>

      <LandingPageEditor mode="create" initialPage={null} templates={templates} />
    </div>
  );
}
