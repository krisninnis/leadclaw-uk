import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseLeadClawProduct } from "@/lib/subscription-access";

const schema = z.object({
  email: z.string().email(),
});

type SubscriptionStatusRow = {
  status: string | null;
};

type OnboardingClientIdRow = {
  id: string;
};

export async function POST(req: Request) {
  const admin = createAdminClient();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 500 },
    );
  }

  try {
    const body = await req.json();
    const parsed = schema.parse(body);
    const email = parsed.email.trim().toLowerCase();

    const { data: subscription } = await (admin as unknown as SupabaseUntypedClient)
      .from("subscriptions")
      .select("status,updated_at")
      .eq("email", email)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const latestSubscription = subscription as SubscriptionStatusRow | null;

    const hasProductAccess = canUseLeadClawProduct(
      latestSubscription?.status || null,
    );

    const { data: onboardingClient } = await (admin as unknown as SupabaseUntypedClient)
      .from("onboarding_clients")
      .select("id")
      .eq("contact_email", email)
      .limit(1)
      .maybeSingle();

    const knownClient = Boolean(onboardingClient as OnboardingClientIdRow | null);

    return NextResponse.json({
      ok: true,
      knownClient,
      hasProductAccess,
      shouldLogin: knownClient && hasProductAccess,
      shouldStartTrial: !hasProductAccess,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 },
    );
  }
}
