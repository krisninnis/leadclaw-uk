import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  notifyWhatsapp: z.string().max(20).optional().nullable(),
  notifySms: z.string().max(20).optional().nullable(),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "db_not_configured" },
      { status: 500 },
    );
  }

  const channels = ["email"];
  if (parsed.data.notifyWhatsapp) channels.push("whatsapp");
  if (parsed.data.notifySms) channels.push("sms");

  await admin
    .from("onboarding_clients")
    .update({
      notify_whatsapp: parsed.data.notifyWhatsapp || null,
      notify_sms: parsed.data.notifySms || null,
      notify_channels: channels,
    })
    .eq("contact_email", user.email.toLowerCase());

  return NextResponse.json({ ok: true });
}
