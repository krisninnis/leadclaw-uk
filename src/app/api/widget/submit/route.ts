import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  token: z.string().min(10),
  name: z.string().min(1).max(120),
  email: z.string().email().max(255),
  phone: z.string().max(50).optional(),
});

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function buildCorsHeaders(origin?: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");

  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(origin),
  });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);

  const admin = createAdminClient();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 400, headers: corsHeaders },
    );
  }

  try {
    const body = await req.json();
    const parsed = schema.parse(body);

    const { data: tokenRow, error: tokenError } = await admin
      .from("widget_tokens")
      .select("onboarding_site_id,status")
      .eq("token", parsed.token)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (tokenError) {
      console.error("[widget.submit] token lookup failed", tokenError);

      return NextResponse.json(
        { ok: false, error: "token_lookup_failed" },
        { status: 500, headers: corsHeaders },
      );
    }

    if (!tokenRow) {
      return NextResponse.json(
        { ok: false, error: "invalid_widget_token" },
        { status: 401, headers: corsHeaders },
      );
    }

    const { data: site, error: siteError } = await admin
      .from("onboarding_sites")
      .select("clinic_id,onboarding_client_id")
      .eq("id", tokenRow.onboarding_site_id)
      .limit(1)
      .maybeSingle();

    if (siteError) {
      console.error("[widget.submit] site lookup failed", siteError);

      return NextResponse.json(
        { ok: false, error: "site_lookup_failed" },
        { status: 500, headers: corsHeaders },
      );
    }

    if (!site?.clinic_id) {
      return NextResponse.json(
        { ok: false, error: "clinic_not_found" },
        { status: 400, headers: corsHeaders },
      );
    }

    const enquiryPayload = {
      clinic_id: site.clinic_id,
      name: parsed.name.trim(),
      email: parsed.email.trim().toLowerCase(),
      phone: parsed.phone?.trim() || null,
    };

    const { error: insertError } = await admin
      .from("enquiries")
      .insert(enquiryPayload);

    if (insertError) {
      console.error("[widget.submit] enquiry insert failed", insertError);

      return NextResponse.json(
        { ok: false, error: "failed_to_store_enquiry" },
        { status: 500, headers: corsHeaders },
      );
    }

    if (site.onboarding_client_id && resend) {
      const { data: client, error: clientError } = await admin
        .from("onboarding_clients")
        .select("contact_email,company_name")
        .eq("id", site.onboarding_client_id)
        .limit(1)
        .maybeSingle();

      if (clientError) {
        console.error("[widget.submit] client lookup failed", clientError);
      }

      if (client?.contact_email) {
        try {
          const sendResult = await resend.emails.send({
            from: "LeadClaw <onboarding@resend.dev>",
            to: client.contact_email,
            subject: "New website enquiry received",
            html: `
              <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.5; color: #0f172a;">
                <h2 style="margin-bottom: 12px;">New Enquiry Received</h2>
                <p style="margin-bottom: 16px;">
                  You have received a new website enquiry${
                    client.company_name
                      ? ` for <strong>${client.company_name}</strong>`
                      : ""
                  }.
                </p>

                <table style="border-collapse: collapse; margin-bottom: 16px;">
                  <tr>
                    <td style="padding: 6px 12px 6px 0;"><strong>Name:</strong></td>
                    <td style="padding: 6px 0;">${parsed.name.trim()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 12px 6px 0;"><strong>Email:</strong></td>
                    <td style="padding: 6px 0;">${parsed.email.trim().toLowerCase()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 12px 6px 0;"><strong>Phone:</strong></td>
                    <td style="padding: 6px 0;">${parsed.phone?.trim() || "Not provided"}</td>
                  </tr>
                </table>

                <p style="margin-top: 16px;">
                  Log into your LeadClaw portal to view the lead.
                </p>
              </div>
            `,
          });

          console.log("[widget.submit] lead notification sent", sendResult);
        } catch (emailError) {
          console.error("[widget.submit] lead notification failed", emailError);
        }
      } else {
        console.warn(
          "[widget.submit] no contact_email found for onboarding client",
          site.onboarding_client_id,
        );
      }
    } else if (!resend) {
      console.warn(
        "[widget.submit] RESEND_API_KEY missing; notification skipped",
      );
    }

    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "invalid_request" },
        { status: 400, headers: corsHeaders },
      );
    }

    console.error("[widget.submit] unexpected error", err);

    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400, headers: corsHeaders },
    );
  }
}
