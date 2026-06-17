// ClawLabsLocal — Landing Page Builder (Phase A)
// Admin landing page list. Gated by the same admin check used elsewhere.

import Link from "next/link";
import { requireAdminPageUser } from "./admin-access";
import { listLandingPages } from "@/lib/landing/store";
import LandingPagesClient from "./landing-pages-client";

export const dynamic = "force-dynamic";

export default async function LandingPagesAdminPage() {
  await requireAdminPageUser();
  const pages = await listLandingPages();

  return (
    <div className="space-y-8">
      <section className="page-hero">
        <div className="card-premium p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="badge-soft">
                <span className="h-2 w-2 rounded-full bg-brand" />
                ClawLabsLocal · Admin-only
              </div>
              <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                Landing pages
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-muted">
                Build, preview, and publish local SEO landing pages served at
                <span className="font-medium text-foreground"> /lp/&lt;slug&gt;</span>.
                Manual structured fields only — no AI generation in this phase.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/admin/landing-pages/new" className="button-primary">
                + New page
              </Link>
              <a href="/admin" className="button-secondary">
                Back to admin
              </a>
            </div>
          </div>
        </div>
      </section>

      <LandingPagesClient initialPages={pages} />
    </div>
  );
}
