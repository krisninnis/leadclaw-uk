import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

function buildRedirectUrl(
  request: NextRequest,
  status: "success" | "invalid" | "error",
  email?: string,
) {
  const url = new URL("/unsubscribed", request.url);
  url.searchParams.set("status", status);
  if (email) {
    url.searchParams.set("email", email);
  }
  return url;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return NextResponse.redirect(buildRedirectUrl(request, "invalid"));
  }

  try {
    const supabase = getSupabase();

    await supabase.from("email_suppressions").upsert(
      {
        email,
        reason: "unsubscribe_link",
        source: "leadclaw_app",
        suppressed_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );

    await supabase
      .from("leads")
      .update({
        status: "suppressed",
        pecr_reason: "Unsubscribed via email link",
      })
      .eq("contact_email", email);

    return NextResponse.redirect(buildRedirectUrl(request, "success", email));
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return NextResponse.redirect(buildRedirectUrl(request, "error", email));
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const email = formData.get("email")?.toString().trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const supabase = getSupabase();

    await supabase.from("email_suppressions").upsert(
      {
        email,
        reason: "list_unsubscribe_post",
        source: "leadclaw_app",
        suppressed_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );

    await supabase
      .from("leads")
      .update({
        status: "suppressed",
        pecr_reason: "Unsubscribed via List-Unsubscribe-Post",
      })
      .eq("contact_email", email);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unsubscribe POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
