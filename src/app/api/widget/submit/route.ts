import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  token: z.string().min(10),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
});

async function sendLeadNotification(input: {
  to: string;
  clinicName: string;
  leadName: string;
  leadEmail: string;
  leadPhone?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey || !fromEmail) {
    return;
  }

  const phoneLine = input.leadPhone ? `Phone: ${input.leadPhone}` : "Phone: —";

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [input.to],
      subject: `New Lead for ${input.clinicName}`,
      text: [
        `A new lead was captured for ${input.clinicName}.`,
        "",
        `Name: ${input.leadName}`,
        `Email: ${input.leadEmail}`,
        phoneLine,
      ].join("\n"),
    }),
  });
}

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

    const { data: site } = await admin
      .from("onboarding_sites")
      .select("clinic_id,onboarding_client_id")
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

    if (site.onboarding_client_id) {
      const { data: client } = await admin
        .from("onboarding_clients")
        .select("client_name,business_name,contact_email")
        .eq("id", site.onboarding_client_id)
        .limit(1)
        .maybeSingle();

      const notifyEmail = client?.contact_email?.trim();
      const clinicName =
        client?.business_name?.trim() ||
        client?.client_name?.trim() ||
        "your clinic";

      if (notifyEmail) {
        try {
          await sendLeadNotification({
            to: notifyEmail,
            clinicName,
            leadName: parsed.name,
            leadEmail: parsed.email,
            leadPhone: parsed.phone || null,
          });
        } catch {
          // non-blocking: enquiry is already stored
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "invalid_request";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
