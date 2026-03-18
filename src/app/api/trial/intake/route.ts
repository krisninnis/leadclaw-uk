import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

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
  const contactName = String(body?.contactName || "").trim() || null;
  const website = String(body?.website || "").trim() || null;
  const phone = String(body?.phone || "").trim() || null;
  const plan = String(body?.plan || "growth")
    .trim()
    .toLowerCase();

  const payload = {
    email,
    clinic_name: clinicName,
    contact_name: contactName,
    website,
    phone,
    plan,
    created_at: new Date().toISOString(),
  };

  const { error } = await admin.from("applications").insert(payload);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
