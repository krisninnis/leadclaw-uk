import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";
import { logSystemEvent } from "@/lib/ops";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

type AppointmentRow = {
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

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatAppointmentTime(dt: string) {
  return new Date(dt).toLocaleString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const in46h = new Date(now.getTime() + 46 * 60 * 60 * 1000);
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const in1h = new Date(now.getTime() + 1 * 60 * 60 * 1000);

  const { data: remind48 } = await (admin as any)
    .from("appointments")
    .select(
      "id, patient_name, patient_email, service, appointment_at, clinic_id",
    )
    .eq("reminder_eligible", true)
    .eq("status", "scheduled")
    .is("reminder_48h_sent_at", null)
    .gte("appointment_at", in46h.toISOString())
    .lte("appointment_at", in48h.toISOString())
    .not("patient_email", "is", null)
    .limit(50);

  const { data: remind2h } = await (admin as any)
    .from("appointments")
    .select(
      "id, patient_name, patient_email, service, appointment_at, clinic_id",
    )
    .eq("reminder_eligible", true)
    .eq("status", "scheduled")
    .is("reminder_2h_sent_at", null)
    .gte("appointment_at", in1h.toISOString())
    .lte("appointment_at", in2h.toISOString())
    .not("patient_email", "is", null)
    .limit(50);

  const sent: string[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  async function getWorkspaceName(clinicId: string): Promise<string> {
    const { data: site } = await (admin as any)
      .from("onboarding_sites")
      .select("onboarding_client_id")
      .eq("clinic_id", clinicId)
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

      return (
        onboardingClient?.business_name?.trim() ||
        onboardingClient?.client_name?.trim() ||
        "your business"
      );
    }

    return "your business";
  }

  for (const appt of (remind48 || []) as AppointmentRow[]) {
    if (!resend) {
      skipped.push({ id: appt.id, reason: "resend_not_configured" });
      continue;
    }

    const workspaceName = await getWorkspaceName(appt.clinic_id);
    const formattedTime = formatAppointmentTime(appt.appointment_at);

    try {
      await resend.emails.send({
        from: "LeadClaw <hello@leadclaw.uk>",
        to: appt.patient_email,
        subject: `Reminder: Your appointment at ${workspaceName} tomorrow`,
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #0f172a; max-width: 520px;">
            <p>Hi ${escapeHtml(appt.patient_name)},</p>
            <p>This is a friendly reminder that you have an appointment at <strong>${escapeHtml(workspaceName)}</strong>.</p>
            <table style="border-collapse: collapse; margin: 16px 0;">
              <tr>
                <td style="padding: 6px 16px 6px 0; color: #64748b;">When:</td>
                <td style="padding: 6px 0; font-weight: 600;">${formattedTime}</td>
              </tr>
              ${
                appt.service
                  ? `<tr><td style="padding: 6px 16px 6px 0; color: #64748b;">Service:</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(appt.service)}</td></tr>`
                  : ""
              }
            </table>
            <p>If you need to reschedule or have any questions, please contact the business directly.</p>
            <p style="margin-top: 24px;">See you soon,<br/><strong>${escapeHtml(workspaceName)}</strong></p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 12px; color: #94a3b8;">You're receiving this reminder because you have a booked appointment at ${escapeHtml(workspaceName)}.</p>
          </div>
        `,
        text: `Hi ${appt.patient_name},

This is a friendly reminder that you have an appointment at ${workspaceName}.

When: ${formattedTime}${appt.service ? `\nService: ${appt.service}` : ""}

If you need to reschedule, please contact the business directly.

See you soon,
${workspaceName}`,
      });

      await (admin as any)
        .from("appointments")
        .update({ reminder_48h_sent_at: new Date().toISOString() })
        .eq("id", appt.id);

      sent.push(`48h:${appt.id}`);
    } catch (e) {
      console.error("[remind] 48h send failed", e);
      skipped.push({ id: appt.id, reason: "send_failed_48h" });
    }
  }

  for (const appt of (remind2h || []) as AppointmentRow[]) {
    if (!resend) {
      skipped.push({ id: appt.id, reason: "resend_not_configured" });
      continue;
    }

    const workspaceName = await getWorkspaceName(appt.clinic_id);
    const formattedTime = formatAppointmentTime(appt.appointment_at);

    try {
      await resend.emails.send({
        from: "LeadClaw <hello@leadclaw.uk>",
        to: appt.patient_email,
        subject: `Your appointment at ${workspaceName} is in 2 hours`,
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #0f172a; max-width: 520px;">
            <p>Hi ${escapeHtml(appt.patient_name)},</p>
            <p>Just a quick reminder - your appointment at <strong>${escapeHtml(workspaceName)}</strong> is coming up shortly.</p>
            <table style="border-collapse: collapse; margin: 16px 0;">
              <tr>
                <td style="padding: 6px 16px 6px 0; color: #64748b;">When:</td>
                <td style="padding: 6px 0; font-weight: 600;">${formattedTime}</td>
              </tr>
              ${
                appt.service
                  ? `<tr><td style="padding: 6px 16px 6px 0; color: #64748b;">Service:</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(appt.service)}</td></tr>`
                  : ""
              }
            </table>
            <p style="margin-top: 24px;">See you very soon,<br/><strong>${escapeHtml(workspaceName)}</strong></p>
          </div>
        `,
        text: `Hi ${appt.patient_name},

Just a quick reminder - your appointment at ${workspaceName} is coming up shortly.

When: ${formattedTime}${appt.service ? `\nService: ${appt.service}` : ""}

See you very soon,
${workspaceName}`,
      });

      await (admin as any)
        .from("appointments")
        .update({ reminder_2h_sent_at: new Date().toISOString() })
        .eq("id", appt.id);

      sent.push(`2h:${appt.id}`);
    } catch (e) {
      console.error("[remind] 2h send failed", e);
      skipped.push({ id: appt.id, reason: "send_failed_2h" });
    }
  }

  await logSystemEvent({
    level: "info",
    category: "retention",
    message: `Reminder run complete: sent=${sent.length} skipped=${skipped.length}`,
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
