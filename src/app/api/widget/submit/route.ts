import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  token: z.string().min(10),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
});

export async function POST(req: Request) {
  const admin = createAdminClient();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 400 },
    );
  }

  try {
    const body = await req.json();
    const parsed = schema.parse(body);

    // find widget token
    const { data: tokenRow } = await admin
      .from("widget_tokens")
      .select("onboarding_site_id,status")
      .eq("token", parsed.token)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!tokenRow) {
      return NextResponse.json(
        { ok: false, error: "invalid_widget_token" },
        { status: 401 },
      );
    }

    // find the clinic linked to the onboarding site
    const { data: site } = await admin
      .from("onboarding_sites")
      .select("clinic_id")
      .eq("id", tokenRow.onboarding_site_id)
      .limit(1)
      .maybeSingle();

    if (!site?.clinic_id) {
      return NextResponse.json(
        { ok: false, error: "clinic_not_found" },
        { status: 400 },
      );
    }

    const enquiryPayload = {
      clinic_id: site.clinic_id,
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone || null,
    };

    const { error } = await admin.from("enquiries").insert(enquiryPayload);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "invalid_request";

    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
