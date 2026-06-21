import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseLeadClawProduct } from "@/lib/subscription-access";
import { buildWidgetSnippet } from "@/lib/onboarding";
import { getAppBaseUrl } from "@/lib/app-url";
import {
  emptyOnboardingConfig,
  type OnboardingConfig,
} from "@/lib/onboarding-wizard";
import OnboardingWizard from "@/components/onboarding-wizard";

type SubRow = { status: string | null; plan: string | null };
type IdRow = { id: string };
type SiteRow = {
  id: string;
  domain: string | null;
  settings: Record<string, unknown> | null;
};
type TokenRow = {
  token: string | null;
  last_seen_at: string | null;
  last_seen_domain: string | null;
};

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) redirect("/login?next=/portal/onboarding");

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status,plan")
    .eq("email", user.email)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const subscription = sub as SubRow | null;

  if (!canUseLeadClawProduct(subscription?.status, subscription?.plan)) {
    redirect("/portal/billing");
  }

  const admin = createAdminClient({ optional: true });

  let config: OnboardingConfig = emptyOnboardingConfig();
  let widgetToken: string | null = null;
  let snippet = "";
  let detected = false;
  let domain: string | null = null;

  if (admin) {
    const { data: clientData } = await (admin as unknown as SupabaseUntypedClient)
      .from("onboarding_clients")
      .select("id")
      .eq("contact_email", user.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const clientId = (clientData as IdRow | null)?.id || null;

    if (clientId) {
      const { data: siteData } = await (admin as unknown as SupabaseUntypedClient)
        .from("onboarding_sites")
        .select("id,domain,settings")
        .eq("onboarding_client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const site = siteData as SiteRow | null;

      if (site?.id) {
        domain = site.domain;
        const settings = (site.settings || {}) as Record<string, unknown>;
        config = {
          ...emptyOnboardingConfig(),
          ...((settings.onboarding as Partial<OnboardingConfig>) || {}),
        };

        const { data: tokenData } = await (admin as unknown as SupabaseUntypedClient)
          .from("widget_tokens")
          .select("token,last_seen_at,last_seen_domain")
          .eq("onboarding_site_id", site.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const token = tokenData as TokenRow | null;
        widgetToken = token?.token || null;
        detected = Boolean(token?.last_seen_at);
      }
    }
  }

  // Pre-fill the business email from the account if nothing captured yet.
  if (!config.enquiryEmail) config.enquiryEmail = user.email;

  if (widgetToken) {
    snippet = buildWidgetSnippet(getAppBaseUrl(), widgetToken);
  }

  return (
    <OnboardingWizard
      initialConfig={config}
      initialSnippet={snippet}
      initialDetected={detected}
      initialDomain={domain}
      accountEmail={user.email}
    />
  );
}
