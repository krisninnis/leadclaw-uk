import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  console.log("Received body:", body);

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 500 },
    );
  }

  const email = String(body?.email || "")
    .trim()
    .toLowerCase();
  if (!email) {
    return NextResponse.json(
      { ok: false, error: "missing_email" },
      { status: 400 },
    );
  }

  const clinicName = String(body?.clinicName || "").trim() || null;
  // Production requires applications.contact_name NOT NULL. Guarantee a
  // non-null value: fall back to the clinic name, then the (already validated,
  // always present) email so the insert can never violate the constraint.
  const contactName =
    String(body?.contactName || "").trim() || clinicName || email;
  const website = String(body?.website || "").trim() || null;
  const phone = String(body?.phone || "").trim() || null;
  const plan = String(body?.plan || "growth")
    .trim()
    .toLowerCase();

  console.log("Plan:", plan); // Log the value of the plan field

  const payload = {
    email,
    clinic_name: clinicName,
    contact_name: contactName,
    website,
    phone,
    plan,
    created_at: new Date().toISOString(),
  };

  const { error } = await (admin as unknown as SupabaseUntypedClient).from("applications").insert(payload);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
