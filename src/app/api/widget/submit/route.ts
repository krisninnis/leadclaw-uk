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

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

    const safeName = parsed.name.trim();
    const safeEmail = parsed.email.trim().toLowerCase();
    const safePhone = parsed.phone?.trim() || null;

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
      name: safeName,
      email: safeEmail,
      phone: safePhone,
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

    let clinicName = "our clinic";
    let clinicContactEmail: string | null = null;

    if (site.onboarding_client_id) {
      const { data: client, error: clientError } = await admin
        .from("onboarding_clients")
        .select("contact_email,business_name,client_name")
        .eq("id", site.onboarding_client_id)
        .limit(1)
        .maybeSingle();

      if (clientError) {
        console.error("[widget.submit] client lookup failed", clientError);
      }

      clinicContactEmail = client?.contact_email?.trim() || null;
      clinicName =
        client?.business_name?.trim() ||
        client?.client_name?.trim() ||
        "our clinic";
    }

    if (!resend) {
      console.warn(
        "[widget.submit] RESEND_API_KEY missing; notification and auto reply skipped",
      );
    } else {
      if (clinicContactEmail) {
        try {
          const sendResult = await resend.emails.send({
            from: "LeadClaw <hello@leadclaw.uk>",
            to: clinicContactEmail,
            subject: "New website enquiry received",
            html: `
              <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.5; color: #0f172a;">
                <h2 style="margin-bottom: 12px;">New Enquiry Received</h2>
                <p style="margin-bottom: 16px;">
                  You have received a new website enquiry for <strong>${escapeHtml(
                    clinicName,
                  )}</strong>.
                </p>

                <table style="border-collapse: collapse; margin-bottom: 16px;">
                  <tr>
                    <td style="padding: 6px 12px 6px 0;"><strong>Name:</strong></td>
                    <td style="padding: 6px 0;">${escapeHtml(safeName)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 12px 6px 0;"><strong>Email:</strong></td>
                    <td style="padding: 6px 0;">${escapeHtml(safeEmail)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 12px 6px 0;"><strong>Phone:</strong></td>
                    <td style="padding: 6px 0;">${escapeHtml(
                      safePhone || "Not provided",
                    )}</td>
                  </tr>
                </table>

                <p style="margin-top: 16px;">
                  Log into your LeadClaw portal to view the lead.
                </p>
              </div>
            `,
            text: `New website enquiry received

Clinic: ${clinicName}
Name: ${safeName}
Email: ${safeEmail}
Phone: ${safePhone || "Not provided"}

Log into your LeadClaw portal to view the lead.`,
          });

          console.log("[widget.submit] clinic notification sent", sendResult);
        } catch (emailError) {
          console.error(
            "[widget.submit] clinic notification failed",
            emailError,
          );
        }
      } else {
        console.warn(
          "[widget.submit] no contact_email found for onboarding client",
          site.onboarding_client_id,
        );
      }

      try {
        const autoReplyResult = await resend.emails.send({
          from: "LeadClaw <hello@leadclaw.uk>",
          to: safeEmail,
          subject: `Thanks for contacting ${clinicName}`,
          html: `
            <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.5; color: #0f172a;">
              <p>Hi ${escapeHtml(safeName)},</p>

              <p>Thanks for contacting <strong>${escapeHtml(clinicName)}</strong>.</p>

              <p>
                We've received your enquiry and a member of the clinic team can follow up shortly.
              </p>

              <p>
                If your enquiry is urgent, please contact the clinic directly.
              </p>

              <p style="margin-top: 20px;">
                Best regards,<br />
                ${escapeHtml(clinicName)}
              </p>
            </div>
          `,
          text: `Hi ${safeName},

Thanks for contacting ${clinicName}.

We've received your enquiry and a member of the clinic team can follow up shortly.

If your enquiry is urgent, please contact the clinic directly.

Best regards,
${clinicName}`,
        });

        console.log("[widget.submit] auto reply sent", autoReplyResult);
      } catch (autoReplyError) {
        console.error("[widget.submit] auto reply failed", autoReplyError);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        stored: true,
        notifiedClinic: Boolean(clinicContactEmail && resend),
        autoReplySent: Boolean(resend),
      },
      { headers: corsHeaders },
    );
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
