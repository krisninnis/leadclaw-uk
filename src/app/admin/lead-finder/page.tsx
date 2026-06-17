import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  defaultLeadFinderConfig,
  type LeadFinderConfigInput,
  type LeadFinderRunSummary,
} from "@/lib/lead-finder";
import LeadFinderClient from "./lead-finder-client";

type ProfileRow = {
  role: string | null;
};

type LeadFinderConfigRow = {
  id: string;
  name: string | null;
  niche_mode: LeadFinderConfigInput["niche_mode"];
  niches: string[] | null;
  locations: string[] | null;
  lead_limit: number | null;
  discover_emails: boolean | null;
  email_discovery_max_pages: number | null;
  dry_run: boolean | null;
  schedule_enabled: boolean | null;
  run_time_local: string | null;
  timezone: string | null;
  updated_at: string | null;
};

export type LeadFinderRunListItem = {
  id: string;
  status: string | null;
  dry_run: boolean | null;
  summary: Partial<LeadFinderRunSummary> | null;
  exit_code: number | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
};

function normalizeTime(value: string | null | undefined) {
  if (!value) return "09:00";
  return value.slice(0, 5);
}

function configFromRow(row: LeadFinderConfigRow | null): LeadFinderConfigInput {
  const defaults = defaultLeadFinderConfig();
  if (!row) return defaults;

  return {
    name: row.name || defaults.name,
    niche_mode: row.niche_mode || defaults.niche_mode,
    niches: row.niches || defaults.niches,
    locations: row.locations || defaults.locations,
    limit: row.lead_limit || defaults.limit,
    discover_emails: row.discover_emails ?? defaults.discover_emails,
    email_discovery_max_pages:
      row.email_discovery_max_pages || defaults.email_discovery_max_pages,
    dry_run: row.dry_run ?? defaults.dry_run,
    schedule_enabled: row.schedule_enabled ?? defaults.schedule_enabled,
    run_time_local: normalizeTime(row.run_time_local),
    timezone: row.timezone || defaults.timezone,
  };
}

export default async function LeadFinderPage() {
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

  const admin = createAdminClient();
  let initialConfig = defaultLeadFinderConfig();
  let runs: LeadFinderRunListItem[] = [];

  if (admin) {
    const { data: configRows } = await (admin as unknown as SupabaseUntypedClient)
      .from("lead_finder_configs")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1);

    initialConfig = configFromRow(
      ((configRows || []) as LeadFinderConfigRow[])[0] || null,
    );

    const { data: runRows } = await (admin as unknown as SupabaseUntypedClient)
      .from("lead_finder_runs")
      .select(
        "id,status,dry_run,summary,exit_code,error,started_at,completed_at,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(10);

    runs = ((runRows || []) as LeadFinderRunListItem[]).map((run) => ({
      ...run,
      summary: run.summary || null,
    }));
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
                Lead Finder
              </h1>

              <p className="mt-4 max-w-3xl text-lg leading-8 text-muted">
                Configure small, safe scraper runs from inside LeadClaw. This
                imports or previews leads only; outreach sending stays separate
                and disabled here.
              </p>
            </div>

            <a href="/admin" className="button-secondary">
              Back to admin
            </a>
          </div>
        </div>
      </section>

      <LeadFinderClient initialConfig={initialConfig} initialRuns={runs} />
    </div>
  );
}
