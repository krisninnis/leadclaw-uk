import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseLeadClawProduct } from "@/lib/subscription-access";
import { provisionClinicWorkspace } from "@/lib/provision-clinic";
import { buildWidgetSnippet, normalizeDomain } from "@/lib/onboarding";
import { getAppBaseUrl } from "@/lib/app-url";
import {
  INDUSTRY_VALUES,
  PLATFORM_VALUES,
  emptyOnboardingConfig,
  type OnboardingConfig,
} from "@/lib/onboarding-wizard";

export const runtime = "nodejs";

const schema = z.object({
  businessName: z.string().trim().max(200).optional(),
  websiteUrl: z.string().trim().max(2048).optional(),
  industry: z.enum(INDUSTRY_VALUES as [string, ...string[]]).optional(),
  platform: z.enum(PLATFORM_VALUES as [string, ...string[]]).optional(),
  services: z.array(z.string().trim().max(80)).max(30).optional(),
  openingHours: z.string().trim().max(500).optional(),
  enquiryPhone: z.string().trim().max(40).optional(),
  enquiryEmail: z.string().trim().max(200).optional(),
  completed: z.boolean().optional(),
});

type SubRow = { status: string | null; plan: string | null };
type IdRow = { id: string };
type SiteRow = { id: string; domain: string | null; settings: Record<string, unknown> | null };
type TokenRow = { token: string | null };

export async function POST(req: Request) {
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

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 },
    );
  }

  // Gate on the same widget-access rule as the install page / test enquiry.
  const { data: sub } = await (admin as unknown as SupabaseUntypedClient)
    .from("subscriptions")
    .select("status,plan")
    .eq("email", user.email)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const subscription = sub as SubRow | null;

  if (!canUseLeadClawProduct(subscription?.status, subscription?.plan)) {
    return NextResponse.json(
      { ok: false, error: "subscription_inactive" },
      { status: 403 },
    );
  }

  // Make sure the workspace exists (idempotent). This guarantees a site +
  // widget token even if the user reaches the wizard before provisioning ran.
  async function findClientId(): Promise<string | null> {
    const { data } = await (admin as unknown as SupabaseUntypedClient)
      .from("onboarding_clients")
      .select("id")
      .eq("contact_email", user!.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as IdRow | null)?.id || null;
  }

  let clientId = await findClientId();

  if (!clientId) {
    await provisionClinicWorkspace({
      email: user.email,
      ownerUserId: user.id,
      fallbackClinicName: input.businessName || null,
      fallbackDomain: input.websiteUrl || null,
      plan: (subscription?.plan as "basic" | "growth" | "pro") || undefined,
    });
    clientId = await findClientId();
  }

  if (!clientId) {
    return NextResponse.json(
      { ok: false, error: "workspace_unavailable" },
      { status: 500 },
    );
  }

  // Latest site for this client.
  const { data: siteData } = await (admin as unknown as SupabaseUntypedClient)
    .from("onboarding_sites")
    .select("id,domain,settings")
    .eq("onboarding_client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const site = siteData as SiteRow | null;

  if (!site?.id) {
    return NextResponse.json(
      { ok: false, error: "site_not_found" },
      { status: 404 },
    );
  }

  // Merge the incoming fields over the existing onboarding config.
  const existingSettings = (site.settings || {}) as Record<string, unknown>;
  const existingOnboarding = {
    ...emptyOnboardingConfig(),
    ...((existingSettings.onboarding as Partial<OnboardingConfig>) || {}),
  };

  const merged: OnboardingConfig = {
    businessName:
      input.businessName !== undefined
        ? input.businessName || null
        : existingOnboarding.businessName,
    websiteUrl:
      input.websiteUrl !== undefined
        ? input.websiteUrl || null
        : existingOnboarding.websiteUrl,
    industry:
      input.industry !== undefined
        ? (input.industry as OnboardingConfig["industry"])
        : existingOnboarding.industry,
    platform:
      input.platform !== undefined
        ? (input.platform as OnboardingConfig["platform"])
        : existingOnboarding.platform,
    services:
      input.services !== undefined
        ? input.services.map((s) => s.trim()).filter(Boolean)
        : existingOnboarding.services,
    openingHours:
      input.openingHours !== undefined
        ? input.openingHours || null
        : existingOnboarding.openingHours,
    enquiryPhone:
      input.enquiryPhone !== undefined
        ? input.enquiryPhone || null
        : existingOnboarding.enquiryPhone,
    enquiryEmail:
      input.enquiryEmail !== undefined
        ? input.enquiryEmail || null
        : existingOnboarding.enquiryEmail,
    completed: input.completed === true ? true : existingOnboarding.completed,
    completedAt:
      input.completed === true
        ? new Date().toISOString()
        : existingOnboarding.completedAt,
  };

  const newDomain = merged.websiteUrl
    ? normalizeDomain(merged.websiteUrl)
    : site.domain;

  const siteUpdate: Record<string, unknown> = {
    settings: { ...existingSettings, onboarding: merged },
  };
  if (merged.platform) siteUpdate.platform = merged.platform;
  if (newDomain) siteUpdate.domain = newDomain;
  if (merged.completed) siteUpdate.status = "installed";

  const { error: siteUpdateError } = await (admin as unknown as SupabaseUntypedClient)
    .from("onboarding_sites")
    .update(siteUpdate)
    .eq("id", site.id);

  if (siteUpdateError) {
    console.error("[onboarding.config] site update failed", siteUpdateError);
    return NextResponse.json(
      { ok: false, error: "failed_to_save" },
      { status: 500 },
    );
  }

  // Keep the human-readable business name in sync on client + clinic.
  if (merged.businessName) {
    await (admin as unknown as SupabaseUntypedClient)
      .from("onboarding_clients")
      .update({ business_name: merged.businessName })
      .eq("id", clientId);

    const { data: clinicSite } = await (admin as unknown as SupabaseUntypedClient)
      .from("onboarding_sites")
      .select("clinic_id")
      .eq("id", site.id)
      .maybeSingle();
    const clinicId = (clinicSite as { clinic_id: string | null } | null)?.clinic_id || null;
    if (clinicId) {
      await (admin as unknown as SupabaseUntypedClient)
        .from("clinics")
        .update({ name: merged.businessName })
        .eq("id", clinicId);
    }
  }

  // Fetch the active widget token + build the install snippet.
  const { data: tokenData } = await (admin as unknown as SupabaseUntypedClient)
    .from("widget_tokens")
    .select("token")
    .eq("onboarding_site_id", site.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const widgetToken = (tokenData as TokenRow | null)?.token || null;

  const appUrl = getAppBaseUrl();
  const snippet = widgetToken ? buildWidgetSnippet(appUrl, widgetToken) : "";

  return NextResponse.json({
    ok: true,
    config: merged,
    domain: newDomain,
    widgetToken,
    snippet,
  });
}
