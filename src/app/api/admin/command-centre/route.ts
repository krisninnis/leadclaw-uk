import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assembleClinics,
  classifyHealth,
  onboardingProgress,
  buildTimeline,
  widgetIsLive,
  computeActionRequired,
  computeFounderMetrics,
  computePipeline,
  computeThisWeek,
  type RawClient,
  type RawSite,
  type RawToken,
  type RawSubscription,
  type RawEnquiry,
  type RawLead,
} from "@/lib/admin/command-centre";
import {
  computeGrowthFunnel,
  computeAtRiskTrials,
} from "@/lib/admin/growth-funnel";

export const runtime = "nodejs";

// Read-only operational aggregate for the Command Centre dashboard. This route
// never writes, deletes, or mutates any record — it only reads existing tables
// and classifies/aggregates them. It does not touch billing, Stripe, outreach,
// onboarding, visibility, scraping, or widget behaviour.

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

  const a = admin as unknown as SupabaseUntypedClient;

  try {
    const [clientsRes, sitesRes, tokensRes, subsRes, enquiriesRes, leadsRes] =
      await Promise.all([
        a
          .from("onboarding_clients")
          .select(
            "id,client_name,business_name,contact_email,status,created_at,notify_sms,notify_whatsapp,notify_channels",
          )
          .order("created_at", { ascending: false })
          .limit(500),
        a
          .from("onboarding_sites")
          .select(
            "id,onboarding_client_id,domain,platform,settings,status,clinic_id,created_at",
          )
          .order("created_at", { ascending: false })
          .limit(1000),
        a
          .from("widget_tokens")
          .select(
            "id,onboarding_site_id,token,status,last_seen_at,last_seen_domain,created_at",
          )
          .order("created_at", { ascending: false })
          .limit(1000),
        a
          .from("subscriptions")
          .select(
            "id,email,plan,status,trial_end,current_period_end,created_at,updated_at",
          )
          .order("updated_at", { ascending: false })
          .limit(1000),
        a
          .from("enquiries")
          .select("id,clinic_id,name,service,status,created_at")
          .order("created_at", { ascending: false })
          .limit(5000),
        a
          .from("leads")
          .select("id,status,source,created_at")
          .order("created_at", { ascending: false })
          .limit(5000),
      ]);

    const clients = (clientsRes.data || []) as RawClient[];
    const sites = (sitesRes.data || []) as RawSite[];
    const tokens = (tokensRes.data || []) as RawToken[];
    const subscriptions = (subsRes.data || []) as RawSubscription[];
    const enquiries = (enquiriesRes.data || []) as RawEnquiry[];
    const leads = (leadsRes.data || []) as RawLead[];

    const now = Date.now();
    const clinics = assembleClinics({
      clients,
      sites,
      tokens,
      subscriptions,
      enquiries,
    });

    // Growth Funnel — Visitors source.
    // PostHog events are captured client-side (src/lib/analytics.ts /
    // src/components/posthog-provider.tsx); there is no server-side PostHog read
    // wired up yet, so Visitors is null and the UI shows a placeholder.
    // INTEGRATION POINT: add a PostHog Query API read here (count page_view /
    // social_page_view over the chosen window) and pass the result as the second
    // argument to computeGrowthFunnel — the funnel and the Visitors→Trials
    // conversion then populate with no further changes.
    const visitors: number | null = null;

    const clinicViews = clinics.map((c) => {
      const health = classifyHealth(c, now);
      const progress = onboardingProgress(c);
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        domain: c.domain,
        isDemo: c.isDemo,
        subscriptionStatus: c.subscriptionStatus,
        subscriptionPlan: c.subscriptionPlan,
        totalEnquiries: c.totalEnquiries,
        realEnquiries: c.realEnquiries,
        testEnquiries: c.testEnquiries,
        createdAt: c.createdAt,
        health,
        progress: {
          completed: progress.completed,
          total: progress.total,
          nextStep: progress.nextStep,
          steps: progress.steps,
        },
        widget: {
          live: widgetIsLive(c.widgetLastSeenAt, now),
          tokenActive: c.widgetTokenActive,
          lastSeenAt: c.widgetLastSeenAt,
          lastSeenDomain: c.widgetLastSeenDomain,
        },
        timeline: buildTimeline(c),
      };
    });

    return NextResponse.json({
      ok: true,
      generatedAt: new Date(now).toISOString(),
      growthFunnel: computeGrowthFunnel(clinics, visitors),
      atRisk: computeAtRiskTrials(clinics, now),
      actionRequired: computeActionRequired(clinics, now),
      founderMetrics: computeFounderMetrics(clinics, leads, enquiries, now),
      thisWeek: computeThisWeek(clinics, leads, enquiries, now),
      pipeline: computePipeline(leads),
      clinics: clinicViews,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "command_centre_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
