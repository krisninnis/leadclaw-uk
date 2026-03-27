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

  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const fiftyHoursAgo = new Date(now.getTime() - 50 * 60 * 60 * 1000);

  const { data: appointments } = await admin
    .from("appointments")
    .select(
      "id, patient_name, patient_email, service, appointment_at, clinic_id",
    )
    .eq("review_eligible", true)
    .is("review_request_sent_at", null)
    .gte("appointment_at", fiftyHoursAgo.toISOString())
    .lte("appointment_at", fortyEightHoursAgo.toISOString())
    .not("patient_email", "is", null)
    .limit(50);

  const sent: string[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const appt of appointments || []) {
    if (!resend) {
      skipped.push({ id: appt.id, reason: "resend_not_configured" });
      continue;
    }

    // Get clinic name and Google review URL
    let clinicName = "your clinic";
    let googleReviewUrl: string | null = null;

    const { data: site } = await admin
      .from("onboarding_sites")
      .select("onboarding_client_id")
      .eq("clinic_id", appt.clinic_id)
      .limit(1)
      .maybeSingle();

    if (site?.onboarding_client_id) {
      const { data: client } = await admin
        .from("onboarding_clients")
        .select("business_name, client_name")
        .eq("id", site.onboarding_client_id)
        .limit(1)
        .maybeSingle();

      clinicName =
        client?.business_name?.trim() ||
        client?.client_name?.trim() ||
        "your clinic";
    }

    const { data: settings } = await admin
      .from("clinic_settings")
      .select("google_review_url, review_requests_enabled")
      .eq("clinic_id", appt.clinic_id)
      .maybeSingle();

    if (settings?.review_requests_enabled === false) {
      skipped.push({ id: appt.id, reason: "review_requests_disabled" });
      continue;
    }

    googleReviewUrl = settings?.google_review_url || null;

    const reviewButtonHtml = googleReviewUrl
      ? `<div style="margin: 24px 0;">
          <a href="${escapeHtml(googleReviewUrl)}" 
             style="background: #0f172a; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Leave a Google review
          </a>
         </div>`
      : `<p>If you have a moment, please share your feedback with the clinic directly — it means a lot to the team.</p>`;

    try {
      await resend.emails.send({
        from: "LeadClaw <hello@leadclaw.uk>",
        to: appt.patient_email,
        subject: `How was your visit to ${escapeHtml(clinicName)}?`,
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #0f172a; max-width: 520px;">
            <p>Hi ${escapeHtml(appt.patient_name)},</p>
            <p>Thank you for visiting <strong>${escapeHtml(clinicName)}</strong>${appt.service ? ` for your ${escapeHtml(appt.service)}` : ""}.</p>
            <p>We hope everything went well! If you have a moment, we'd love to hear about your experience. Reviews help other patients find great clinics like ours.</p>
            ${reviewButtonHtml}
            <p style="margin-top: 24px;">Thank you so much,<br/><strong>${escapeHtml(clinicName)}</strong></p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 12px; color: #94a3b8;">You're receiving this because you recently visited ${escapeHtml(clinicName)}.</p>
          </div>
        `,
        text: `Hi ${appt.patient_name},\n\nThank you for visiting ${clinicName}${appt.service ? ` for your ${appt.service}` : ""}.\n\nWe hope everything went well! If you have a moment, we'd love to hear about your experience.\n\n${googleReviewUrl ? `Leave a Google review: ${googleReviewUrl}\n\n` : ""}Thank you so much,\n${clinicName}`,
      });

      await admin
        .from("appointments")
        .update({ review_request_sent_at: new Date().toISOString() })
        .eq("id", appt.id);
      sent.push(appt.id);
    } catch (e) {
      console.error("[review] send failed", e);
      skipped.push({ id: appt.id, reason: "send_failed" });
    }
  }

  await logSystemEvent({
    level: "info",
    category: "retention",
    message: `Review request run complete: sent=${sent.length} skipped=${skipped.length}`,
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
