import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SalesWorkspaceClient from "./sales-workspace-client";

type ProfileRow = {
  role: string | null;
};

export default async function SalesWorkspacePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const emailIsAdmin =
    !!user.email && adminEmails.includes(user.email.toLowerCase());
  const profileRole = (profile as ProfileRow | null)?.role;

  if (profileRole !== "admin" && !emailIsAdmin) {
    redirect("/portal");
  }

  return (
    <div className="space-y-8">
      <section className="page-hero">
        <div className="card-premium p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="badge-soft">
                <span className="h-2 w-2 rounded-full bg-brand" />
                Admin-only
              </div>

              <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                Sales Workspace
              </h1>

              <p className="mt-4 max-w-3xl text-lg leading-8 text-muted">
                One focused workspace for your sales motion: Lead Finder &rarr;
                qualification &rarr; compliance-safe outreach review &rarr; human
                actions &rarr; onboarding. Reviewing only &mdash; this workspace
                never sends outreach.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <a href="/admin/lead-finder" className="button-secondary">
                Lead Finder
              </a>
              <a href="/admin" className="button-secondary">
                Back to admin
              </a>
            </div>
          </div>
        </div>
      </section>

      <SalesWorkspaceClient />
    </div>
  );
}
