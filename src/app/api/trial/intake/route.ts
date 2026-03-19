import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch((err) => {
      console.error("Failed to parse request body", err);
      return {};
    });

    console.log("Received body:", body); // Log the body to debug
    const plan = String(body?.plan || "")
      .trim()
      .toLowerCase();
    console.log("Plan:", plan); // Log the plan value

    const admin = createAdminClient();
    if (!admin) {
      console.error("Supabase admin client not configured");
      return NextResponse.json(
        { ok: false, error: "supabase_not_configured" },
        { status: 500 },
      );
    }

    const email = String(body?.email || "")
      .trim()
      .toLowerCase();
    if (!email) {
      console.error("Missing email in the request body");
      return NextResponse.json(
        { ok: false, error: "missing_email" },
        { status: 400 },
      );
    }

    const clinicName = String(body?.clinicName || "").trim() || null;
    const contactName = String(body?.contactName || "").trim() || null;
    const website = String(body?.website || "").trim() || null;
    const phone = String(body?.phone || "").trim() || null;
    const city = String(body?.city || "").trim() || "Not Provided"; // Default value for city

    const payload = {
      email,
      clinic_name: clinicName,
      contact_name: contactName,
      website,
      phone,
      plan,
      city, // Include city in the payload
      created_at: new Date().toISOString(),
    };

    const { error } = await admin.from("applications").insert(payload);

    if (error) {
      console.error(
        "Error inserting application into Supabase:",
        error.message,
      );
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Unexpected error occurred:", error);
    return NextResponse.json(
      { ok: false, error: "internal_server_error" },
      { status: 500 },
    );
  }
}
