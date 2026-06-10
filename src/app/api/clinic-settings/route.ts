import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const schema = z.object({
  google_review_url: z.string().url().max(500).optional().nullable(),
  review_requests_enabled: z.boolean().optional(),
  reminders_enabled: z.boolean().optional(),
});

type OnboardingClientIdRow = {
  id: string;
};

type OnboardingSiteClinicRow = {
  clinic_id: string | null;
};

type ClinicSettingsRow = {
  google_review_url: string | null;
  review_requests_enabled: boolean | null;
  reminders_enabled: boolean | null;
};

async function getClinicId(
  userEmail: string,
  admin: ReturnType<typeof createAdminClient>,
) {
  if (!admin) return null;
  const { data: client } = await (admin as any)
    .from("onboarding_clients")
    .select("id")
    .eq("contact_email", userEmail)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const onboardingClient = client as OnboardingClientIdRow | null;

  if (!onboardingClient?.id) return null;

  const { data: site } = await (admin as any)
    .from("onboarding_sites")
    .select("clinic_id")
    .eq("onboarding_client_id", onboardingClient.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const onboardingSite = site as OnboardingSiteClinicRow | null;

  return onboardingSite?.clinic_id || null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );

  const admin = createAdminClient();
  const clinicId = await getClinicId(user.email!, admin);
  if (!clinicId)
    return NextResponse.json(
      { ok: false, error: "clinic_not_found" },
      { status: 404 },
    );

  const { data } = await (admin as any)
    .from("clinic_settings")
    .select("google_review_url, review_requests_enabled, reminders_enabled")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  const settings = data as ClinicSettingsRow | null;

  return NextResponse.json({
    ok: true,
    google_review_url: settings?.google_review_url || null,
    review_requests_enabled: settings?.review_requests_enabled ?? true,
    reminders_enabled: settings?.reminders_enabled ?? true,
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );

  const admin = createAdminClient();
  const clinicId = await getClinicId(user.email!, admin);
  if (!clinicId)
    return NextResponse.json(
      { ok: false, error: "clinic_not_found" },
      { status: 404 },
    );

  try {
    const body = await req.json();
    const parsed = schema.parse(body);

    const { error } = await (admin as any)
      .from("clinic_settings")
      .upsert(
        {
          clinic_id: clinicId,
          ...parsed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "clinic_id" },
      );

    if (error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json(
        { ok: false, error: "invalid_request" },
        { status: 400 },
      );
    return NextResponse.json(
      { ok: false, error: "unexpected_error" },
      { status: 500 },
    );
  }
}
