import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";
import { logSystemEvent } from "@/lib/ops";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

type AppointmentReviewRow = {
  id: string;
  patient_name: string;
  patient_email: string;
  service: string | null;
  appointment_at: string;
  clinic_id: string;
};

type OnboardingSiteRow = {
  onboarding_client_id: string | null;
};

type OnboardingClientRow = {
  business_name: string | null;
  client_name: string | null;
};

type ClinicSettingsRow = {
  google_review_url: string | null;
  review_requests_enabled: boolean | null;
};

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

  const { data: appointments } = await (admin as any)
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

  for (const appt of (appointments || []) as AppointmentReviewRow[]) {
    if (!resend) {
      skipped.push({ id: appt.id, reason: "resend_not_configured" });
      continue;
    }

    let workspaceName = "your business";
    let googleReviewUrl: string | null = null;

    const { data: site } = await (admin as any)
      .from("onboarding_sites")
      .select("onboarding_client_id")
      .eq("clinic_id", appt.clinic_id)
      .limit(1)
      .maybeSingle();

    const onboardingSite = site as OnboardingSiteRow | null;

    if (onboardingSite?.onboarding_client_id) {
      const { data: client } = await (admin as any)
        .from("onboarding_clients")
        .select("business_name, client_name")
        .eq("id", onboardingSite.onboarding_client_id)
        .limit(1)
        .maybeSingle();

      const onboardingClient = client as OnboardingClientRow | null;

      workspaceName =
        onboardingClient?.business_name?.trim() ||
        onboardingClient?.client_name?.trim() ||
        "your business";
    }

    const { data: settings } = await (admin as any)
      .from("clinic_settings")
      .select("google_review_url, review_requests_enabled")
      .eq("clinic_id", appt.clinic_id)
      .maybeSingle();

    const clinicSettings = settings as ClinicSettingsRow | null;

    if (clinicSettings?.review_requests_enabled === false) {
      skipped.push({ id: appt.id, reason: "review_requests_disabled" });
      continue;
    }

    googleReviewUrl = clinicSettings?.google_review_url || null;

    const reviewButtonHtml = googleReviewUrl
      ? `<div style="margin: 24px 0;">
          <a href="${escapeHtml(googleReviewUrl)}" 
             style="background: #0f172a; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Leave a Google review
          </a>
         </div>`
      : `<p>If you have a moment, please share your feedback directly with the team - it means a lot.</p>`;

    try {
      await resend.emails.send({
        from: "LeadClaw <hello@leadclaw.uk>",
        to: appt.patient_email,
        subject: `How was your visit to ${workspaceName}?`,
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #0f172a; max-width: 520px;">
            <p>Hi ${escapeHtml(appt.patient_name)},</p>
            <p>Thank you for visiting <strong>${escapeHtml(workspaceName)}</strong>${appt.service ? ` for your ${escapeHtml(appt.service)}` : ""}.</p>
            <p>We hope everything went well! If you have a moment, we'd love to hear about your experience. Reviews help other customers find businesses like ours.</p>
            ${reviewButtonHtml}
            <p style="margin-top: 24px;">Thank you so much,<br/><strong>${escapeHtml(workspaceName)}</strong></p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 12px; color: #94a3b8;">You're receiving this because you recently visited ${escapeHtml(workspaceName)}.</p>
          </div>
        `,
        text: `Hi ${appt.patient_name}

Thank you for visiting ${workspaceName}${appt.service ? ` for your ${appt.service}` : ""}.

We hope everything went well! If you have a moment, we'd love to hear about your experience.

${googleReviewUrl ? `Leave a Google review: ${googleReviewUrl}\n\n` : ""}Thank you so much,
${workspaceName}`,
      });

      await (admin as any)
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
