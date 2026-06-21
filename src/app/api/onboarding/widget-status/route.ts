import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type IdRow = { id: string };
type TokenRow = {
  last_seen_at: string | null;
  last_seen_domain: string | null;
};

// Lightweight polling endpoint for the wizard "Verify installation" step.
// Reports whether the widget has pinged home (set by /api/widget/ping).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401 },
    );
  }

  const admin = createAdminClient({ optional: true });
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 400 },
    );
  }

  const { data: clientData } = await (admin as unknown as SupabaseUntypedClient)
    .from("onboarding_clients")
    .select("id")
    .eq("contact_email", user.email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const clientId = (clientData as IdRow | null)?.id || null;

  if (!clientId) {
    return NextResponse.json({ ok: true, detected: false, lastSeenAt: null, lastSeenDomain: null });
  }

  const { data: siteData } = await (admin as unknown as SupabaseUntypedClient)
    .from("onboarding_sites")
    .select("id")
    .eq("onboarding_client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const siteId = (siteData as IdRow | null)?.id || null;

  if (!siteId) {
    return NextResponse.json({ ok: true, detected: false, lastSeenAt: null, lastSeenDomain: null });
  }

  const { data: tokenData } = await (admin as unknown as SupabaseUntypedClient)
    .from("widget_tokens")
    .select("last_seen_at,last_seen_domain")
    .eq("onboarding_site_id", siteId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const token = tokenData as TokenRow | null;

  return NextResponse.json({
    ok: true,
    detected: Boolean(token?.last_seen_at),
    lastSeenAt: token?.last_seen_at || null,
    lastSeenDomain: token?.last_seen_domain || null,
  });
}
