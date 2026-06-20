import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseLeadClawProduct } from "@/lib/subscription-access";

// Clear, stable markers so test enquiries are never mistaken for real leads.
export const TEST_ENQUIRY_NAME = "LeadClaw Test Enquiry";
export const TEST_ENQUIRY_SERVICE_PREFIX = "[TEST]";

type SubscriptionPlanStatusRow = {
  status: string | null;
  plan: string | null;
};

type IdRow = {
  id: string;
};

type OnboardingSiteRow = {
  clinic_id: string | null;
  domain: string | null;
};

export async function POST() {
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

  const admin = createAdminClient();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 400 },
    );
  }

  // Gate on the same widget-access rule used by the install page.
  const { data: subscription } = await (admin as unknown as SupabaseUntypedClient)
    .from("subscriptions")
    .select("status,plan")
    .eq("email", user.email)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestSubscription = subscription as SubscriptionPlanStatusRow | null;

  if (
    !canUseLeadClawProduct(
      latestSubscription?.status,
      latestSubscription?.plan,
    )
  ) {
    return NextResponse.json(
      { ok: false, error: "subscription_inactive" },
      { status: 403 },
    );
  }

  const { data: clientRow } = await (admin as unknown as SupabaseUntypedClient)
    .from("onboarding_clients")
    .select("id")
    .eq("contact_email", user.email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const onboardingClient = clientRow as IdRow | null;

  if (!onboardingClient?.id) {
    return NextResponse.json(
      { ok: false, error: "onboarding_client_not_found" },
      { status: 404 },
    );
  }

  const { data: siteRow } = await (admin as unknown as SupabaseUntypedClient)
    .from("onboarding_sites")
    .select("clinic_id,domain")
    .eq("onboarding_client_id", onboardingClient.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const onboardingSite = siteRow as OnboardingSiteRow | null;

  if (!onboardingSite?.clinic_id) {
    return NextResponse.json(
      { ok: false, error: "clinic_not_found" },
      { status: 404 },
    );
  }

  const stamp = new Date().toISOString();
  const domainNote = onboardingSite.domain
    ? ` for ${onboardingSite.domain}`
    : "";

  // Insert a clearly-marked test enquiry. No customer or clinic emails are
  // sent — this is a portal-only verification of the capture loop.
  const { data: inserted, error: insertError } = await (admin as unknown as SupabaseUntypedClient)
    .from("enquiries")
    .insert({
      clinic_id: onboardingSite.clinic_id,
      name: TEST_ENQUIRY_NAME,
      email: user.email,
      phone: null,
      service: `${TEST_ENQUIRY_SERVICE_PREFIX} Widget installation test${domainNote}`,
      preferred_time: `Sent from the portal install page on ${stamp}`,
      status: "new",
      // Keep test enquiries out of the real follow-up lifecycle.
      follow_up_eligible: false,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[portal.test-enquiry] insert failed", insertError);
    return NextResponse.json(
      { ok: false, error: "failed_to_store_test_enquiry" },
      { status: 500 },
    );
  }

  const enquiry = inserted as IdRow | null;

  return NextResponse.json({
    ok: true,
    test: true,
    enquiryId: enquiry?.id || null,
  });
}
