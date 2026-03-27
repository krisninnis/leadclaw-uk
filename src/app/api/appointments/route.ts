import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const schema = z.object({
  patient_name: z.string().min(1).max(120),
  patient_email: z.string().email().max(255).optional().nullable(),
  patient_phone: z.string().max(50).optional().nullable(),
  service: z.string().max(255).optional().nullable(),
  appointment_at: z.string().datetime(),
  notes: z.string().max(1000).optional().nullable(),
});

async function getClinicId(
  userEmail: string,
  admin: ReturnType<typeof createAdminClient>,
) {
  if (!admin) return null;
  const { data: client } = await admin
    .from("onboarding_clients")
    .select("id")
    .eq("contact_email", userEmail)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!client?.id) return null;

  const { data: site } = await admin
    .from("onboarding_sites")
    .select("clinic_id")
    .eq("onboarding_client_id", client.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return site?.clinic_id || null;
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

  const { data, error } = await admin!
    .from("appointments")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("appointment_at", { ascending: true })
    .limit(100);

  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );

  return NextResponse.json({ ok: true, appointments: data });
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

    const { data, error } = await admin!
      .from("appointments")
      .insert({ ...parsed, clinic_id: clinicId })
      .select("id")
      .single();

    if (error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );

    return NextResponse.json({ ok: true, id: data.id });
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

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id)
    return NextResponse.json(
      { ok: false, error: "missing_id" },
      { status: 400 },
    );

  const admin = createAdminClient();
  const clinicId = await getClinicId(user.email!, admin);
  if (!clinicId)
    return NextResponse.json(
      { ok: false, error: "clinic_not_found" },
      { status: 404 },
    );

  const { error } = await admin!
    .from("appointments")
    .delete()
    .eq("id", id)
    .eq("clinic_id", clinicId);

  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );

  return NextResponse.json({ ok: true });
}
