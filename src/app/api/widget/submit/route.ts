import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { canUseLeadClawProduct } from "@/lib/subscription-access";

const schema = z.object({
  token: z.string().min(10),
  name: z.string().min(1).max(120),
  email: z.string().email().max(255),
  phone: z.string().max(50).optional(),
  message: z.string().min(1).max(4000).optional(),
  intent: z.string().max(120).optional(),
  pageUrl: z.string().max(1000).optional(),
  pageTitle: z.string().max(300).optional(),
  domain: z.string().max(255).optional(),
  siteStatus: z.string().max(120).optional(),
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

  const ip = getClientIp(req);
  const limit = rateLimit({
    windowMs: 60_000,
    max: 10,
    key: `widget-submit:${ip}`,
  });

  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limit_exceeded" },
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Retry-After": String(
            Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000)),
          ),
        },
      },
    );
  }

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
    const safeMessage = parsed.message?.trim() || null;
    const safeIntent = parsed.intent?.trim() || null;
    const safePageUrl = parsed.pageUrl?.trim() || null;
    const safePageTitle = parsed.pageTitle?.trim() || null;
    const safeDomain = parsed.domain?.trim().toLowerCase() || null;

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
      .select("clinic_id,onboarding_client_id,domain")
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

      clinicContactEmail = client?.contact_email?.trim().toLowerCase() || null;
      clinicName =
        client?.business_name?.trim() ||
        client?.client_name?.trim() ||
        "our clinic";
    }

    const { data: subscriptionRow } = clinicContactEmail
      ? await admin
          .from("subscriptions")
          .select("status,email")
          .eq("email", clinicContactEmail)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    const subscriptionStatus = subscriptionRow?.status || null;
    const allowed = canUseLeadClawProduct(subscriptionStatus);

    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: "subscription_inactive" },
        { status: 403, headers: corsHeaders },
      );
    }

    const enquiryPayload = {
      clinic_id: site.clinic_id,
      name: safeName,
      email: safeEmail,
      phone: safePhone,
      message: safeMessage,
      status: "new",
      source: "widget",
      meta: {
        intent: safeIntent,
        pageUrl: safePageUrl,
        pageTitle: safePageTitle,
        domain: safeDomain,
        siteDomain: site.domain || null,
      },
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

    if (!resend) {
      console.warn(
        "[widget.submit] RESEND_API_KEY missing; notification and auto reply skipped",
      );
    } else {
      if (clinicContactEmail) {
        try {
          await resend.emails.send({
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
                  <tr>
                    <td style="padding: 6px 12px 6px 0;"><strong>Intent:</strong></td>
                    <td style="padding: 6px 0;">${escapeHtml(
                      safeIntent || "General enquiry",
                    )}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 12px 6px 0; vertical-align: top;"><strong>Message:</strong></td>
                    <td style="padding: 6px 0;">${escapeHtml(
                      safeMessage || "No message provided",
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
Intent: ${safeIntent || "General enquiry"}
Message: ${safeMessage || "No message provided"}

Log into your LeadClaw portal to view the lead.`,
          });
        } catch (emailError) {
          console.error(
            "[widget.submit] clinic notification failed",
            emailError,
          );
        }
      }

      try {
        await resend.emails.send({
          from: "LeadClaw <hello@leadclaw.uk>",
          to: safeEmail,
          subject: `Thanks for contacting ${clinicName}`,
          html: `
            <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.5; color: #0f172a;">
              <p>Hi ${escapeHtml(safeName)},</p>
              <p>Thanks for contacting <strong>${escapeHtml(clinicName)}</strong>.</p>
              <p>We've received your enquiry and a member of the clinic team can follow up shortly.</p>
              <p>If your enquiry is urgent, please contact the clinic directly.</p>
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
  } catch (err) {
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
