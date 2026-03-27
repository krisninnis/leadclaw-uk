import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";
import { logSystemEvent } from "@/lib/ops";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: Request) {
  const token = process.env.BILLING_RUN_TOKEN?.trim();
  const auth = req.headers.get("authorization") || "";
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  const isVercelCron = ua.includes("vercel-cron");

  if (!isVercelCron && (!token || auth !== `Bearer ${token}`)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 400 },
    );
  }

  // Find enquiries that:
  // - are still "new" (clinic hasn't responded/updated them)
  // - were created more than 2 hours ago
  // - haven't had a follow-up sent yet
  // - are eligible for follow-up
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: enquiries, error } = await admin
    .from("enquiries")
    .select(
      `
      id,
      name,
      email,
      service,
      created_at,
      clinic_id
    `,
    )
    .eq("status", "new")
    .eq("follow_up_eligible", true)
    .is("follow_up_sent_at", null)
    .lte("created_at", twoHoursAgo)
    .gte("created_at", twentyFourHoursAgo) // don't follow up on very old enquiries
    .limit(50);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const sent: string[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const enquiry of enquiries || []) {
    if (!enquiry.email) {
      skipped.push({ id: enquiry.id, reason: "no_email" });
      continue;
    }

    // Get clinic name for the email
    let clinicName = "the clinic";

    const { data: site } = await admin
      .from("onboarding_sites")
      .select("onboarding_client_id")
      .eq("clinic_id", enquiry.clinic_id)
      .limit(1)
      .maybeSingle();

    if (site?.onboarding_client_id) {
      const { data: client } = await admin
        .from("onboarding_clients")
        .select("business_name,client_name,contact_email")
        .eq("id", site.onboarding_client_id)
        .limit(1)
        .maybeSingle();

      clinicName =
        client?.business_name?.trim() ||
        client?.client_name?.trim() ||
        "the clinic";
    }

    if (!resend) {
      skipped.push({ id: enquiry.id, reason: "resend_not_configured" });
      continue;
    }

    try {
      await resend.emails.send({
        from: "LeadClaw <hello@leadclaw.uk>",
        to: enquiry.email,
        subject: `Still thinking about it? — ${escapeHtml(clinicName)}`,
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #0f172a; max-width: 520px;">
            <p>Hi ${escapeHtml(enquiry.name)},</p>
            <p>
              Just a quick note to let you know that <strong>${escapeHtml(clinicName)}</strong> received 
              your enquiry${enquiry.service ? ` about <strong>${escapeHtml(enquiry.service)}</strong>` : ""} 
              and the team will be in touch with you very soon.
            </p>
            <p>
              In the meantime, if you have any questions or want to book directly, 
              please don't hesitate to contact the clinic.
            </p>
            <p style="margin-top: 24px;">
              Best regards,<br/>
              <strong>${escapeHtml(clinicName)}</strong>
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 12px; color: #94a3b8;">
              You're receiving this because you submitted an enquiry through the ${escapeHtml(clinicName)} website.
            </p>
          </div>
        `,
        text: `Hi ${enquiry.name},

Just a quick note to let you know that ${clinicName} received your enquiry${enquiry.service ? ` about ${enquiry.service}` : ""} and the team will be in touch with you very soon.

In the meantime, if you have any questions or want to book directly, please don't hesitate to contact the clinic.

Best regards,
${clinicName}`,
      });

      // Mark follow-up as sent
      await admin
        .from("enquiries")
        .update({ follow_up_sent_at: new Date().toISOString() })
        .eq("id", enquiry.id);

      sent.push(enquiry.id);
    } catch (emailError) {
      console.error(
        `[follow-up] failed to send to ${enquiry.email}`,
        emailError,
      );
      skipped.push({ id: enquiry.id, reason: "send_failed" });
    }
  }

  await logSystemEvent({
    level: "info",
    category: "retention",
    message: `Follow-up run complete: sent=${sent.length} skipped=${skipped.length}`,
    meta: { sent, skipped },
  });

  return NextResponse.json({
    ok: true,
    sentCount: sent.length,
    skippedCount: skipped.length,
    sent,
    skipped,
  });
}
