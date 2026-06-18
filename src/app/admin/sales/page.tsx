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
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Admin-only header. Replaces the public marketing chrome, which is
          hidden on this route via Nav/AppFooter/AppShell. */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 py-3 md:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
              LC
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight text-foreground">
                LeadClaw
              </p>
              <nav aria-label="Breadcrumb">
                <ol className="flex items-center gap-1.5 text-xs text-muted">
                  <li>
                    <a href="/admin" className="hover:text-foreground">
                      Admin
                    </a>
                  </li>
                  <li aria-hidden="true">/</li>
                  <li className="font-medium text-foreground">
                    Sales Workspace
                  </li>
                </ol>
              </nav>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a href="/admin/lead-finder" className="button-secondary">
              Lead Finder
            </a>
            <a href="/admin" className="button-secondary">
              Back to admin
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Sales Workspace
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">
            Lead Finder &rarr; qualification &rarr; compliance-safe outreach
            review &rarr; human actions. Reviewing only &mdash; this workspace
            never sends outreach.
          </p>
        </div>

        <SalesWorkspaceClient />
      </main>
    </div>
  );
}
