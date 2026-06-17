// ClawLabsLocal — Landing Page Builder (Phase A)
// Edit an existing landing page (any status). Same structured fields as create
// plus publish / unpublish controls.

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPageUser } from "../admin-access";
import { getLandingPageById, listActiveTemplates } from "@/lib/landing/store";
import LandingPageEditor from "@/components/landing/landing-page-editor";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditLandingPage({ params }: Props) {
  await requireAdminPageUser();
  const { id } = await params;
  const [page, templates] = await Promise.all([
    getLandingPageById(id),
    listActiveTemplates(),
  ]);
  if (!page) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Edit landing page
          </h1>
          <p className="mt-1 text-sm text-muted">
            /lp/{page.slug} · last updated{" "}
            {new Intl.DateTimeFormat("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(page.updated_at))}
          </p>
        </div>
        <Link href="/admin/landing-pages" className="button-secondary">
          Back to list
        </Link>
      </div>

      <LandingPageEditor mode="edit" initialPage={page} templates={templates} />
    </div>
  );
}
