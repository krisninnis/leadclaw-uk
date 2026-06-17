import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import { parseLeadFinderConfig } from "@/lib/lead-finder";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  const authed = await requireAdmin();
  if (!authed.ok) return authed.response;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 400 },
    );
  }

  const { data, error } = await (admin as unknown as SupabaseUntypedClient)
    .from("lead_finder_configs")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, configs: data || [] });
}

export async function POST(req: Request) {
  const authed = await requireAdmin();
  if (!authed.ok) return authed.response;

  let config;
  try {
    const body = await req.json().catch(() => ({}));
    config = parseLeadFinderConfig(body);
  } catch (error: unknown) {
    const message =
      error instanceof ZodError
        ? error.issues[0]?.message || "invalid_config"
        : error instanceof Error
          ? error.message
          : "invalid_config";

    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 400 },
    );
  }

  const payload = {
    name: config.name,
    niche_mode: config.niche_mode,
    niches: config.niches,
    locations: config.locations,
    lead_limit: config.limit,
    discover_emails: config.discover_emails,
    email_discovery_max_pages: config.email_discovery_max_pages,
    dry_run: config.dry_run,
    schedule_enabled: config.schedule_enabled,
    run_time_local: config.run_time_local,
    timezone: config.timezone,
    created_by: authed.user.id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await (admin as unknown as SupabaseUntypedClient)
    .from("lead_finder_configs")
    .upsert(payload, { onConflict: "name" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, config: data });
}
